# server/rag_service/vlm_processor.py
import logging
import ollama  # Use the synchronous client
import config

logger = logging.getLogger(__name__)

VLM_PROMPT_IMAGE = "This image is a cropped visual element (like a diagram, chart, or photograph) from a document. Describe it in detail. Your description should be suitable as an alt-text or a descriptive caption. Start the description directly, without any preamble."
VLM_PROMPT_TABLE = "This image contains a table. Transcribe it accurately into Markdown format. Output only the Markdown table and nothing else."

def process_component_with_vlm_sync(image_bytes: bytes, component_type: str = 'image') -> str:
    """
    Synchronously processes a single cropped component image with the VLM.
    This function is now fully synchronous and thread-safe.
    """
    if not config.OLLAMA_VLM_MODEL:
        raise ValueError("OLLAMA_VLM_MODEL is not configured in the environment.")

    prompt = VLM_PROMPT_TABLE if component_type == 'table' else VLM_PROMPT_IMAGE
    logger.info(f"Processing component of type '{component_type}' with VLM: {config.OLLAMA_VLM_MODEL}")
    
    try:
        # Use the standard, synchronous client
        client = ollama.Client(host=config.OLLAMA_API_BASE_URL)
        response = client.chat(
            model=config.OLLAMA_VLM_MODEL,
            messages=[
                {
                    'role': 'user',
                    'content': prompt,
                    'images': [image_bytes],
                }
            ]
        )
        description = response['message']['content'].strip()
        logger.info(f"Successfully received VLM description for component. Length: {len(description)}")
        
        if component_type == 'image':
            return f"![VLM Description: {description.replace(']', '').replace('[', '')}]"
        return description
        
    except Exception as e:
        logger.error(f"Error calling Ollama VLM for a component: {e}", exc_info=True)
        return f"> **[VLM Error]**: Could not analyze visual component. Reason: {e}"
