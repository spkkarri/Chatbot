# --- START OF FILE ai_core.py ---

# Notebook/backend/ai_core.py
import os
import logging
import fitz  # PyMuPDF
import re
# Near the top of ai_core.py
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
# Removed incorrect OllamaLLM import if it was there from previous attempts
from langchain.text_splitter import RecursiveCharacterTextSplitter # <<<--- ENSURE THIS IS PRESENT
from langchain.docstore.document import Document
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate # Import PromptTemplate if needed directly here
from config import (
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_EMBED_MODEL, FAISS_FOLDER,
    DEFAULT_PDFS_FOLDER, UPLOAD_FOLDER, RAG_CHUNK_K, MULTI_QUERY_COUNT,
    ANALYSIS_MAX_CONTEXT_LENGTH, OLLAMA_REQUEST_TIMEOUT, RAG_SEARCH_K_PER_QUERY,
    SUB_QUERY_PROMPT_TEMPLATE, SYNTHESIS_PROMPT_TEMPLATE, ANALYSIS_PROMPTS
)
from utils import parse_llm_response, escape_html # Added escape_html for potential use

logger = logging.getLogger(__name__)

# --- Global State (managed within functions) ---
document_texts_cache = {}
vector_store = None
embeddings: OllamaEmbeddings | None = None
llm: ChatOllama | None = None

# --- Initialization Functions ---

# ai_core.py (only showing the modified function)
def initialize_ai_components() -> tuple[OllamaEmbeddings | None, ChatOllama | None]:
    """Initializes Ollama Embeddings and LLM instances globally.

    Returns:
        tuple[OllamaEmbeddings | None, ChatOllama | None]: The initialized embeddings and llm objects,
                                                          or (None, None) if initialization fails.
    """
    global embeddings, llm
    if embeddings and llm:
        logger.info("AI components already initialized.")
        return embeddings, llm

    try:
        # Use the new OllamaEmbeddings from langchain_ollama
        logger.info(f"Initializing Ollama Embeddings: model={OLLAMA_EMBED_MODEL}, base_url={OLLAMA_BASE_URL}, timeout={OLLAMA_REQUEST_TIMEOUT}s")
        embeddings = OllamaEmbeddings(
            model=OLLAMA_EMBED_MODEL,
            base_url=OLLAMA_BASE_URL,
            #request_timeout=OLLAMA_REQUEST_TIMEOUT # Explicitly pass timeout
        )
        # Perform a quick test embedding
        _ = embeddings.embed_query("Test embedding query")
        logger.info("Ollama Embeddings initialized successfully.")

        # Use the new ChatOllama from langchain_ollama
        logger.info(f"Initializing Ollama LLM: model={OLLAMA_MODEL}, base_url={OLLAMA_BASE_URL}, timeout={OLLAMA_REQUEST_TIMEOUT}s")
        llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            #request_timeout=OLLAMA_REQUEST_TIMEOUT # Explicitly pass timeout
        )
        # Perform a quick test invocation
        _ = llm.invoke("Respond briefly with 'AI Check OK'")
        logger.info("Ollama LLM initialized successfully.")

        return embeddings, llm  # Return the objects
    except ImportError as e:
        logger.critical(f"Import error during AI initialization: {e}. Ensure correct langchain packages are installed.", exc_info=True)
        embeddings = None
        llm = None
        return None, None
    except Exception as e:
        # Catch potential Pydantic validation error specifically if possible, or general Exception
        logger.error(f"Failed to initialize AI components (check Ollama server status, model name '{OLLAMA_MODEL}' / '{OLLAMA_EMBED_MODEL}', base URL '{OLLAMA_BASE_URL}', timeout {OLLAMA_REQUEST_TIMEOUT}s): {e}", exc_info=True)
        # Log the type of error for better debugging
        logger.error(f"Error Type: {type(e).__name__}")
        # If it's a Pydantic error, the message usually contains details
        if "pydantic" in str(type(e)).lower():
             logger.error(f"Pydantic Validation Error Details: {e}")
        embeddings = None
        llm = None
        return None, None

