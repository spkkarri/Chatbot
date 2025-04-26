import os
import logging
import sys
import requests
from config import (
    DEFAULT_PDFS_FOLDER, FAISS_FOLDER, setup_logging,
    OLLAMA_BASE_URL
)
# Import necessary functions and global variables
from ai_core import (
    initialize_ai_components, load_vector_store, extract_text_from_pdf,
    create_chunks_from_text, add_documents_to_vector_store, save_vector_store,
    vector_store, embeddings, llm  # Import globals for consistency
)

# Setup logging for this script
setup_logging()
logger = logging.getLogger(__name__)

def check_ollama_connection(base_url: str, timeout: int = 5) -> bool:
    """
    Performs a basic check to see if the Ollama server is reachable.

    Args:
        base_url (str): The base URL of the Ollama server.
        timeout (int): Connection timeout in seconds.

    Returns:
        bool: True if the server responds successfully, False otherwise.
    """
    check_url = base_url.rstrip('/') + "/api/tags"  # Use a known API endpoint
    logger.info(f"Checking Ollama connection at {check_url} (timeout: {timeout}s)...")
    try:
        response = requests.get(check_url, timeout=timeout)
        response.raise_for_status()  # Raises HTTPError for bad responses (4xx or 5xx)
        response.json()  # Ensure it’s valid JSON
        logger.info(f"Ollama server responded successfully (Status: {response.status_code}).")
        return True
    except requests.exceptions.Timeout:
        logger.error(f"Ollama connection timed out after {timeout} seconds connecting to {check_url}.")
        return False
    except requests.exceptions.ConnectionError:
        logger.error(f"Ollama connection refused at {check_url}. Is the Ollama server running and accessible?")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama connection failed for {check_url}: {e}")
        return False
    except ValueError:  # Handles JSONDecodeError if response isn’t valid JSON
        logger.error(f"Ollama server at {check_url} did not return valid JSON. Unexpected response.")
        return False

def get_existing_sources_from_index(vs):
    """
    Attempts to retrieve the set of source filenames currently in the FAISS index metadata.
    Handles potential errors if the docstore structure changes or is large.
    """
    if not vs or not hasattr(vs, 'docstore') or not hasattr(vs.docstore, '_dict'):
        logger.warning("Vector store or docstore not found/structured as expected. Cannot determine existing sources.")
        return set()
    try:
        sources = set()
        for doc_id, doc in getattr(vs.docstore, '_dict', {}).items():
            if hasattr(doc, 'metadata') and isinstance(doc.metadata, dict):
                source = doc.metadata.get('source')
                if source:
                    sources.add(source)
        logger.info(f"Found {len(sources)} unique sources in the existing index metadata.")
        return sources
    except Exception as e:
        logger.error(f"Error retrieving existing sources from FAISS docstore: {e}. Treating all default PDFs as new.", exc_info=True)
        return set()

