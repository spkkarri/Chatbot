# server/rag_service/knowledge_engine.py
import os
import re
import tempfile
import shutil
import logging
import time
from typing import Tuple, Optional

# --- Tool Imports ---
# REMOVE the local try/except blocks for imports. We now rely on config.
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

# --- THIS IS THE FIX: Import the central config ---
import config
# --- END OF FIX ---

logger = logging.getLogger(__name__)


# --- YouTube Processing ---
def _extract_youtube_text(url: str) -> Tuple[Optional[str], Optional[str]]:
    # --- FIX: Reference config for availability and library objects ---
    if not config.YTDLP_AVAILABLE or not config.WHISPER_MODEL_LOADED:
        raise ImportError("YouTube processing requires 'yt-dlp' and the Whisper model to be loaded.")
    # --- END FIX ---
    
    logger.info(f"Processing YouTube URL: {url}")
    temp_dir = tempfile.mkdtemp()
    try:
        audio_filename_template = os.path.join(temp_dir, 'audio.%(ext)s')
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': audio_filename_template,
            'noplaylist': True,
            'quiet': True,
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'wav'}],
        }

        # --- FIX: Reference config for library object ---
        with config.yt_dlp.YoutubeDL(ydl_opts) as ydl:
        # --- END FIX ---
            info_dict = ydl.extract_info(url, download=True)
            video_title = info_dict.get('title', 'YouTube Video')
            audio_file_path = os.path.join(temp_dir, 'audio.wav')

        logger.info(f"Transcribing audio for '{video_title}' with Whisper...")
        result = config.whisper_model.transcribe(audio_file_path, fp16=False)
        transcribed_text = result['text']
        
        logger.info(f"Transcription complete for '{video_title}'. Text length: {len(transcribed_text)}")
        return transcribed_text, video_title
    except Exception as e:
        logger.error(f"yt-dlp/whisper error processing URL {url}: {e}")
        raise ConnectionError(f"Failed to process YouTube video: {e}")
    finally:
        shutil.rmtree(temp_dir)

# --- Webpage Content Processing ---
def _extract_webpage_text(url: str, retries: int = 2) -> Tuple[Optional[str], Optional[str]]:
    # --- FIX: Reference config for availability and library objects ---
    if not config.PLAYWRIGHT_AVAILABLE or not config.BS4_AVAILABLE:
        raise ImportError("Webpage processing requires 'playwright' and 'beautifulsoup4'.")
    # --- END FIX ---

    logger.info(f"Processing webpage URL: {url}")
    
    for attempt in range(retries):
        logger.info(f"Scraping attempt {attempt + 1}/{retries} for URL: {url}")
        try:
            # --- FIX: Reference config for library object ---
            with config.sync_playwright() as p:
            # --- END FIX ---
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                )
                page = context.new_page()
                page.goto(url, wait_until='load', timeout=45000)
                
                page_title = page.title() or url
                html_content = page.content()
                browser.close()

                logger.info(f"Successfully fetched content for '{page_title}'")
                
                # --- FIX: Reference config for library object ---
                soup = config.BeautifulSoup(html_content, "html.parser")
                # --- END FIX ---
                for element in soup(["script", "style", "nav", "footer", "aside", "header", "form", "button", "iframe"]):
                    element.decompose()
                
                body = soup.find('body')
                if body:
                    text = body.get_text(separator='\n', strip=True)
                    cleaned_text = re.sub(r'\n{3,}', '\n\n', text)
                else:
                    cleaned_text = ""
                
                logger.info(f"Extracted and cleaned text from '{page_title}'. Length: {len(cleaned_text)}")
                return cleaned_text, page_title

        except PlaywrightTimeoutError as e:
            logger.warning(f"Attempt {attempt + 1} timed out for URL {url}. Error: {e}")
            if attempt + 1 == retries:
                logger.error(f"All {retries} scraping attempts failed for URL {url}.")
                raise ConnectionError(f"Failed to scrape webpage after {retries} attempts: Timeout")
            time.sleep(2)
        except Exception as e:
            logger.error(f"Playwright/BS4 error on attempt {attempt + 1} for URL {url}: {e}")
            if attempt + 1 == retries:
                 raise ConnectionError(f"Failed to scrape webpage after {retries} attempts: {e}")
            time.sleep(2)

# --- Main Orchestrator for URLs ---
def process_url_source(url: str, user_id: str) -> Tuple[Optional[str], str, str]:
    # ... (rest of the function is the same, no changes needed here)
    logger.info(f"Knowledge Engine: Orchestrating URL processing for '{url}'")
    
    raw_text, final_title, source_type = None, url, 'webpage'
    youtube_regex = (
        r'(https?://)?(www\.)?'
        '(youtube|youtu|youtube-nocookie)\.(com|be)/'
        '(watch\?v=|embed/|v/|.+\?v=)?([^&=%\?]{11})')
    is_youtube = re.match(youtube_regex, url)

    if is_youtube:
        source_type = 'youtube'
        raw_text, final_title = _extract_youtube_text(url)
    else:
        source_type = 'webpage'
        raw_text, final_title = _extract_webpage_text(url)

    if not raw_text:
        return None, final_title, source_type

    cleaned_text = re.sub(r'\s+', ' ', raw_text).strip()
    
    logger.info(f"Successfully processed URL '{url}'. Title: '{final_title}'. Type: '{source_type}'.")
    return cleaned_text, final_title, source_type