def load_vector_store() -> bool:
    """Loads the FAISS index from disk into the global `vector_store`.

    Requires `embeddings` to be initialized first.

    Returns:
        bool: True if the index was loaded successfully, False otherwise (or if not found).
    """
    global vector_store, embeddings
    if vector_store:
        logger.info("Vector store already loaded.")
        return True
    if not embeddings:
        logger.error("Embeddings not initialized. Cannot load vector store.")
        return False

    faiss_index_path = os.path.join(FAISS_FOLDER, "index.faiss")
    faiss_pkl_path = os.path.join(FAISS_FOLDER, "index.pkl")

    if os.path.exists(faiss_index_path) and os.path.exists(faiss_pkl_path):
        try:
            logger.info(f"Loading FAISS index from folder: {FAISS_FOLDER}")
            # Note: Loading requires the same embedding model used for saving.
            # allow_dangerous_deserialization is required for FAISS/pickle
            vector_store = FAISS.load_local(
                folder_path=FAISS_FOLDER,
                embeddings=embeddings, # Pass the initialized embeddings object
                allow_dangerous_deserialization=True
            )
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            if index_size > 0:
                logger.info(f"FAISS index loaded successfully. Contains {index_size} vectors.")
                return True
            else:
                logger.warning(f"FAISS index loaded from {FAISS_FOLDER}, but it appears to be empty.")
                return True # Treat empty as loaded
        except FileNotFoundError:
            logger.warning(f"FAISS index files not found in {FAISS_FOLDER}, although directory exists. Proceeding without loaded index.")
            vector_store = None
            return False
        except EOFError:
            logger.error(f"EOFError loading FAISS index from {FAISS_FOLDER}. Index file might be corrupted or incomplete.", exc_info=True)
            vector_store = None
            return False
        except Exception as e:
            logger.error(f"Error loading FAISS index from {FAISS_FOLDER}: {e}", exc_info=True)
            vector_store = None # Ensure it's None if loading failed
            return False
    else:
        logger.warning(f"FAISS index files (index.faiss, index.pkl) not found at {FAISS_FOLDER}. Will be created on first upload or if default.py ran.")
        vector_store = None
        return False # Indicate index wasn't loaded


def save_vector_store() -> bool:
    """Saves the current global `vector_store` (FAISS index) to disk.

    Returns:
        bool: True if saving was successful, False otherwise (or if store is None).
    """
    global vector_store
    if not vector_store:
        logger.warning("Attempted to save vector store, but it's not loaded or initialized.")
        return False
    if not os.path.exists(FAISS_FOLDER):
        try:
            os.makedirs(FAISS_FOLDER)
            logger.info(f"Created FAISS store directory: {FAISS_FOLDER}")
        except OSError as e:
            logger.error(f"Failed to create FAISS store directory {FAISS_FOLDER}: {e}", exc_info=True)
            return False

    try:
        index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Saving FAISS index ({index_size} vectors) to {FAISS_FOLDER}...")
        vector_store.save_local(FAISS_FOLDER)
        logger.info(f"FAISS index saved successfully.")
        return True
    except Exception as e:
        logger.error(f"Error saving FAISS index to {FAISS_FOLDER}: {e}", exc_info=True)
        return False


