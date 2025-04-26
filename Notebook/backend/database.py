# --- START OF FILE database.py ---

import sqlite3
import logging
import json
import uuid
from datetime import datetime, timezone
from config import DATABASE_PATH

logger = logging.getLogger(__name__)

def get_db_connection():
    """Establishes a connection to the SQLite database with WAL mode and timeout."""
    conn = None # Initialize conn to None
    try:
        # check_same_thread=False is needed for Flask's multi-threaded request handling
        # timeout is in seconds
        conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False, timeout=10)
        conn.row_factory = sqlite3.Row # Return rows as dictionary-like objects
        # Enable Write-Ahead Logging for better concurrency
        conn.execute("PRAGMA journal_mode=WAL;")
        # Set busy timeout (milliseconds) to wait if DB is locked
        conn.execute("PRAGMA busy_timeout = 8000;") # 8 seconds
        conn.execute("PRAGMA foreign_keys = ON;") # Enforce foreign key constraints
        logger.debug(f"Database connection established to {DATABASE_PATH} (WAL mode)")
        return conn
    except sqlite3.Error as e:
        logger.error(f"Database connection error to {DATABASE_PATH}: {e}", exc_info=True)
        if conn:
            conn.close() # Ensure connection is closed on error during establishment
        raise # Re-raise the error

