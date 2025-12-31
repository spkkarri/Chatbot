# server/rag_service/quiz_utils.py
import os
import logging
import config  # Use relative import

logger = logging.getLogger(__name__)

# --- THIS IS THE FIX ---
# Set a reasonable character limit to prevent extremely long LLM calls.
# 50,000 characters is roughly 10,000-12,000 words, which is more than enough
# context for a high-quality quiz without excessive processing time.
MAX_TEXT_LEN_FOR_QUIZ = 50000

def extract_text_for_quiz(file_path: str) -> str:
    """
    A lightweight, fast text extractor for quiz generation.
    It supports PDF, DOCX, and TXT files.
    Bypasses heavy processing like OCR, embedding, etc. for speed.
    """
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    text_content = ""
    
    logger.info(f"Quiz Utils: Extracting text from '{os.path.basename(file_path)}' (type: {ext})")

    try:
        if ext == '.pdf':
            if config.PYPDF_AVAILABLE and config.pypdf:
                reader = config.pypdf.PdfReader(file_path)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
            else:
                logger.warning("pypdf library not available for PDF parsing in quiz utility.")
        
        elif ext == '.docx':
            if config.DOCX_AVAILABLE and config.DocxDocument:
                doc = config.DocxDocument(file_path)
                text_content = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            else:
                logger.warning("python-docx library not available for DOCX parsing in quiz utility.")

        elif ext in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text_content = f.read()
        
        else:
            logger.warning(f"Unsupported file type for quick quiz extraction: {ext}. Returning empty text.")
            return ""

        # --- THIS IS THE FIX ---
        if len(text_content) > MAX_TEXT_LEN_FOR_QUIZ:
            logger.warning(f"Quiz Utils: Document text length ({len(text_content)}) exceeds limit ({MAX_TEXT_LEN_FOR_QUIZ}). Truncating text for performance.")
            text_content = text_content[:MAX_TEXT_LEN_FOR_QUIZ]
        # --- END OF FIX ---
        
        logger.info(f"Quiz Utils: Successfully extracted {len(text_content)} characters.")
        return text_content.strip()

    except Exception as e:
        logger.error(f"Quiz Utils: Failed to extract text from '{os.path.basename(file_path)}': {e}", exc_info=True)
        return "" # Return empty string on failure