def build_initial_faiss_index():
    """
    Processes PDFs in DEFAULT_PDFS_FOLDER, creates/updates the FAISS index, and saves it.
    Checks existing index metadata and Ollama connection first.
    """
    logger.info("--- Starting Initial FAISS Index Build/Update from Default PDFs ---")

    # 1. Ensure required directories exist
    if not os.path.exists(DEFAULT_PDFS_FOLDER):
        logger.error(f"Default PDFs directory not found: {DEFAULT_PDFS_FOLDER}. Please create it and add PDF files.")
        return False

    logger.info(f"Default PDFs folder: {DEFAULT_PDFS_FOLDER}")
    logger.info(f"FAISS store folder: {FAISS_FOLDER}")

    # Pre-check Ollama Connection
    logger.info("Performing pre-check for Ollama server accessibility...")
    if not check_ollama_connection(OLLAMA_BASE_URL):
        logger.critical(f"Ollama server is not reachable at {OLLAMA_BASE_URL}. Please ensure it's running and accessible.")
        logger.critical("Cannot proceed with index build without Ollama.")
        return False
    logger.info("Ollama connection pre-check successful.")

    # 2. Initialize AI Embeddings & LLM
    logger.info("Initializing AI components (Embeddings required)...")
    embeddings_new, llm_new = initialize_ai_components()  # Capture returned objects

    # Assign to globals explicitly (since other functions in ai_core rely on them)
    global embeddings, llm
    embeddings = embeddings_new
    llm = llm_new

    # Debugging logs to verify state
    logger.debug(f"Returned embeddings: {type(embeddings_new)}, llm: {type(llm_new)}")
    logger.debug(f"Global embeddings is None? {embeddings is None}, llm is None? {llm is None}")

    # Check initialization success
    if embeddings is None or llm is None:
        logger.critical("Failed to initialize AI Embeddings/LLM components. Cannot build/update index. Check Ollama connection/model details and logs.")
        logger.critical(f"Failure check: embeddings is None={embeddings is None}, llm is None={llm is None}")
        return False
    logger.info("AI Embeddings and LLM components initialized successfully.")

    # 3. Load existing index if present
    logger.info("Attempting to load existing FAISS index...")
    index_loaded = load_vector_store()  # Uses global embeddings internally
    if index_loaded and vector_store:
        index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Existing FAISS index loaded. Contains {index_size} vectors.")
        existing_filenames = get_existing_sources_from_index(vector_store)
    else:
        logger.info("No existing FAISS index found or loaded. A new index will be created.")
        existing_filenames = set()
        vector_store = None  # Ensure vector_store is None if load failed

    # 4. Find PDF files in the default folder
    try:
        all_files = os.listdir(DEFAULT_PDFS_FOLDER)
        pdf_files = sorted([f for f in all_files if f.lower().endswith('.pdf') and not f.startswith('~')])
        logger.info(f"Found {len(pdf_files)} PDF(s) in {DEFAULT_PDFS_FOLDER}: {pdf_files if pdf_files else 'None'}")
    except OSError as e:
        logger.error(f"Error listing files in {DEFAULT_PDFS_FOLDER}: {e}", exc_info=True)
        return False

    # 5. Identify *new* PDFs to process
    new_pdfs_to_process = [f for f in pdf_files if f not in existing_filenames]

    if not new_pdfs_to_process:
        if pdf_files:
            logger.info("All PDFs in the default folder seem to be present in the existing index (by filename). No new files to add.")
        else:
            logger.info(f"No PDFs found in {DEFAULT_PDFS_FOLDER}.")
        return True

    logger.info(f"Found {len(new_pdfs_to_process)} new PDF(s) to process: {new_pdfs_to_process}")

    # 6. Process each *new* PDF
    all_new_documents = []
    processing_errors = 0
    for filename in new_pdfs_to_process:
        pdf_path = os.path.join(DEFAULT_PDFS_FOLDER, filename)
        logger.info(f"Processing '{filename}'...")
        text = extract_text_from_pdf(pdf_path)
        if text:
            logger.debug(f"Extracted text from '{filename}'. Creating chunks...")
            documents = create_chunks_from_text(text, filename)
            if documents:
                all_new_documents.extend(documents)
                logger.info(f"Successfully created {len(documents)} chunks for '{filename}'.")
            else:
                logger.warning(f"Could not create document chunks for '{filename}', although text was extracted. Skipping file.")
                processing_errors += 1
        else:
            logger.warning(f"Could not extract text from '{filename}'. Skipping this file.")
            processing_errors += 1

    # 7. Add new documents to FAISS Index and Save
    if not all_new_documents:
        if processing_errors > 0:
            logger.error("No new document chunks were generated due to processing errors. Index not updated.")
            return False
        else:
            logger.warning("No new valid document chunks were generated. Index not updated.")
            return True

    logger.info(f"Attempting to add {len(all_new_documents)} new document chunks to the FAISS index...")
    success = add_documents_to_vector_store(all_new_documents)

    if success:
        final_count = getattr(getattr(vector_store, 'index', None), 'ntotal', 'N/A')
        logger.info(f"Successfully added new documents and saved index. Final vector count: {final_count}")
        return True
    else:
        logger.error("Failed to add new documents to the FAISS index or save it.")
        return False

if __name__ == "__main__":
    logger.info("Running default PDF processing script...")
    # Uncomment to enable DEBUG logging for more detail
    # logging.getLogger().setLevel(logging.DEBUG)
    try:
        if build_initial_faiss_index():
            logger.info("--- Default index build/update process completed successfully. ---")
            sys.exit(0)  # Exit with success code
        else:
            logger.error("--- Default index build/update process failed. See logs above for details. ---")
            sys.exit(1)  # Exit with error code
    except Exception as e:
        logger.critical(f"--- An unexpected critical error occurred during the default script: {e} ---", exc_info=True)
        sys.exit(2)  # Different error code for unexpected failure