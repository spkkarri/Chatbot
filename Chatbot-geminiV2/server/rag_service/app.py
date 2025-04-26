# server/rag_service/app.py

import os
import sys
from flask import Flask, request, jsonify

# Add server directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(current_dir)
sys.path.insert(0, server_dir) # Ensure rag_service can be imported

# Now import local modules AFTER adjusting sys.path
from rag_service import config
import rag_service.file_parser as file_parser
import rag_service.faiss_handler as faiss_handler
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message}), status_code

@app.route('/health', methods=['GET'])
def health_check():
    logger.info("\n--- Received request at /health ---")
    status_details = {
        "status": "error",
        "embedding_model_type": config.EMBEDDING_TYPE,
        "embedding_model_name": config.EMBEDDING_MODEL_NAME,
        "embedding_dimension": None,
        "sentence_transformer_load": None,
        "default_index_loaded": False,
        "default_index_vectors": 0,
        "default_index_dim": None,
        "message": ""
    }
    http_status_code = 503

    try:
        # Check Embedding Model
        model = faiss_handler.embedding_model
        if model is None:
            status_details["message"] = "Embedding model could not be initialized during startup."
            status_details["sentence_transformer_load"] = "Failed"
            raise RuntimeError(status_details["message"])
        else:
            status_details["sentence_transformer_load"] = "OK"
            try:
                 status_details["embedding_dimension"] = faiss_handler.get_embedding_dimension(model)
            except Exception as dim_err:
                 status_details["embedding_dimension"] = f"Error: {dim_err}"


        # Check Default Index
        if config.DEFAULT_INDEX_USER_ID in faiss_handler.loaded_indices:
            status_details["default_index_loaded"] = True
            default_index = faiss_handler.loaded_indices[config.DEFAULT_INDEX_USER_ID]
            if hasattr(default_index, 'index') and default_index.index:
                status_details["default_index_vectors"] = default_index.index.ntotal
                status_details["default_index_dim"] = default_index.index.d
            logger.info("Default index found in cache.")
        else:
            logger.info("Attempting to load default index for health check...")
            try:
                default_index = faiss_handler.load_or_create_index(config.DEFAULT_INDEX_USER_ID)
                status_details["default_index_loaded"] = True
                if hasattr(default_index, 'index') and default_index.index:
                    status_details["default_index_vectors"] = default_index.index.ntotal
                    status_details["default_index_dim"] = default_index.index.d
                logger.info("Default index loaded successfully during health check.")
            except Exception as index_load_err:
                logger.error(f"Health check failed to load default index: {index_load_err}", exc_info=True)
                status_details["message"] = f"Failed to load default index: {index_load_err}"
                status_details["default_index_loaded"] = False
                raise # Re-raise to indicate failure

        # Final Status
        status_details["status"] = "ok"
        status_details["message"] = "RAG service is running, embedding model accessible, default index loaded."
        http_status_code = 200
        logger.info("Health check successful.")

    except Exception as e:
        logger.error(f"--- Health Check Error ---", exc_info=True)
        if not status_details["message"]: # Avoid overwriting specific error messages
            status_details["message"] = f"Health check failed: {str(e)}"
        # Ensure status is error if exception occurred
        status_details["status"] = "error"
        http_status_code = 503 # Service unavailable if health check fails critically

    return jsonify(status_details), http_status_code


@app.route('/add_document', methods=['POST'])
def add_document():
    logger.info("\n--- Received request at /add_document ---")
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)

    data = request.get_json()
    user_id = data.get('user_id')
    file_path = data.get('file_path')
    original_name = data.get('original_name')

    if not all([user_id, file_path, original_name]):
        return create_error_response("Missing required fields: user_id, file_path, original_name", 400)

    logger.info(f"Processing file: {original_name} for user: {user_id}")
    logger.info(f"File path: {file_path}")

    if not os.path.exists(file_path):
        return create_error_response(f"File not found at path: {file_path}", 404)

    try:
        # 1. Parse File
        text_content = file_parser.parse_file(file_path)
        if text_content is None:
            logger.warning(f"Skipping embedding for {original_name}: File type not supported or parsing failed.")
            return jsonify({"message": f"File type of '{original_name}' not supported for RAG or parsing failed.", "filename": original_name, "status": "skipped"}), 200

        if not text_content.strip():
            logger.warning(f"Skipping embedding for {original_name}: No text content found after parsing.")
            return jsonify({"message": f"No text content extracted from '{original_name}'.", "filename": original_name, "status": "skipped"}), 200

        # 2. Chunk Text
        documents = file_parser.chunk_text(text_content, original_name, user_id)
        if not documents:
            logger.warning(f"No chunks created for {original_name}. Skipping add.")
            return jsonify({"message": f"No text chunks generated for '{original_name}'.", "filename": original_name, "status": "skipped"}), 200

        # 3. Add to Index (faiss_handler now handles dimension checks/recreation)
        faiss_handler.add_documents_to_index(user_id, documents)

        logger.info(f"Successfully processed and added document: {original_name} for user: {user_id}")
        return jsonify({
            "message": f"Document '{original_name}' processed and added to index.",
            "filename": original_name,
            "chunks_added": len(documents),
            "status": "added"
        }), 200
    except Exception as e:
        # Log the specific error from faiss_handler if it raised one
        logger.error(f"--- Add Document Error for file '{original_name}' ---", exc_info=True)
        return create_error_response(f"Failed to process document '{original_name}': {str(e)}", 500)


