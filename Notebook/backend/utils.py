# --- START OF FILE utils.py ---

import re
import logging
import json
import os
from config import ALLOWED_EXTENSIONS

logger = logging.getLogger(__name__)

def allowed_file(filename):
    """Checks if the uploaded file extension is allowed."""
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_llm_response(full_response: str | None) -> tuple[str, str | None]:
    """
    Separates thinking content (within <thinking>...</thinking>) from the user-facing answer.
    Handles potential variations in tagging and whitespace, case-insensitivity.
    Also handles nested tags or attributes within the thinking tag itself.

    Args:
        full_response (str | None): The complete response string from the LLM.

    Returns:
        tuple[str, str | None]: A tuple containing:
            - user_answer (str): The response intended for the user, with thinking tags removed.
            - thinking_content (str | None): The extracted content from within the thinking tags,
                                             or None if tags are not found or input is None.
    """
    if full_response is None:
        # logger.debug("Received None input in parse_llm_response.")
        return "", None
    if not isinstance(full_response, str):
        logger.warning(f"Received non-string input in parse_llm_response: {type(full_response)}. Attempting conversion.")
        try:
            full_response = str(full_response)
        except Exception as e:
            logger.error(f"Could not convert input to string in parse_llm_response: {e}")
            return "", None

    thinking_content = None
    user_answer = full_response # Default to the full response if parsing fails

    # Regex explanation:
    # \s*                         : Matches optional leading whitespace
    # <(?i:thinking)\b[^>]*>     : Matches opening tag <thinking...> case-insensitively, allowing attributes like <thinking plan="step1">. \b ensures "thinking" is a whole word.
    # (.*?)                     : Captures the content inside (non-greedy) - Group 1
    # </(?i:thinking)>          : Matches the corresponding closing tag </thinking> case-insensitively
    # \s*                         : Matches optional trailing whitespace
    # re.DOTALL                 : Makes '.' match newline characters
    # Use non-capturing group (?:...) for the tags themselves if needed, but capture group 1 is for content.
    pattern = re.compile(r"\s*<(?i:thinking)\b[^>]*>(.*?)</(?i:thinking)>\s*", re.DOTALL)

    # Find the first match
    thinking_match = pattern.search(full_response)

    if thinking_match:
        # Group 1 contains the content between the tags
        thinking_content = thinking_match.group(1).strip()
        # logger.debug(f"Extracted thinking content (length: {len(thinking_content)}).")

        # Remove the entire matched block (including tags and surrounding whitespace)
        # Replace only the first occurrence to avoid issues if multiple unexpected tags exist
        user_answer = pattern.sub('', full_response, count=1).strip()
        # logger.debug("Removed thinking block from user answer.")

        # Check if the user_answer is now empty, meaning the thinking block was the only content
        if not user_answer and thinking_content is not None:
            logger.warning("LLM response consisted *only* of the <thinking> block. User answer is empty.")
            # Keep user_answer as "" or set a specific message? Let's keep it empty for now, handled in caller.

    else:
        # logger.debug("No <thinking> tags found in LLM response.")
        user_answer = full_response.strip() # Ensure stripping even if no tags found

    return user_answer, thinking_content


