# server/rag_service/ai_core.py
import logging
import os
import io
import re
import copy
import uuid
from typing import Any, Callable, Dict, List, Optional, Union
from datetime import datetime

logger = logging.getLogger(__name__)

# --- Configuration and Dynamic Imports ---
try:
    # --- THIS IS THE FIX: Standardize the import ---
    from rag_service import config
    # --- END OF FIX ---
    from sentence_transformers import SentenceTransformer
    import ollama
except ImportError as e:
    logger.critical(f"CRITICAL: Failed to import dependencies for ai_core: {e}.")
    raise

# --- IN-MEMORY CACHE FOR EMBEDDING MODELS ---
_model_cache = {}

def get_embedding_model(provider: str):
    """Dynamically loads and caches embedding models."""
    if provider in _model_cache:
        return _model_cache[provider]
    
    if provider == 'ollama':
        model_name = config.OLLAMA_EMBED_MODEL
        logger.info(f"Checking for Ollama embedding model via API: '{model_name}'")
        try:
            ollama.show(model_name)
            _model_cache[provider] = model_name
            return model_name
        except ollama.ResponseError as e:
            logger.error(f"Ollama embedding model '{model_name}' not found. Please run 'ollama pull {model_name}'. Error: {e}")
            raise
    else: # Default to Gemini/HuggingFace path
        model_name = config.DEFAULT_GEMINI_EMBED_MODEL
        logger.info(f"Loading SentenceTransformer embedding model: '{model_name}'")
        model = SentenceTransformer(model_name)
        _model_cache[provider] = model
        return model

def generate_segment_embeddings(document_chunks: List[Dict[str, Any]], llm_provider: str) -> List[Dict[str, Any]]:
    if not document_chunks:
        return []
    
    try:
        model = get_embedding_model(llm_provider)
    except Exception as e:
        logger.error(f"Failed to get or validate embedding model for provider '{llm_provider}': {e}")
        for chunk_dict in document_chunks: chunk_dict['embedding'] = None
        return document_chunks

    model_name_for_logging = model if isinstance(model, str) else config.DEFAULT_GEMINI_EMBED_MODEL
    logger.info(f"Embedding {len(document_chunks)} chunks using '{llm_provider}' pipeline (model: '{model_name_for_logging}').")
    
    texts_to_embed = [chunk.get('text_content', '') for chunk in document_chunks]
    valid_chunks_indices = [i for i, text in enumerate(texts_to_embed) if text.strip()]
    texts_to_embed = [text for text in texts_to_embed if text.strip()]

    if not texts_to_embed:
        logger.warning("Embedding: No text content found in chunks to generate embeddings.")
        return document_chunks

    try:
        if llm_provider == 'ollama':
            embeddings_list = []
            for text in texts_to_embed:
                response = ollama.embeddings(model=model, prompt=text)
                embeddings_list.append(response['embedding'])
        else:
            embeddings_np_array = model.encode(texts_to_embed, show_progress_bar=False)
            embeddings_list = embeddings_np_array.tolist()
        
        embedding_idx = 0
        for i, chunk_dict in enumerate(document_chunks):
            if i in valid_chunks_indices:
                chunk_dict['embedding'] = embeddings_list[embedding_idx]
                embedding_idx += 1
            else:
                chunk_dict['embedding'] = None
        
        logger.info(f"Embedding: Generated and assigned embeddings to {len(embeddings_list)} chunks.")

    except Exception as e_embed:
        logger.error(f"Embedding: Error during generation with '{llm_provider}' pipeline: {e_embed}", exc_info=True)
        for chunk_dict in document_chunks:
            chunk_dict['embedding'] = None
            
    return document_chunks

def process_document_for_qdrant(
    file_path: str,
    original_name: str,
    user_id: str,
    llm_provider: str,
    text_content_override: Optional[str] = None
) -> tuple[List[Dict[str, Any]], Optional[str], List[Dict[str, Any]]]:
    logger.info(f"ai_core: Orchestrating document processing for '{original_name}' using '{llm_provider}' provider.")
    
    if not text_content_override and not (file_path and os.path.exists(file_path)):
        logger.error(f"File not found or no text override provided: {file_path}")
        return [], None, []

    try:
        # --- THIS IS THE FIX: Use the correct package-relative import ---
        from rag_service.file_parser import parse_file, chunk_text
        # --- END OF FIX ---

        text_for_further_processing = parse_file(file_path) if not text_content_override else text_content_override
        if not text_for_further_processing:
            logger.warning(f"Parsing of '{original_name}' yielded no text content.")
            return [], None, []

        raw_text_for_node_analysis = text_for_further_processing
        
        # Chunking is now done with a function that creates Langchain Documents
        langchain_docs = chunk_text(text_for_further_processing, original_name, user_id)
        
        # Convert Langchain Documents to the dictionary format expected by the rest of the pipeline
        chunks_with_metadata = [{
            'id': str(uuid.uuid4()),
            'text_content': doc.page_content,
            'metadata': doc.metadata
        } for doc in langchain_docs]

        if not chunks_with_metadata:
            logger.warning(f"No chunks produced for {original_name}.")
            return [], raw_text_for_node_analysis, []

        chunks_for_kg_worker = copy.deepcopy(chunks_with_metadata)
        
        final_chunks_for_qdrant = generate_segment_embeddings(
            chunks_with_metadata,
            llm_provider
        )
        
        logger.info(f"ai_core: Successfully processed '{original_name}'. Generated {len(final_chunks_for_qdrant)} chunks for Qdrant.")
        return final_chunks_for_qdrant, raw_text_for_node_analysis, chunks_for_kg_worker

    except Exception as e:
        logger.error(f"ai_core: Critical error processing {original_name}: {e}", exc_info=True)
        raise