@app.route('/query', methods=['POST'])
def query_index_route():
    logger.info("\n--- Received request at /query ---")
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)

    data = request.get_json()
    user_id = data.get('user_id')
    query = data.get('query')
    k = data.get('k', 5) # Default to k=5 now

    if not user_id or not query:
        return create_error_response("Missing required fields: user_id, query", 400)

    logger.info(f"Querying for user: {user_id} with k={k}")
    # Avoid logging potentially sensitive query text in production
    logger.debug(f"Query text: '{query[:100]}...'")

    try:
        results = faiss_handler.query_index(user_id, query, k=k)

        formatted_results = []
        for doc, score in results:
            # --- SEND FULL CONTENT ---
            content = doc.page_content
            # --- (No snippet generation needed) ---

            formatted_results.append({
                "documentName": doc.metadata.get("documentName", "Unknown"),
                "score": float(score),
                "content": content, # Send the full content
                # Removed "content_snippet"
            })

        logger.info(f"Query successful for user {user_id}. Returning {len(formatted_results)} results.")
        return jsonify({"relevantDocs": formatted_results}), 200
    except Exception as e:
        logger.error(f"--- Query Error ---", exc_info=True)
        return create_error_response(f"Failed to query index: {str(e)}", 500)

if __name__ == '__main__':
    # Ensure base FAISS directory exists on startup
    try:
        faiss_handler.ensure_faiss_dir()
    except Exception as e:
        logger.critical(f"CRITICAL: Could not create FAISS base directory '{config.FAISS_INDEX_DIR}'. Exiting. Error: {e}", exc_info=True)
        sys.exit(1) # Exit if base dir cannot be created

    # Attempt to initialize embedding model on startup
    try:
        faiss_handler.get_embedding_model() # This also determines the dimension
        logger.info("Embedding model initialized successfully on startup.")
    except Exception as e:
        logger.error(f"CRITICAL: Embedding model failed to initialize on startup: {e}", exc_info=True)
        logger.error("Endpoints requiring embeddings (/add_document, /query) will fail.")
        # Decide if you want to exit or run in a degraded state
        sys.exit(1) # Exit if embedding model fails - essential service

    # Attempt to load/check the default index on startup
    try:
        faiss_handler.load_or_create_index(config.DEFAULT_INDEX_USER_ID) # This checks/creates/validates dimension
        logger.info(f"Default index '{config.DEFAULT_INDEX_USER_ID}' loaded/checked/created on startup.")
    except Exception as e:
        logger.warning(f"Warning: Could not load/create default index '{config.DEFAULT_INDEX_USER_ID}' on startup: {e}", exc_info=True)
        # Don't necessarily exit, but log clearly. Queries might only use user indices.

    # Start Flask App
    port = config.RAG_SERVICE_PORT
    logger.info(f"--- Starting RAG service ---")
    logger.info(f"Listening on: http://0.0.0.0:{port}")
    logger.info(f"Using Embedding: {config.EMBEDDING_TYPE} ({config.EMBEDDING_MODEL_NAME})")
    try:
        logger.info(f"Embedding Dimension: {faiss_handler.get_embedding_dimension(faiss_handler.embedding_model)}")
    except: pass # Dimension already logged or failed earlier
    logger.info(f"FAISS Index Path: {config.FAISS_INDEX_DIR}")
    logger.info("-----------------------------")
    # Use waitress or gunicorn for production instead of Flask's development server
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG') == '1')