def load_all_document_texts():
    """Loads text from all PDFs found in default and upload folders into the global cache.

    Used by the analysis endpoint to avoid re-extraction.
    """
    global document_texts_cache
    logger.info("Loading/refreshing document texts cache for analysis...")
    document_texts_cache = {} # Reset cache before loading
    loaded_count = 0
    processed_files = set()

    def _load_from_folder(folder_path):
        nonlocal loaded_count
        count = 0
        if not os.path.exists(folder_path):
            logger.warning(f"Document text folder not found: {folder_path}. Skipping.")
            return count
        try:
            for filename in os.listdir(folder_path):
                if filename.lower().endswith('.pdf') and not filename.startswith('~') and filename not in processed_files:
                    file_path = os.path.join(folder_path, filename)
                    # logger.debug(f"Extracting text from {filename} for cache...")
                    text = extract_text_from_pdf(file_path)
                    if text:
                        document_texts_cache[filename] = text
                        processed_files.add(filename)
                        count += 1
                    else:
                        logger.warning(f"Could not extract text from {filename} in {folder_path} for cache.")
            logger.info(f"Cached text for {count} PDFs from {folder_path}.")
            loaded_count += count
        except Exception as e:
            logger.error(f"Error listing or processing files in {folder_path} for cache: {e}", exc_info=True)
        return count

    # Load defaults first, then uploads (uploads overwrite defaults if names collide in cache)
    _load_from_folder(DEFAULT_PDFS_FOLDER)
    _load_from_folder(UPLOAD_FOLDER)

    logger.info(f"Finished loading texts cache. Total unique documents cached: {len(document_texts_cache)}")


# --- PDF Processing Functions ---

def extract_text_from_pdf(pdf_path: str) -> str | None:
    """Extracts text from a single PDF file using PyMuPDF (fitz).

    Args:
        pdf_path (str): The full path to the PDF file.

    Returns:
        str | None: The extracted text content, or None if an error occurred.
    """
    text = ""
    if not os.path.exists(pdf_path):
        logger.error(f"PDF file not found for extraction: {pdf_path}")
        return None
    try:
        doc = fitz.open(pdf_path)
        num_pages = len(doc)
        logger.debug(f"Starting text extraction from {os.path.basename(pdf_path)} ({num_pages} pages)...")
        for page_num in range(num_pages):
            try:
                page = doc.load_page(page_num)
                # Use "text" with sort=True for reading order. flags=0 is default.
                page_text = page.get_text("text", sort=True, flags=0).strip()

                # Basic cleaning: Replace multiple whitespace chars with single space, keep single newlines.
                page_text = re.sub(r'[ \t\f\v]+', ' ', page_text) # Replace horizontal whitespace with single space
                page_text = re.sub(r'\n+', '\n', page_text) # Keep single newlines, collapse multiples

                if page_text:
                    text += page_text + "\n\n" # Add double newline as separator between pages
            except Exception as page_err:
                logger.warning(f"Error processing page {page_num+1} of {os.path.basename(pdf_path)}: {page_err}")
                continue # Skip problematic page

        doc.close()
        cleaned_text = text.strip()
        if cleaned_text:
            logger.info(f"Successfully extracted text from {os.path.basename(pdf_path)} (approx {len(cleaned_text)} chars).")
            return cleaned_text
        else:
            logger.warning(f"Extracted text was empty for {os.path.basename(pdf_path)}.")
            return None
    except fitz.fitz.PasswordError:
        logger.error(f"Error extracting text from PDF {os.path.basename(pdf_path)}: File is password-protected.")
        return None
    except Exception as e:
        logger.error(f"Error extracting text from PDF {os.path.basename(pdf_path)}: {e}", exc_info=True)
        return None

def create_chunks_from_text(text: str, filename: str) -> list[Document]:
    """Splits text into chunks using RecursiveCharacterTextSplitter and creates LangChain Documents.

    Args:
        text (str): The text content to chunk.
        filename (str): The source filename for metadata.

    Returns:
        list[Document]: A list of LangChain Document objects representing the chunks.
    """
    if not text:
        logger.warning(f"Cannot create chunks for '{filename}', input text is empty.")
        return []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,      # Target size of each chunk
        chunk_overlap=150,    # Overlap between chunks
        length_function=len,
        add_start_index=True, # Include start index in metadata
        separators=["\n\n", "\n", ". ", ", ", " ", ""], # Hierarchical separators
    )

    try:
        # Use create_documents which handles metadata assignment more cleanly
        documents = text_splitter.create_documents([text], metadatas=[{"source": filename}])
        # Add explicit chunk_index for clarity (though start_index is also present)
        for i, doc in enumerate(documents):
            doc.metadata["chunk_index"] = i

        logger.info(f"Created {len(documents)} LangChain Document chunks for '{filename}'.")
        return documents

    except Exception as e:
        logger.error(f"Error creating chunks for '{filename}': {e}", exc_info=True)
        return []