def init_db():
    """Initializes the database schema if tables don't exist."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        logger.info(f"Initializing database schema in '{DATABASE_PATH}'...")

        # Get existing columns to handle potential schema migrations gracefully
        cursor.execute("PRAGMA table_info(messages)")
        existing_columns = {row['name'] for row in cursor.fetchall()}
        logger.debug(f"Existing columns in 'messages' table: {existing_columns}")

        # Create messages table if it doesn't exist
        # Use TEXT for timestamp, store as ISO8601 UTC string
        # Ensure PRIMARY KEY constraint is correctly defined
        # Ensure CHECK constraint uses correct quotes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                message_id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL,
                sender TEXT NOT NULL CHECK(sender IN ('user', 'bot')),
                message_text TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')), -- Store as UTC ISO8601 text
                references_json TEXT, -- JSON string for references
                cot_reasoning TEXT    -- Store <thinking> content here
            )
        ''')
        logger.info("Table 'messages' checked/created.")

        # Add columns if they don't exist (simple migration)
        if 'references_json' not in existing_columns:
            cursor.execute("ALTER TABLE messages ADD COLUMN references_json TEXT")
            logger.info("Added 'references_json' column to messages table.")
        if 'cot_reasoning' not in existing_columns:
            cursor.execute("ALTER TABLE messages ADD COLUMN cot_reasoning TEXT") # Stores <thinking> content
            logger.info("Added 'cot_reasoning' column to messages table.")
        # Add timestamp column if migrating from an older schema without it
        if 'timestamp' not in existing_columns:
             # Add with default for new rows, existing rows will be NULL initially
             # Make sure it's NOT NULL with a DEFAULT
             cursor.execute("ALTER TABLE messages ADD COLUMN timestamp TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))")
             logger.info("Added 'timestamp' column to messages table.")


        # Index on session_id and timestamp for efficient history retrieval
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_timestamp ON messages (session_id, timestamp);")
        logger.info("Index 'idx_session_timestamp' checked/created.")

        conn.commit()
        logger.info(f"Database '{DATABASE_PATH}' schema initialization/update complete.")

    except sqlite3.Error as e:
        logger.error(f"Database schema initialization/update error: {e}", exc_info=True)
        if conn:
            conn.rollback()
        # Do not raise here if the app should try to continue without DB
        # raise # Re-raise critical error if DB is mandatory
    finally:
        if conn:
            conn.close()
            logger.debug("Database connection closed after init/update.")

def save_message(session_id: str, sender: str, message_text: str, references: list | dict | None = None, cot_reasoning: str | None = None) -> str | None:
    """Saves a chat message to the database.

    Args:
        session_id (str): The session identifier.
        sender (str): 'user' or 'bot'.
        message_text (str): The content of the message.
        references (list | dict | None): Structured reference list/dict for bot messages.
                                         Stored as JSON string.
        cot_reasoning (str | None): The thinking/reasoning content (<thinking> block).

    Returns:
        The generated message_id if successful, otherwise None.
    """
    if not session_id or not sender or message_text is None: # Basic validation
        logger.error(f"Attempted to save message with invalid arguments: session={session_id}, sender={sender}")
        return None

    message_id = str(uuid.uuid4())
    # Ensure references are stored as JSON string, handle None or empty list/dict
    references_json = None
    if references:
        try:
            references_json = json.dumps(references)
        except TypeError as e:
            logger.error(f"Could not serialize references to JSON for session {session_id}: {e}. Storing as null.")
            references_json = None # Fallback to null

    # Timestamp is handled by DEFAULT in SQL for consistency

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Timestamp column uses DEFAULT defined in CREATE TABLE
        cursor.execute(
            """
            INSERT INTO messages
            (message_id, session_id, sender, message_text, references_json, cot_reasoning)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (message_id, session_id, sender, message_text, references_json, cot_reasoning) # Pass cot_reasoning here
        )
        conn.commit()
        logger.info(f"Saved message '{message_id}' for session {session_id} (Sender: {sender})")
        return message_id
    except sqlite3.IntegrityError as e:
        # More specific error logging
        if "PRIMARY KEY" in str(e):
            logger.error(f"Database integrity error (Duplicate message_id? {message_id}) saving message for session {session_id}: {e}", exc_info=False)
        elif "CHECK constraint" in str(e):
             logger.error(f"Database integrity error (Invalid sender '{sender}'?) saving message for session {session_id}: {e}", exc_info=False)
        else:
            logger.error(f"Database integrity error saving message for session {session_id}: {e}", exc_info=True)
        if conn: conn.rollback()
        return None
    except sqlite3.Error as e:
        logger.error(f"Database error saving message for session {session_id}: {e}", exc_info=True)
        if conn: conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_messages_by_session(session_id: str) -> list[dict] | None:
    """Retrieves all messages for a given session ID, ordered by timestamp.

    Args:
        session_id (str): The session identifier.

    Returns:
        A list of message dictionaries, or None if a database error occurs.
        Returns an empty list if the session exists but has no messages.
        Each dictionary includes 'thinking' (from cot_reasoning) and parsed 'references'.
    """
    messages = []
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Select all relevant columns, including cot_reasoning
        cursor.execute(
            """
            SELECT message_id, session_id, sender, message_text, references_json, cot_reasoning, timestamp
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC -- Use the stored ISO8601 timestamp string
            """,
            (session_id,)
        )
        messages_raw = cursor.fetchall()
        logger.debug(f"Fetched {len(messages_raw)} raw messages for session {session_id}")

        for row in messages_raw:
            message_data = dict(row) # Convert Row object to dict

            # Safely parse JSON references
            parsed_refs = [] # Default to empty list
            try:
                ref_json = message_data.pop('references_json', None) # Remove raw JSON field
                if ref_json:
                    # Parse the JSON
                    parsed_data = json.loads(ref_json)
                    # Ensure the final result is a list of dicts if possible
                    if isinstance(parsed_data, list):
                         parsed_refs = parsed_data
                    elif isinstance(parsed_data, dict):
                         # If it was stored as dict {ref_num: data}, convert to list [data]
                         parsed_refs = list(parsed_data.values())
                    else:
                         logger.warning(f"Parsed references JSON for msg {message_data['message_id']} was unexpected type: {type(parsed_data)}. Storing empty list.")

            except json.JSONDecodeError as json_err:
                 logger.warning(f"Could not parse references_json for message {message_data['message_id']} in session {session_id}: {json_err}")
            except Exception as e:
                logger.error(f"Unexpected error processing references for message {message_data['message_id']}: {e}", exc_info=True)

            message_data['references'] = parsed_refs # Assign the processed list

            # Rename cot_reasoning to thinking for frontend consistency
            # Use get() with default None in case the column didn't exist in older rows
            message_data['thinking'] = message_data.pop('cot_reasoning', None)

            # Ensure timestamp is returned as ISO 8601 string (already stored correctly)
            # Validate or provide default if missing/null (shouldn't happen with schema)
            if 'timestamp' not in message_data or not message_data['timestamp']:
                 logger.warning(f"Missing or empty timestamp for message {message_data['message_id']}. Setting to epoch.")
                 # Provide a valid ISO string as default
                 message_data['timestamp'] = datetime.fromtimestamp(0, timezone.utc).isoformat().replace('+00:00', 'Z')


            messages.append(message_data)

        # logger.info(f"Retrieved and processed {len(messages)} messages for session {session_id}")
        return messages

    except sqlite3.Error as e:
        logger.error(f"Database error fetching history for session {session_id}: {e}", exc_info=True)
        return None # Indicate database error
    except Exception as e:
         logger.error(f"Unexpected error processing history for session {session_id}: {e}", exc_info=True)
         return None
    finally:
        if conn:
            conn.close()

# --- END OF FILE database.py ---