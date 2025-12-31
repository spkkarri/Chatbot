import uuid
import logging
from typing import List, Dict, Tuple, Optional, Any

from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

# Assuming vector_db_service.py and config.py are in the same package directory (e.g., rag_service/)
# and you run your application as a module (e.g., python -m rag_service.main_app)
# or have otherwise correctly set up the Python path.
import config # Changed to relative import

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Document: # For search result formatting
    def __init__(self, page_content: str, metadata: dict):
        self.page_content = page_content
        self.metadata = metadata

    def to_dict(self):
        return {"page_content": self.page_content, "metadata": self.metadata}

class VectorDBService:
    def __init__(self):
        logger.info("Initializing VectorDBService...")
        logger.info(f"  Qdrant Host: {config.QDRANT_HOST}, Port: {config.QDRANT_PORT}, URL: {config.QDRANT_URL}")
        logger.info(f"  Collection: {config.QDRANT_COLLECTION_NAME}")
        logger.info(f"  Query Embedding Model: {config.QUERY_EMBEDDING_MODEL_NAME}")
        
        # The vector dimension for the Qdrant collection is defined by the DOCUMENT embedding model
        # This is set in config.QDRANT_COLLECTION_VECTOR_DIM
        self.vector_dim = config.QDRANT_COLLECTION_VECTOR_DIM
        logger.info(f"  Service expects Vector Dim for Qdrant collection: {self.vector_dim} (from document model config)")

        if config.QDRANT_URL:
            self.client = QdrantClient(
                url=config.QDRANT_URL,
                api_key=config.QDRANT_API_KEY,
                timeout=30
            )
        else:
            self.client = QdrantClient(
                host=config.QDRANT_HOST,
                port=config.QDRANT_PORT,
                api_key=config.QDRANT_API_KEY,
                timeout=30
            )

        try:
            # This model is for encoding search queries.
            # Its output dimension MUST match self.vector_dim (QDRANT_COLLECTION_VECTOR_DIM).
            logger.info(f"  Loading query embedding model: '{config.QUERY_EMBEDDING_MODEL_NAME}'")
            self.model = SentenceTransformer(config.QUERY_EMBEDDING_MODEL_NAME)
            model_embedding_dim = self.model.get_sentence_embedding_dimension()
            logger.info(f"  Query model loaded. Output dimension: {model_embedding_dim}")

            if model_embedding_dim != self.vector_dim:
                error_msg = (
                    f"CRITICAL DIMENSION MISMATCH: Query model '{config.QUERY_EMBEDDING_MODEL_NAME}' "
                    f"outputs embeddings of dimension {model_embedding_dim}, but the Qdrant collection "
                    f"is configured for dimension {self.vector_dim} (derived from document model: "
                    f"'{config.DOCUMENT_EMBEDDING_MODEL_NAME}'). Search functionality will fail. "
                    "Ensure query and document models produce compatible embedding dimensions, "
                    "or environment variables for dimensions are correctly set."
                )
                logger.error(error_msg)
                raise ValueError(error_msg) # Critical error, stop initialization
            else:
                logger.info(f"  Query model output dimension ({model_embedding_dim}) matches "
                            f"Qdrant collection dimension ({self.vector_dim}).")

        except Exception as e:
            logger.error(f"Error initializing SentenceTransformer model '{config.QUERY_EMBEDDING_MODEL_NAME}' for query encoding: {e}", exc_info=True)
            raise # Re-raise to prevent service startup with a non-functional query encoder

        self.collection_name = config.QDRANT_COLLECTION_NAME
        # No ThreadPoolExecutor needed here if document encoding is external

    def _recreate_qdrant_collection(self):
        logger.info(f"Attempting to (re)create collection '{self.collection_name}' with vector size {self.vector_dim}.")
        try:
            self.client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_dim,
                    distance=models.Distance.COSINE,
                ),
            )
            logger.info(f"Collection '{self.collection_name}' (re)created successfully.")
        except Exception as e_recreate:
            logger.error(f"Failed to (re)create collection '{self.collection_name}': {e_recreate}", exc_info=True)
            raise

    def setup_collection(self):
        try:
            collection_info = self.client.get_collection(collection_name=self.collection_name)
            logger.info(f"Collection '{self.collection_name}' already exists.")
            
            # Handle different Qdrant client versions for accessing vector config
            current_vectors_config = None
            if hasattr(collection_info.config.params, 'vectors'): # For simple vector config
                if isinstance(collection_info.config.params.vectors, models.VectorParams):
                     current_vectors_config = collection_info.config.params.vectors
                elif isinstance(collection_info.config.params.vectors, dict): # For named vectors
                    # Assuming default unnamed vector or first one if named
                    default_vector_name = '' # Common for single vector setup
                    if default_vector_name in collection_info.config.params.vectors:
                        current_vectors_config = collection_info.config.params.vectors[default_vector_name]
                    elif collection_info.config.params.vectors: # Get first one if default not found
                        current_vectors_config = next(iter(collection_info.config.params.vectors.values()))

            if not current_vectors_config:
                 logger.error(f"Could not determine vector configuration for existing collection '{self.collection_name}'. Recreating.")
                 self._recreate_qdrant_collection()
            elif current_vectors_config.size != self.vector_dim:
                logger.warning(f"Collection '{self.collection_name}' vector size {current_vectors_config.size} "
                               f"differs from service's expected {self.vector_dim}. Recreating.")
                self._recreate_qdrant_collection()
            elif current_vectors_config.distance != models.Distance.COSINE: # Ensure distance is also checked
                logger.warning(f"Collection '{self.collection_name}' distance {current_vectors_config.distance} "
                               f"differs from expected {models.Distance.COSINE}. Recreating.")
                self._recreate_qdrant_collection()
            else:
                logger.info(f"Collection '{self.collection_name}' configuration is compatible (Size: {current_vectors_config.size}, Distance: {current_vectors_config.distance}).")

        except Exception as e: # Broad exception for Qdrant client errors
            # More specific check for "Not found" type errors
            if "not found" in str(e).lower() or \
               (hasattr(e, 'status_code') and e.status_code == 404) or \
               " ভাগ্যবান" in str(e).lower(): # "Lucky" in Bengali, seems to be part of an error message you encountered
                 logger.info(f"Collection '{self.collection_name}' not found. Attempting to create...")
            else:
                 logger.warning(f"Error checking collection '{self.collection_name}': {type(e).__name__} - {e}. Attempting to (re)create anyway...")
            self._recreate_qdrant_collection()

    def add_processed_chunks(self, processed_chunks: List[Dict[str, Any]]) -> int:
        if not processed_chunks:
            logger.warning("add_processed_chunks received an empty list. No points to upsert.")
            return 0

        points_to_upsert = []
        doc_name_for_logging = "Unknown Document"

        for chunk_data in processed_chunks:
            point_id = chunk_data.get('id', str(uuid.uuid4()))
            vector = chunk_data.get('embedding')
            
            payload = chunk_data.get('metadata', {}).copy()
            payload['chunk_text_content'] = chunk_data.get('text_content', '')

            if not doc_name_for_logging or doc_name_for_logging == "Unknown Document":
                doc_name_for_logging = payload.get('original_name', payload.get('document_name', "Unknown Document"))

            if not vector:
                logger.warning(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' is missing 'embedding'. Skipping.")
                continue
            if not isinstance(vector, list) or not all(isinstance(x, (float, int)) for x in vector): # Allow int too, SentenceTransformer can return float32 which might be int-like in lists
                logger.warning(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' has an invalid 'embedding' format. Skipping.")
                continue
            if len(vector) != self.vector_dim:
                logger.error(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' has embedding dimension {len(vector)}, "
                             f"but collection expects {self.vector_dim}. Skipping. "
                             f"Ensure ai_core's document embedding model ('{config.DOCUMENT_EMBEDDING_MODEL_NAME}') "
                             f"output dimension matches configuration.")
                continue

            points_to_upsert.append(models.PointStruct(
                id=point_id,
                vector=[float(v) for v in vector], # Ensure all are floats for Qdrant
                payload=payload
            ))

        if not points_to_upsert:
            logger.warning(f"No valid points constructed from processed_chunks for document: {doc_name_for_logging}.")
            return 0

        try:
            self.client.upsert(collection_name=self.collection_name, points=points_to_upsert, wait=True) # wait=True can be useful for debugging
            logger.info(f"Successfully upserted {len(points_to_upsert)} chunks for document: {doc_name_for_logging} into Qdrant.")
            return len(points_to_upsert)
        except Exception as e:
            logger.error(f"Error upserting processed chunks to Qdrant for document: {doc_name_for_logging}: {e}", exc_info=True)
            raise

    def search_documents(self, query: str, k: int = -1, filter_conditions: Optional[models.Filter] = None) -> Tuple[List[Document], str, Dict]:
        # Use default k from config if not provided or invalid
        if k <= 0:
            k_to_use = config.QDRANT_DEFAULT_SEARCH_K
        else:
            k_to_use = k

        context_docs = []
        formatted_context_text = "No relevant context was found in the available documents."
        context_docs_map = {}

        logger.info(f"Searching with query (first 50 chars): '{query[:50]}...', k: {k_to_use}")
        if filter_conditions:
            try: filter_dict = filter_conditions.dict()
            except AttributeError: # For older Pydantic versions
                try: filter_dict = filter_conditions.model_dump()
                except AttributeError: filter_dict = str(filter_conditions) # Fallback
            logger.info(f"Applying filter: {filter_dict}")
        else:
            logger.info("No filter applied for search.")

        try:
            query_embedding = self.model.encode(query).tolist()
            logger.debug(f"Generated query_embedding (length: {len(query_embedding)}, first 5 dims: {query_embedding[:5]})")

            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=filter_conditions,
                limit=k_to_use,
                with_payload=True,
                score_threshold=config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE # Apply score threshold directly in search
            )
            logger.info(f"Qdrant client.search returned {len(search_results)} results (after score threshold).")

            if not search_results:
                return context_docs, formatted_context_text, context_docs_map

            for idx, point in enumerate(search_results):
                # Score threshold is already applied by Qdrant if score_threshold parameter is used.
                # If not using score_threshold in client.search, uncomment this:
                # if point.score < config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE:
                #     logger.debug(f"Skipping point ID {point.id} with score {point.score:.4f} (below threshold {config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE})")
                #     continue

                payload = point.payload
                content = payload.get("chunk_text_content", payload.get("text_content", payload.get("chunk_text", "")))

                retrieved_metadata = payload.copy()
                retrieved_metadata["qdrant_id"] = point.id
                retrieved_metadata["score"] = point.score

                doc = Document(page_content=content, metadata=retrieved_metadata)
                context_docs.append(doc)

            # Format context and citations
            formatted_context_parts = []
            for i, doc_obj in enumerate(context_docs):
                citation_index = i + 1
                doc_meta = doc_obj.metadata
                # Use more robust fetching of metadata keys
                display_subject = doc_meta.get("title", doc_meta.get("subject", "Unknown Subject")) # Prefer title for subject
                doc_name = doc_meta.get("original_name", doc_meta.get("file_name", "N/A"))
                page_num_info = f" (Page: {doc_meta.get('page_number', 'N/A')})" if doc_meta.get('page_number') else "" # Add page number if available
                
                content_preview = doc_obj.page_content[:200] + "..." if len(doc_obj.page_content) > 200 else doc_obj.page_content

                formatted = (f"[{citation_index}] Score: {doc_meta.get('score', 0.0):.4f} | "
                             f"Source: {doc_name}{page_num_info} | Subject: {display_subject}\n"
                             f"Content: {content_preview}") # Show content preview
                formatted_context_parts.append(formatted)

                context_docs_map[str(citation_index)] = {
                    "subject": display_subject,
                    "document_name": doc_name,
                    "page_number": doc_meta.get("page_number"),
                    "content_preview": content_preview, # Store preview
                    "full_content": doc_obj.page_content, # Store full content for potential later use
                    "score": doc_meta.get("score", 0.0),
                    "qdrant_id": doc_meta.get("qdrant_id"),
                    "original_metadata": doc_meta # Store all original metadata from payload
                }
            if formatted_context_parts:
                formatted_context_text = "\n\n---\n\n".join(formatted_context_parts)
            else:
                formatted_context_text = "No sufficiently relevant context was found after filtering."

        except Exception as e:
            logger.error(f"Qdrant search/RAG error: {e}", exc_info=True)
            formatted_context_text = "Error retrieving context due to an internal server error."

        return context_docs, formatted_context_text, context_docs_map
    
    # Add this method to the VectorDBService class in vector_db_service.py

    def delete_document_vectors(self, user_id: str, document_name: str) -> Dict[str, Any]:
        logger.info(f"Attempting to delete vectors for document: '{document_name}', user: '{user_id}' from Qdrant collection '{self.collection_name}'.")
        
        # These metadata keys must match what's stored during ingestion from ai_core.py
        # 'processing_user' was the user_id passed to ai_core
        # 'file_name' was the original_name passed to ai_core
        qdrant_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id)
                ),
                models.FieldCondition(
                    key="file_name",
                    match=models.MatchValue(value=document_name)
                )
            ]
        )
        
        try:
            # Optional: Count points before deleting for logging/confirmation
            # count_response = self.client.count(collection_name=self.collection_name, count_filter=qdrant_filter)
            # num_to_delete = count_response.count
            # logger.info(f"Qdrant: Found {num_to_delete} points matching criteria for document '{document_name}', user '{user_id}'.")

            # if num_to_delete == 0:
            #     logger.info(f"Qdrant: No points found to delete for document '{document_name}', user '{user_id}'.")
            #     return {"success": True, "message": "No matching vectors found in Qdrant to delete.", "deleted_count": 0}

            delete_result = self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=qdrant_filter),
                wait=True # Make it synchronous
            )
            
            # Check the status of the delete operation
            # delete_result should be an UpdateResult object
            if delete_result.status == models.UpdateStatus.COMPLETED or delete_result.status == models.UpdateStatus.ACKNOWLEDGED:
                # The actual number of deleted points isn't directly returned by filter-based delete.
                # We can infer it was successful if no error.
                # For a precise count, you'd need to list IDs by filter, then delete by IDs.
                logger.info(f"Qdrant delete operation for document '{document_name}', user '{user_id}' acknowledged/completed. Status: {delete_result.status}")
                return {"success": True, "message": f"Qdrant vector deletion for document '{document_name}' completed. Status: {delete_result.status}."}
            else:
                logger.warning(f"Qdrant delete operation for document '{document_name}', user '{user_id}' returned status: {delete_result.status}")
                return {"success": False, "message": f"Qdrant delete operation status: {delete_result.status}"}

        except Exception as e:
            logger.error(f"Error deleting document vectors from Qdrant for document '{document_name}', user '{user_id}': {e}", exc_info=True)
            # Check for specific Qdrant client errors if possible, e.g., if the collection doesn't exist.
            return {"success": False, "message": f"Failed to delete Qdrant vectors: {str(e)}"}

    def close(self):
        logger.info("VectorDBService close called.")
        # No specific resources like ThreadPoolExecutor to release in this version.
        # QdrantClient does not have an explicit close() method in recent versions.