def add_documents_to_vector_store(documents: list[Document]) -> bool:
    """Adds LangChain Documents to the global FAISS index.
    Creates the index if it doesn't exist. Saves the index afterwards.

    Args:
        documents (list[Document]): The list of documents to add.

    Returns:
        bool: True if documents were added and the index saved successfully, False otherwise.
    """
    global vector_store, embeddings
    if not documents:
        logger.warning("No documents provided to add to vector store.")
        return True # Nothing to add, technically successful no-op.
    if not embeddings:
        logger.error("Embeddings not initialized. Cannot add documents to vector store.")
        return False

    try:
        if vector_store:
            logger.info(f"Adding {len(documents)} document chunks to existing FAISS index...")
            vector_store.add_documents(documents)
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"Addition complete. Index now contains {index_size} vectors.")
        else:
            logger.info(f"No FAISS index loaded. Creating new index from {len(documents)} document chunks...")
            vector_store = FAISS.from_documents(documents, embeddings)
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            if vector_store and index_size > 0:
                logger.info(f"New FAISS index created with {index_size} vectors.")
            else:
                logger.error("Failed to create new FAISS index or index is empty after creation.")
                vector_store = None # Ensure it's None if creation failed
                return False

        # IMPORTANT: Persist the updated index
        return save_vector_store()

    except Exception as e:
        logger.error(f"Error adding documents to FAISS index or saving: {e}", exc_info=True)
        # Consider state: if vector_store existed before, it might be partially updated in memory.
        # Saving failed, so on next load, it should revert unless error was in 'from_documents'.
        return False

# --- RAG and LLM Interaction ---

# --- MODIFIED: Added logging ---
def generate_sub_queries(query: str) -> list[str]:
    """
    Uses the LLM to generate sub-queries for RAG. Includes the original query.
    Uses SUB_QUERY_PROMPT_TEMPLATE from config.
    """
    global llm
    if not llm:
        logger.error("LLM not initialized, cannot generate sub-queries. Using original query only.")
        return [query]
    if MULTI_QUERY_COUNT <= 0:
        logger.debug("MULTI_QUERY_COUNT is <= 0, skipping sub-query generation.")
        return [query]

    # Use the prompt template from config
    chain = LLMChain(llm=llm, prompt=SUB_QUERY_PROMPT_TEMPLATE)

    try:
        logger.info(f"Generating {MULTI_QUERY_COUNT} sub-queries for: '{query[:100]}...'")
        # Log the prompt before sending (approx first 150 chars)
        prompt_to_log = SUB_QUERY_PROMPT_TEMPLATE.format(query=query, num_queries=MULTI_QUERY_COUNT)
        logger.debug(f"Sub-query Prompt (Start):\n{prompt_to_log[:150]}...") # DEBUG level might be better

        response = chain.invoke({"query": query, "num_queries": MULTI_QUERY_COUNT})
        # Response structure might vary; often {'text': 'query1\nquery2'}
        raw_response_text = response.get('text', '') if isinstance(response, dict) else str(response)

        # Log the raw response start
        logger.debug(f"Sub-query Raw Response (Start):\n{raw_response_text[:150]}...") # DEBUG level

        # No need to parse for <thinking> here as the prompt doesn't request it
        sub_queries = [q.strip() for q in raw_response_text.strip().split('\n') if q.strip()]

        if sub_queries:
            logger.info(f"Generated {len(sub_queries)} sub-queries.")
            # Ensure we don't exceed MULTI_QUERY_COUNT, and always include the original
            final_queries = [query] + sub_queries[:MULTI_QUERY_COUNT]
            # Deduplicate the final list just in case LLM generated the original query
            final_queries = list(dict.fromkeys(final_queries))
            logger.debug(f"Final search queries: {final_queries}")
            return final_queries
        else:
            logger.warning("LLM did not generate any valid sub-queries. Falling back to original query only.")
            return [query]

    except Exception as e:
        logger.error(f"Error generating sub-queries: {e}", exc_info=True)
        return [query] # Fallback