def extract_references(answer_text: str, context_docs_map: dict[int, dict]) -> list[dict]:
    """
    Finds citation markers like [N] in the answer text and maps them back
    to unique source document details using the provided context_docs_map.

    Args:
        answer_text (str): The LLM-generated answer.
        context_docs_map (dict[int, dict]): Maps citation index (int, 1-based) to metadata
                                           e.g., {1: {'source': 'doc.pdf', 'chunk_index': 5, 'content': '...'}}.

    Returns:
        list[dict]: A list of unique reference dictionaries, sorted by source name.
                    Each dict: {'number': N, 'source': 'filename.pdf', 'content_preview': '...'}
    """
    references = []
    # Use source filename as key to ensure uniqueness per *file*, store first citation number found
    seen_sources: dict[str, dict] = {} # { 'filename.pdf': {'number': N, 'source': '...', 'content_preview': '...'} }

    if not isinstance(answer_text, str) or not isinstance(context_docs_map, dict):
         logger.warning(f"Invalid input types for extract_references: answer={type(answer_text)}, map={type(context_docs_map)}.")
         return []
    if not context_docs_map:
        # logger.debug("No context map provided to extract_references.")
        return []

    # Find all occurrences of [N] where N is one or more digits
    try:
        # Use set to get unique citation numbers mentioned in the text
        # Handle various citation patterns like [1], [1, 2], [1][2] by finding individual numbers
        cited_indices = set(int(i) for i in re.findall(r'\[(\d+)\]', answer_text))
    except ValueError:
         logger.warning(f"Found non-integer content within citation markers '[]' in answer text. Ignoring them.")
         # Attempt to find only valid integer ones
         cited_indices = set()
         try:
             cited_indices = set(int(i) for i in re.findall(r'\[(\d+)\]', answer_text))
         except ValueError: # Still failing? Give up.
             logger.error("Could not parse any valid integer citation markers like [N].")
             return []


    if not cited_indices:
        # logger.debug("No valid citation markers [N] found in the answer text.")
        return references

    logger.debug(f"Found unique citation indices mentioned in answer: {sorted(list(cited_indices))}")

    # Iterate through the unique indices found in the text, sorted for deterministic 'first number' selection
    for index in sorted(list(cited_indices)):
        if index not in context_docs_map:
            logger.warning(f"Citation index [{index}] found in answer, but not in provided context map (keys: {list(context_docs_map.keys())}). LLM might be hallucinating or referencing incorrectly.")
            continue

        doc_info = context_docs_map[index]
        source_id = doc_info.get('source') # Expecting filename string

        if not source_id or not isinstance(source_id, str):
             logger.warning(f"Context for citation index [{index}] is missing 'source' metadata or it's not a string ({source_id}). Skipping.")
             continue

        # Only add the reference if this *source file* hasn't been added yet
        if source_id not in seen_sources:
            content = doc_info.get('content', '')
            # Create a concise preview (e.g., first 150 chars), clean newlines for display
            preview = content[:150].strip() + ("..." if len(content) > 150 else "")
            preview = preview.replace('\n', ' ').replace('\r', '').strip() # Remove newlines from preview

            seen_sources[source_id] = {
                "number": index, # Store the *first* citation number encountered for this source
                "source": source_id,
                "content_preview": preview # Store the generated preview
                # Optionally include 'chunk_index': doc_info.get('chunk_index', 'N/A') if needed by frontend
            }
            logger.debug(f"Added reference for source '{source_id}' based on first mention [{index}].")
        # else: # Source already seen, do not add duplicate file reference
            # logger.debug(f"Skipping duplicate reference source: '{source_id}' (already added based on index {seen_sources[source_id]['number']}, current mention index {index})")

    # Convert the seen_sources dict values back to a list
    references = list(seen_sources.values())

    # Sort references alphabetically by source filename for consistent display
    references.sort(key=lambda x: x.get('source', '').lower())

    logger.info(f"Extracted {len(references)} unique source references from answer.")
    return references

def escape_html(unsafe_str: str | None) -> str:
    """Basic HTML escaping for displaying text safely in HTML templates/JS."""
    if unsafe_str is None:
        return ""
    # Ensure input is a string before attempting replace
    if not isinstance(unsafe_str, str):
        try:
            unsafe_str = str(unsafe_str)
        except Exception:
            logger.warning(f"Could not convert value of type {type(unsafe_str)} to string for HTML escaping.")
            return ""

    # Perform replacements
    return unsafe_str.replace('&', '&') \
                     .replace('<', '<') \
                     .replace('>', '>') \
                     .replace('"', '&quot;"') \
                     .replace("'",  '&#39;') # Use HTML entity for single quote for better compatibility

# --- END OF FILE utils.py ---
