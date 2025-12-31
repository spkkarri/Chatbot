# server/rag_service/media_processor.py
import os
import tempfile
import shutil
import logging
from typing import Optional

# --- Tool Imports are now centralized ---
import config

logger = logging.getLogger(__name__)

# --- This top-level block was causing the error and has been REMOVED ---
# if config.PYTESSERACT_AVAILABLE and config.TESSERACT_CMD:
#     config.pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD

def process_uploaded_audio(file_path: str) -> Optional[str]:
    """Transcribes audio content from a given file path."""
    if not config.WHISPER_MODEL_LOADED:
        raise ImportError("Audio processing requires the Whisper model to be loaded.")
    
    logger.info(f"Transcribing audio file: {os.path.basename(file_path)}")
    try:
        result = config.whisper_model.transcribe(file_path, fp16=False)
        transcribed_text = result['text']
        logger.info(f"Transcription complete for audio file. Text length: {len(transcribed_text)}")
        return transcribed_text
    except Exception as e:
        logger.error(f"Whisper error processing audio file {file_path}: {e}")
        raise IOError(f"Failed to transcribe audio file: {e}")

def process_uploaded_video(file_path: str) -> Optional[str]:
    """Extracts audio from a video file and transcribes it using ffmpeg-python."""
    # This dynamic import check is fine because it's inside a function
    try:
        import ffmpeg
    except ImportError:
        raise ImportError("Video processing requires 'ffmpeg-python' and a system installation of ffmpeg.")

    logger.info(f"Processing video file for audio extraction: {os.path.basename(file_path)}")
    temp_dir = tempfile.mkdtemp()
    temp_audio_path = os.path.join(temp_dir, "extracted_audio.wav")
    try:
        (
            ffmpeg
            .input(file_path)
            .output(
                temp_audio_path,
                acodec='pcm_s16le',
                ar=16000,
                ac=1
            )
            .run(cmd=['ffmpeg', '-nostdin'], capture_stdout=True, capture_stderr=True, quiet=True)
        )
        
        logger.info(f"Audio extracted to temporary file. Now transcribing.")
        return process_uploaded_audio(temp_audio_path)
    except ffmpeg.Error as e:
        logger.error(f"FFmpeg error processing video file {file_path}:\n{e.stderr.decode()}")
        raise IOError(f"Failed to extract audio from video using FFmpeg.")
    except Exception as e:
        logger.error(f"General error processing video file {file_path}: {e}")
        raise IOError(f"An unexpected error occurred during video processing: {e}")
    finally:
        shutil.rmtree(temp_dir)

def process_uploaded_image(file_path: str) -> Optional[str]:
    """Performs OCR on an image file to extract text."""
    # --- THIS IS THE FIX ---
    # The check and configuration are moved inside the function.
    try:
        from PIL import Image
        import pytesseract
        
        # This check happens only when the function is called, ensuring config is loaded.
        if config.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD
    except ImportError:
        raise ImportError("Image processing requires 'pytesseract' and 'Pillow'.")
    # --- END OF FIX ---
    
    logger.info(f"Performing OCR on image file: {os.path.basename(file_path)}")
    try:
        img = Image.open(file_path)
        processed_img = img.convert('L')
        text = pytesseract.image_to_string(processed_img)
        logger.info(f"OCR complete for image file. Text length: {len(text)}")
        return text
    except pytesseract.TesseractNotFoundError:
        logger.critical("Tesseract executable not found or not configured correctly in .env via TESSERACT_CMD.")
        raise
    except Exception as e:
        logger.error(f"Pytesseract error processing image file {file_path}: {e}")
        raise IOError(f"Failed to perform OCR on image: {e}")