# --- END MODIFICATION ---

def perform_rag_search(query: str) -> tuple[list[Document], str, dict[int, dict]]:
    """
    Performs RAG: generates sub-queries, searches vector store, deduplicates, formats context, creates citation map.
    """
    global vector_store
    context_docs = []
    formatted_context_text = "No relevant context was found in the available documents."
    context_docs_map = {} # Use 1-based index for keys mapping to doc details

    if not vector_store:
        logger.warning("RAG search attempted but no vector store is loaded.")
        return context_docs, formatted_context_text, context_docs_map
    if not query or not query.strip():
        logger.warning("RAG search attempted with empty query.")
        return context_docs, formatted_context_text, context_docs_map

    index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
    if index_size == 0:
        logger.warning("RAG search attempted but the vector store index is empty.")
        return context_docs, formatted_context_text, context_docs_map

    try:
        # 1. Generate Sub-Queries
        search_queries = generate_sub_queries(query)

        # 2. Perform Similarity Search for each query
        all_retrieved_docs_with_scores = []
        # Retrieve k docs per query before deduplication
        k_per_query = max(RAG_SEARCH_K_PER_QUERY, 1) # Ensure at least 1
        logger.debug(f"Retrieving top {k_per_query} chunks for each of {len(search_queries)} queries.")

        for q_idx, q in enumerate(search_queries):
            try:
                # Use similarity_search_with_score to get scores for potential ranking/filtering later
                retrieved = vector_store.similarity_search_with_score(q, k=k_per_query)
                # Format: [(Document(page_content=..., metadata=...), score), ...]
                all_retrieved_docs_with_scores.extend(retrieved)
                logger.debug(f"Query {q_idx+1}/{len(search_queries)} ('{q[:50]}...') retrieved {len(retrieved)} chunks.")
            except Exception as search_err:
                logger.error(f"Error during similarity search for query '{q[:50]}...': {search_err}", exc_info=False) # Less verbose log

        if not all_retrieved_docs_with_scores:
            logger.info("No relevant chunks found in vector store for the query/sub-queries.")
            return context_docs, formatted_context_text, context_docs_map

        # 3. Deduplicate and Select Top Documents
        # Key: (source_filename, chunk_index) Value: (Document, score)
        unique_docs_dict = {}
        for doc, score in all_retrieved_docs_with_scores:
            source = doc.metadata.get('source', 'Unknown')
            # Use chunk_index if available, otherwise maybe start_index or hash of content? Chunk_index preferred.
            chunk_idx = doc.metadata.get('chunk_index', doc.metadata.get('start_index', -1))
            doc_key = (source, chunk_idx)

            # Consider content-based deduplication if metadata isn't reliable enough
            # content_hash = hash(doc.page_content)
            # doc_key = (source, content_hash)

            if doc_key not in unique_docs_dict or score < unique_docs_dict[doc_key][1]: # Lower score (distance) is better
                unique_docs_dict[doc_key] = (doc, score)

        # Sort unique documents by score (ascending - best first)
        sorted_unique_docs = sorted(unique_docs_dict.values(), key=lambda item: item[1])

        # Select the final top RAG_CHUNK_K unique documents
        final_context_docs_with_scores = sorted_unique_docs[:RAG_CHUNK_K]
        context_docs = [doc for doc, score in final_context_docs_with_scores]

        logger.info(f"Retrieved {len(all_retrieved_docs_with_scores)} chunks total across sub-queries. "
                    f"Selected {len(context_docs)} unique chunks (target k={RAG_CHUNK_K}) for context.")

        # 4. Format Context for LLM Prompt and Create Citation Map
        formatted_context_parts = []
        temp_map = {} # Use 1-based index for map keys, matching citations like [1], [2]
        for i, doc in enumerate(context_docs):
            citation_index = i + 1 # 1-based index for the prompt and map
            source = doc.metadata.get('source', 'Unknown Source')
            chunk_idx = doc.metadata.get('chunk_index', 'N/A')
            content = doc.page_content

            # Format for the LLM prompt
            # Use 'Source' and 'Chunk Index' for clarity in the context block
            context_str = f"[{citation_index}] Source: {source} | Chunk Index: {chunk_idx}\n{content}"
            formatted_context_parts.append(context_str)

            # Store data needed for frontend reference display, keyed by the citation number
            temp_map[citation_index] = {
                "source": source,
                "chunk_index": chunk_idx, # Keep original chunk index if available
                "content": content # Store full content for reference expansion/preview later
            }

        formatted_context_text = "\n\n---\n\n".join(formatted_context_parts) if formatted_context_parts else "No context chunks selected after processing."
        context_docs_map = temp_map # Assign the populated map

    except Exception as e:
        logger.error(f"Error during RAG search process for query '{query[:50]}...': {e}", exc_info=True)
        # Reset results on error
        context_docs = []
        formatted_context_text = "Error retrieving context due to an internal server error."
        context_docs_map = {}

    # Return the list of Document objects, the formatted text for the LLM, and the citation map
    return context_docs, formatted_context_text, context_docs_map

