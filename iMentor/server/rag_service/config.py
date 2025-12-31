# server/rag_service/config.py
import os
import logging
from dotenv import load_dotenv
from pythonjsonlogger import jsonlogger
from datetime import datetime, timezone

# --- Load .env from the parent 'server' directory ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)


class JsonFormatterWithMilliseconds(jsonlogger.JsonFormatter):
    """
    A custom JSON formatter that correctly formats timestamps with milliseconds and a 'Z' for UTC.
    This overrides the default formatTime method which uses a function that doesn't support %f.
    """
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def setup_logging():
    # ... (logging setup remains the same) ...
    root_logger = logging.getLogger()
    if root_logger.handlers:
        for handler in root_logger.handlers:
            root_logger.removeHandler(handler)

    log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file_path = os.path.join(log_dir, 'python-rag.log')
    
    formatter = JsonFormatterWithMilliseconds(
        '%(asctime)s %(levelname)s %(name)s %(lineno)d %(message)s %(service)s',
        rename_fields={
            'asctime': '@timestamp', 'levelname': 'log.level', 'name': 'log.logger',
            'lineno': 'log.origin.file.line', 'service': 'service.name'
        }
    )
    
    class ServiceContextFilter(logging.Filter):
        def filter(self, record):
            record.levelname = record.levelname.lower()
            record.service = "ai-tutor-python-rag"
            return True

    service_filter = ServiceContextFilter()
    
    file_handler = logging.FileHandler(log_file_path, mode='a')
    file_handler.setFormatter(formatter)
    file_handler.addFilter(service_filter)
    root_logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.addFilter(service_filter)
    root_logger.addHandler(console_handler)
    
    LOGGING_LEVEL = os.getenv('LOGGING_LEVEL', 'INFO').upper()
    root_logger.setLevel(LOGGING_LEVEL)
    
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    init_logger = logging.getLogger(__name__)
    init_logger.info(f"Python logging initialized and standardized. Appending to: {log_file_path}")

setup_logging()
logger = logging.getLogger(__name__)

# --- API Keys and Service URLs ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL_NAME = "gemini-1.5-flash-latest"
# ... (other service URLs remain the same) ...
SENTRY_DSN = os.getenv('SENTRY_DSN')
TURNITIN_API_URL = os.getenv('TURNITIN_API_URL')
TURNITIN_API_KEY = os.getenv('TURNITIN_API_KEY')
TURNITIN_API_SECRET = os.getenv('TURNITIN_API_SECRET')

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 2003))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "my_qdrant_rag_collection")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
QDRANT_URL = os.getenv("QDRANT_URL", None)


# --- THIS IS THE KEY CHANGE ---
# Define embedding models for each provider
# The default model for Gemini path (Hugging Face model)
DEFAULT_GEMINI_EMBED_MODEL = os.getenv('DEFAULT_GEMINI_EMBED_MODEL', 'mixedbread-ai/mxbai-embed-large-v1')
# The model for Ollama path (must be pulled in Ollama)
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large')

# Vector dimension MUST be consistent for the collection
# We base it on the default model, assuming all models used will have the same dimension.
_MODEL_TO_DIM_MAPPING = {
    'mixedbread-ai/mxbai-embed-large-v1': 1024,
    'mxbai-embed-large': 1024, # Ollama model name
    'BAAI/bge-large-en-v1.5': 1024,
}
_FALLBACK_DIM = 1024
DOCUMENT_VECTOR_DIMENSION = int(os.getenv("DOCUMENT_VECTOR_DIMENSION", _MODEL_TO_DIM_MAPPING.get(DEFAULT_GEMINI_EMBED_MODEL, _FALLBACK_DIM)))
QDRANT_COLLECTION_VECTOR_DIM = DOCUMENT_VECTOR_DIMENSION
# --- END OF KEY CHANGE ---


# --- AI Core & Search Configuration ---
AI_CORE_CHUNK_SIZE = int(os.getenv("AI_CORE_CHUNK_SIZE", 512))
AI_CORE_CHUNK_OVERLAP = int(os.getenv("AI_CORE_CHUNK_OVERLAP", 100))
MAX_TEXT_LENGTH_FOR_NER = int(os.getenv("MAX_TEXT_LENGTH_FOR_NER", 500000))
QDRANT_DEFAULT_SEARCH_K = int(os.getenv("QDRANT_DEFAULT_SEARCH_K", 5))
QDRANT_SEARCH_MIN_RELEVANCE_SCORE = float(os.getenv("QDRANT_SEARCH_MIN_RELEVANCE_SCORE", 0.1))

# --- SpaCy Configuration ---
SPACY_MODEL_NAME = os.getenv('SPACY_MODEL_NAME', 'en_core_web_sm')
API_PORT = int(os.getenv('API_PORT', 8001))
TESSERACT_CMD = os.getenv('TESSERACT_CMD') # No default needed, handled in media_processor

# ─── Library Availability Flags & Dynamic Imports ──────────────────────
# ... (These remain the same) ...
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    LANGCHAIN_SPLITTER_AVAILABLE = True
except ImportError: LANGCHAIN_SPLITTER_AVAILABLE, RecursiveCharacterTextSplitter = False, None

# --- REMOVE GLOBAL MODEL PRE-LOADING ---
# The logic to load SentenceTransformer is moved to ai_core.py
# The logic to load Whisper is moved to media_processor.py (or its config section)

# --- SpaCy is still okay to pre-load as it's used universally ---
nlp_spacy_core, SPACY_MODEL_LOADED = None, False
try:
    import spacy
    nlp_spacy_core = spacy.load(SPACY_MODEL_NAME)
    SPACY_MODEL_LOADED = True
except Exception as e:
    logger.warning(f"Failed to load SpaCy model '{SPACY_MODEL_NAME}': {e}")

# Pre-load whisper if available
whisper_model, WHISPER_MODEL_LOADED = None, False
try:
    import whisper
    whisper_model = whisper.load_model("base")
    WHISPER_MODEL_LOADED = True
    logger.info("Successfully pre-loaded Whisper 'base' model.")
except Exception as e:
    logger.warning(f"Failed to pre-load Whisper model: {e}. Transcription will fail.")
