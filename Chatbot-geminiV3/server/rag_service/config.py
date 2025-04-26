# server/rag_service/config.py
import os
import sys

# --- Determine Server Directory ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..')) # Path to the 'server' directory
print(f"[rag_service/config.py] Determined SERVER_DIR: {SERVER_DIR}")

# --- Embedding Model Configuration ---
# Switch to Sentence Transformer
EMBEDDING_TYPE = 'sentence-transformer'
# Specify the model name (make sure you have internet access for download on first run)
# Or choose another model compatible with sentence-transformers library
# EMBEDDING_MODEL_NAME_ST = os.getenv('SENTENCE_TRANSFORMER_MODEL', 'BAAI/bge-large-en-v1.5')
EMBEDDING_MODEL_NAME_ST = os.getenv('SENTENCE_TRANSFORMER_MODEL', 'mixedbread-ai/mxbai-embed-large-v1')
# EMBEDDING_MODEL_NAME_ST = os.getenv('SENTENCE_TRANSFORMER_MODEL', 'e5-large-v2')
EMBEDDING_MODEL_NAME = EMBEDDING_MODEL_NAME_ST
print(f"Using Sentence Transformer model: {EMBEDDING_MODEL_NAME}")

# --- FAISS Configuration ---
FAISS_INDEX_DIR = os.path.join(SERVER_DIR, 'faiss_indices')
DEFAULT_ASSETS_DIR = os.path.join(SERVER_DIR, 'default_assets', 'engineering')
DEFAULT_INDEX_USER_ID = '__DEFAULT__'

# --- Text Splitting Configuration ---
CHUNK_SIZE = 512#1000
CHUNK_OVERLAP = 100#150

# --- API Configuration ---
RAG_SERVICE_PORT = int(os.getenv('RAG_SERVICE_PORT', 5002))

# --- Print effective configuration ---
print(f"FAISS Index Directory: {FAISS_INDEX_DIR}")
print(f"Default Assets Directory (for default.py): {DEFAULT_ASSETS_DIR}")
print(f"RAG Service Port: {RAG_SERVICE_PORT}")
print(f"Default Index User ID: {DEFAULT_INDEX_USER_ID}")
print(f"Chunk Size: {CHUNK_SIZE}, Chunk Overlap: {CHUNK_OVERLAP}")