# --- MODIFIED: Added logging ---
def synthesize_chat_response(query: str, context_text: str) -> tuple[str, str | None]:
    """
    Generates the final chat response using the LLM, query, and context.
    Requests and parses thinking/reasoning content using SYNTHESIS_PROMPT_TEMPLATE.

    Returns:
        tuple[str, str | None]: (user_answer, thinking_content)
    """
    global llm
    if not llm:
        logger.error("LLM not initialized, cannot synthesize response.")
        return "Error: The AI model is currently unavailable.", None

    # Use the prompt template from config
    # Ensure the prompt template is correctly formatted and expects 'query' and 'context'
    try:
        final_prompt = SYNTHESIS_PROMPT_TEMPLATE.format(query=query, context=context_text)
        # Log the prompt before sending
        logger.info(f"Sending synthesis prompt to LLM (model: {OLLAMA_MODEL})...")
        logger.debug(f"Synthesis Prompt (Start):\n{final_prompt[:200]}...") # Log more chars if needed

    except KeyError as e:
        logger.error(f"Error formatting SYNTHESIS_PROMPT_TEMPLATE: Missing key {e}. Check config.py.")
        return "Error: Internal prompt configuration issue.", None
    except Exception as e:
         logger.error(f"Error creating synthesis prompt: {e}", exc_info=True)
         return "Error: Could not prepare the request for the AI model.", None

    try:
        # logger.info(f"Invoking LLM for chat synthesis (model: {OLLAMA_MODEL})...") # Already logged above
        # Use .invoke() for ChatOllama which returns AIMessage, access content with .content
        response_object = llm.invoke(final_prompt)
        # Ensure response_object has 'content' attribute
        full_llm_response = getattr(response_object, 'content', str(response_object))

        # Log the raw response start
        logger.info(f"LLM synthesis response received (length: {len(full_llm_response)}).")
        logger.debug(f"Synthesis Raw Response (Start):\n{full_llm_response[:200]}...")

        # Parse the response to separate thinking and answer using the utility function
        user_answer, thinking_content = parse_llm_response(full_llm_response)

        if thinking_content:
            logger.info(f"Parsed thinking content (length: {len(thinking_content)}).")
        else:
            # This is expected if the LLM didn't include the tags or the prompt was adjusted
            logger.debug("No <thinking> content found or parsed in the LLM response.")


        if not user_answer and thinking_content:
             logger.warning("Parsed user answer is empty after removing thinking block. The response might have only contained thinking.")
             # Decide how to handle this - return thinking as answer, or a specific message?
             # Let's return a message indicating this.
             user_answer = "[AI response consisted only of reasoning. No final answer provided. See thinking process.]"
        elif not user_answer and not thinking_content:
             logger.error("LLM response parsing resulted in empty answer and no thinking content.")
             user_answer = "[AI Response Processing Error: Empty result after parsing]"


        # Basic check if the answer looks like an error message generated by the LLM itself
        if user_answer.strip().startswith("Error:") or "sorry, I encountered an error" in user_answer.lower():
            logger.warning(f"LLM synthesis seems to have resulted in an error message: '{user_answer[:100]}...'")

        return user_answer.strip(), thinking_content # Return stripped answer and thinking

    except Exception as e:
        logger.error(f"LLM chat synthesis failed: {e}", exc_info=True)
        error_message = f"Sorry, I encountered an error while generating the response ({type(e).__name__}). The AI model might be unavailable, timed out, or failed internally."
        # Attempt to parse thinking even from error if possible? Unlikely to be useful.
        return error_message, None
