import os
import logging
import sys
import traceback

# --- Path Setup ---
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(current_dir)
project_root_dir = os.path.dirname(server_dir)
sys.path.insert(0, server_dir)
# --- End Path Setup ---

try:
    from rag_service import config
    from rag_service import faiss_handler
    from rag_service import file_parser
except ImportError as e:
     print("ImportError:", e)
     print("Failed to import modules. Ensure the script is run correctly relative to the project structure.")
     print("Current sys.path:", sys.path)
     exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)


class DefaultVectorDBBuilder:
    def __init__(self):
        logger.info("Initializing embedding model...")
        try:
            # Use SentenceTransformer as configured in config.py
            self.embed_model = faiss_handler.get_embedding_model()
            if self.embed_model is None:
                 raise RuntimeError("Failed to initialize Sentence Transformer embedding model.")
        except Exception as e:
            logger.error(f"Fatal error initializing embedding model: {e}", exc_info=True)
            raise

        self.chunk_size = config.CHUNK_SIZE
        self.chunk_overlap = config.CHUNK_OVERLAP

        self.default_docs_dir = config.DEFAULT_ASSETS_DIR
        self.index_dir = config.FAISS_INDEX_DIR
        self.default_user_id = config.DEFAULT_INDEX_USER_ID

        self.default_index_user_path = faiss_handler.get_user_index_path(self.default_user_id)
        self.index_file_path = os.path.join(self.default_index_user_path, "index.faiss")
        self.pkl_file_path = os.path.join(self.default_index_user_path, "index.pkl")

        try:
            faiss_handler.ensure_faiss_dir()
            os.makedirs(self.default_index_user_path, exist_ok=True)
        except Exception as e:
             logger.error(f"Failed to create necessary directories: {e}")
             raise

        logger.info(f"Default assets directory: {self.default_docs_dir}")
        logger.info(f"Default index directory: {self.default_index_user_path}")


    def create_default_index(self, force_rebuild=True): # Keep force_rebuild flag
        """Scans default assets, parses files, creates embeddings, and saves the FAISS index."""
        logger.info("--- Starting Default Index Creation ---")

        # --- Force Rebuild Logic ---
        if force_rebuild and (os.path.exists(self.index_file_path) or os.path.exists(self.pkl_file_path)):
            logger.warning(f"force_rebuild=True. Deleting existing default index files in {self.default_index_user_path}.")
            try:
                if os.path.exists(self.index_file_path): os.remove(self.index_file_path)
                if os.path.exists(self.pkl_file_path): os.remove(self.pkl_file_path)
                # Clear from cache if loaded
                if self.default_user_id in faiss_handler.loaded_indices:
                    del faiss_handler.loaded_indices[self.default_user_id]
                logger.info("Removed existing default index files and cleared cache.")
            except OSError as e:
                logger.error(f"Error removing existing index files: {e}")
                return False # Stop if we can't remove old files
        elif not force_rebuild and (os.path.exists(self.index_file_path) or os.path.exists(self.pkl_file_path)):
             logger.info("Default index already exists and force_rebuild=False. Skipping creation.")
             # Try loading it to confirm validity
             try:
                 faiss_handler.load_or_create_index(self.default_user_id)
                 logger.info("Existing default index loaded successfully.")
                 return True
             except Exception as load_err:
                 logger.error(f"Failed to load existing default index: {load_err}. Consider running with force_rebuild=True.")
                 return False


        # --- Process Documents ---
        all_documents = []
        files_processed = 0
        files_skipped = 0

        logger.info(f"Scanning for processable files in: {self.default_docs_dir}")
        if not os.path.isdir(self.default_docs_dir):
            logger.error(f"Default assets directory not found: {self.default_docs_dir}")
            return False

        for root, _, files in os.walk(self.default_docs_dir):
            for filename in files:
                file_path = os.path.join(root, filename)
                # logger.debug(f"Found file: {filename}")
                try:
                    text_content = file_parser.parse_file(file_path)
                    if text_content and text_content.strip():
                        langchain_docs = file_parser.chunk_text(
                            text_content, filename, self.default_user_id
                        )
                        if langchain_docs:
                            all_documents.extend(langchain_docs)
                            files_processed += 1
                            logger.info(f"Parsed and chunked: {filename} ({len(langchain_docs)} chunks)")
                        else:
                            logger.warning(f"Skipped {filename}: No chunks generated.")
                            files_skipped += 1
                    else:
                        logger.warning(f"Skipped {filename}: No text content or unsupported type.")
                        files_skipped += 1
                except Exception as e:
                    logger.error(f"Error processing file {filename}: {e}")
                    traceback.print_exc()
                    files_skipped += 1

        if not all_documents:
            logger.error(f"No processable documents found or generated in {self.default_docs_dir}. Cannot create index.")
            # Still create an empty index structure if the directory was valid
            try:
                 logger.info("Creating an empty index structure as no documents were found.")
                 faiss_handler.load_or_create_index(self.default_user_id) # Creates empty index
                 logger.info("Empty default index created successfully.")
                 return True # Success, but empty
            except Exception as empty_create_err:
                 logger.error(f"Failed to create empty index structure: {empty_create_err}", exc_info=True)
                 return False


        logger.info(f"Total files processed: {files_processed}, skipped: {files_skipped}")
        logger.info(f"Creating embeddings and adding {len(all_documents)} total chunks to index...")

        try:
            # The load_or_create_index function will handle creating the empty structure
            # if it doesn't exist (or after deletion if force_rebuild=True)
            logger.info("Ensuring FAISS index structure exists...")
            index_instance = faiss_handler.load_or_create_index(self.default_user_id)

            logger.info(f"Adding {len(all_documents)} documents to the default index '{self.default_user_id}'...")
            # Use the updated handler function which now manages IDs correctly
            faiss_handler.add_documents_to_index(self.default_user_id, all_documents)

            # Verify save occurred
            if not os.path.exists(self.index_file_path) or not os.path.exists(self.pkl_file_path):
                 logger.error("Index files were not found after adding documents. Check permissions or disk space.")
                 return False

            logger.info(f"Successfully created/updated and saved default index ({self.default_user_id}) with {len(all_documents)} document chunks.")
            logger.info("--- Default Index Creation Finished ---")
            return True

        except Exception as e:
            logger.error(f"Failed during embedding or index creation: {e}", exc_info=True)
            logger.error("--- Default Index Creation Failed ---")
            return False

def main():
    print("--- Running Default Index Builder ---")
    try:
        builder = DefaultVectorDBBuilder()
    except Exception as init_err:
        print(f"FATAL: Failed to initialize builder: {init_err}")
        sys.exit(1)

    if not os.path.isdir(builder.default_docs_dir):
         logger.error(f"Default assets directory '{builder.default_docs_dir}' is missing.")
         sys.exit(1)

    # --- Always force rebuild as requested ---
    force = True
    logger.info(f"Starting index creation (force_rebuild={force})...")
    if not builder.create_default_index(force_rebuild=force):
        logger.error("Index creation process failed.")
        sys.exit(1)
    else:
        logger.info("Default index creation process completed successfully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
