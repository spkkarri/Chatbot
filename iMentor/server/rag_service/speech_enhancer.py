# server/rag_service/speech_enhancer.py
import speech_recognition as sr
import logging
import io

logger = logging.getLogger(__name__)

recognizer = sr.Recognizer()

def transcribe_audio_from_wav_bytes(audio_bytes: bytes) -> str:
    """
    Transcribes audio from an in-memory WAV byte buffer using Google's free API.
    Note: The input MUST be WAV format bytes.
    """
    logger.info("Transcribing audio using SpeechRecognition (Google Web Speech API free tier)...")
    try:
        # The library's AudioFile class can read from a file-like object (the byte buffer)
        with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            logger.info(f"Transcription successful. Length: {len(text)}")
            return text
    except sr.UnknownValueError:
        logger.warning("Google Speech Recognition could not understand audio.")
        raise ValueError("Could not understand the audio. It may be silent or unclear.")
    except sr.RequestError as e:
        logger.error(f"Could not request results from Google Speech Recognition service; {e}")
        raise ConnectionError(f"Speech recognition service request failed: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred during transcription: {e}", exc_info=True)
        raise

ENHANCEMENT_PROMPT_TEMPLATE = """
You are an expert academic editor and content strategist.
You have been given a raw, unedited transcription of a spoken audio clip. You also have the full source document the speaker was referencing.

Your task is to **enhance the raw transcription** into a polished, professional, and insightful script. You MUST adhere to these rules:
1.  **Correct Errors:** Fix any grammatical errors, stutters, or awkward phrasing from the raw transcription.
2.  **Add Academic Depth:** Seamlessly integrate key facts, data, or concepts from the provided **SOURCE DOCUMENT TEXT** to add depth and accuracy to the speaker's points.
3.  **Maintain Speaker's Voice:** The output should still sound like a natural, spoken script, not a dense academic paper. Keep the original intent and tone.
4.  **Output Only the Polished Script:** Your entire response must be ONLY the final, enhanced script text. Do not include any preambles like "Here is the enhanced script:".

---
**SOURCE DOCUMENT TEXT (Your knowledge base):**
{source_document_text}
---
**RAW AUDIO TRANSCRIPTION (To be enhanced):**
{raw_transcription}
---

**FINAL, ENHANCED SCRIPT (Start immediately with the first sentence):**
"""

def enhance_script_with_llm(raw_transcription: str, source_document_text: str, llm_function) -> str:
    """Uses an LLM to enhance a raw transcription with context from a source document."""
    logger.info("Enhancing transcribed script using LLM...")
    
    prompt = ENHANCEMENT_PROMPT_TEMPLATE.format(
        source_document_text=source_document_text[:40000], # Limit context to avoid excessive token usage
        raw_transcription=raw_transcription
    )
    
    enhanced_script = llm_function(prompt)
    if not enhanced_script or not enhanced_script.strip():
        raise ValueError("LLM failed to generate the enhanced script.")
        
    logger.info(f"LLM generated enhanced script. Length: {len(enhanced_script)}")
    return enhanced_script