# --- END MODIFICATION ---

# --- MODIFIED: Added logging ---
def generate_document_analysis(filename: str, analysis_type: str) -> tuple[str | None, str | None]:
    """
    Generates analysis (FAQ, Topics, Mindmap) for a specific document, optionally including thinking.
    Uses ANALYSIS_PROMPTS from config. Retrieves text from cache or disk.

    Returns:
        tuple[str | None, str | None]: (analysis_content, thinking_content)
                                    Returns (error_message, thinking_content) on failure.
                                    Returns (None, None) if document text cannot be found/loaded.
    """
    global llm, document_texts_cache
    logger.info(f"Starting analysis: type='{analysis_type}', file='{filename}'")

    if not llm:
        logger.error("LLM not initialized, cannot perform analysis.")
        return "Error: AI model is not available for analysis.", None

    # --- Step 1: Get Document Text ---
    doc_text = document_texts_cache.get(filename)
    if not doc_text:
        logger.warning(f"Text for '{filename}' not in cache. Attempting load from disk...")
        # Determine the potential path (check uploads first, then defaults)
        potential_paths = [
            os.path.join(UPLOAD_FOLDER, filename),
            os.path.join(DEFAULT_PDFS_FOLDER, filename)
        ]
        load_path = next((p for p in potential_paths if os.path.exists(p)), None)

        if load_path:
            logger.debug(f"Found '{filename}' at: {load_path}")
            doc_text = extract_text_from_pdf(load_path) # Extract fresh if not cached
            if doc_text:
                document_texts_cache[filename] = doc_text # Cache it now
                logger.info(f"Loaded and cached text for '{filename}' from {load_path} for analysis.")
            else:
                logger.error(f"Failed to extract text from '{filename}' at {load_path} even though file exists.")
                # Return specific error if extraction fails
                return f"Error: Could not extract text content from '{filename}'. File might be corrupted or empty.", None
        else:
            logger.error(f"Document file '{filename}' not found in default or upload folders for analysis.")
            # Return error indicating file not found
            return f"Error: Document '{filename}' not found.", None

    # If after all checks, doc_text is still None or empty, something went wrong
    if not doc_text:
        logger.error(f"Analysis failed: doc_text is unexpectedly empty for '{filename}' after cache/disk checks.")
        return f"Error: Failed to retrieve text content for '{filename}'.", None


    # --- Step 2: Prepare Text for LLM (Truncation) ---
    original_length = len(doc_text)
    if original_length > ANALYSIS_MAX_CONTEXT_LENGTH:
        logger.warning(f"Document '{filename}' text too long ({original_length} chars), truncating to {ANALYSIS_MAX_CONTEXT_LENGTH} for '{analysis_type}' analysis.")
        # Truncate from the end, keeping the beginning
        doc_text_for_llm = doc_text[:ANALYSIS_MAX_CONTEXT_LENGTH]
        # Add a clear truncation marker
        doc_text_for_llm += "\n\n... [CONTENT TRUNCATED DUE TO LENGTH LIMIT]"
    else:
        doc_text_for_llm = doc_text
        logger.debug(f"Using full document text ({original_length} chars) for analysis '{analysis_type}'.")

    # --- Step 3: Get Analysis Prompt ---
    prompt_template = ANALYSIS_PROMPTS.get(analysis_type)
    if not prompt_template or not isinstance(prompt_template, PromptTemplate):
        logger.error(f"Invalid or missing analysis prompt template for type: {analysis_type} in config.py")
        return f"Error: Invalid analysis type '{analysis_type}' or misconfigured prompt.", None

    try:
        # Ensure the template expects 'doc_text_for_llm'
        final_prompt = prompt_template.format(doc_text_for_llm=doc_text_for_llm)
        # Log the prompt before sending
        logger.info(f"Sending analysis prompt to LLM (type: {analysis_type}, file: {filename}, model: {OLLAMA_MODEL})...")
        logger.debug(f"Analysis Prompt (Start):\n{final_prompt[:200]}...")

    except KeyError as e:
        logger.error(f"Error formatting ANALYSIS_PROMPTS[{analysis_type}]: Missing key {e}. Check config.py.")
        return f"Error: Internal prompt configuration issue for {analysis_type}.", None
    except Exception as e:
        logger.error(f"Error creating analysis prompt for {analysis_type}: {e}", exc_info=True)
        return f"Error: Could not prepare the request for the {analysis_type} analysis.", None


    # --- Step 4: Call LLM and Parse Response ---
    try:
        # logger.info(f"Invoking LLM for '{analysis_type}' analysis of '{filename}' (model: {OLLAMA_MODEL})...") # Already logged above
        # Use .invoke() for ChatOllama
        response_object = llm.invoke(final_prompt)
        full_analysis_response = getattr(response_object, 'content', str(response_object))

        # Log the raw response start
        logger.info(f"LLM analysis response received for '{filename}' ({analysis_type}). Length: {len(full_analysis_response)}")
        logger.debug(f"Analysis Raw Response (Start):\n{full_analysis_response[:200]}...")

        # Parse potential thinking and main content using the utility function
        analysis_content, thinking_content = parse_llm_response(full_analysis_response)

        if thinking_content:
            logger.info(f"Parsed thinking content from analysis response for '{filename}'.")
        # else: logger.debug(f"No thinking content found in analysis response for '{filename}'.") # Normal if not requested/provided

        if not analysis_content and thinking_content:
            logger.warning(f"Parsed analysis content is empty for '{filename}' ({analysis_type}). Response only contained thinking.")
            analysis_content = "[Analysis consisted only of reasoning. No final output provided. See thinking process.]"
        elif not analysis_content and not thinking_content:
            logger.error(f"LLM analysis response parsing resulted in empty content and no thinking for '{filename}' ({analysis_type}).")
            analysis_content = "[Analysis generation resulted in empty content after parsing.]"


        # Optional: Basic format validation could be added here if needed (e.g., check for Q:/A: in FAQ)

        logger.info(f"Analysis successful for '{filename}' ({analysis_type}).")
        return analysis_content.strip(), thinking_content # Return success tuple

    except Exception as e:
        logger.error(f"LLM analysis invocation error for {filename} ({analysis_type}): {e}", exc_info=True)
        # Try to return error message with thinking if parsing happened before error? Unlikely.
        return f"Error generating analysis: AI model failed ({type(e).__name__}). Check logs for details.", None
# --- END MODIFICATION ---

# --- END OF FILE ai_core.py ---