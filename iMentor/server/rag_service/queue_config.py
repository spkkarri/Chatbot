# server/rag_service/queue_config.py
import redis
import logging
import config

logger = logging.getLogger(__name__)

# BullMQ adds a "bull:" prefix to queue names in Redis.
DOCUMENT_PROCESSING_QUEUE_NAME = "bull:document-processing:waiting"

redis_client = None
try:
    # Use the same REDIS_URL from your .env file
    redis_client = redis.from_url(config.REDIS_URL)
    # Ping the server to ensure a connection is established.
    redis_client.ping()
    logger.info("Successfully connected to Redis for job queue.")
except Exception as e:
    logger.critical(f"CRITICAL: Could not connect to Redis at {config.REDIS_URL}. The worker cannot start. Error: {e}")
    redis_client = None

def get_redis_client():
    """Returns the initialized Redis client instance."""
    if not redis_client:
        raise ConnectionError("Redis client is not available.")
    return redis_client
