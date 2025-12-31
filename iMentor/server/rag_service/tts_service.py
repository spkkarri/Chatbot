# server/rag_service/tts_service.py
import torch
from TTS.api import TTS
import logging
from pydub import AudioSegment
import io
import os

logger = logging.getLogger(__name__)

# --- Model Configuration ---
# Using the dedicated Indian English model.
MODEL_NAME = "tts_models/en/ljspeech/vits--neon"

tts_instance = None

def initialize_tts():
    """
    Initializes the Coqui TTS model once at application startup.
    """
    global tts_instance
    if tts_instance is None:
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Initializing Coqui TTS with Indian English model '{MODEL_NAME}' on device: {device}")
            
            tts_instance = TTS(MODEL_NAME).to(device)
            
            logger.info("Coqui TTS Indian English model loaded successfully and is ready for synthesis.")
        except Exception as e:
            logger.critical(f"FATAL: Could not initialize Coqui TTS model. High-quality podcast generation will be unavailable. Error: {e}", exc_info=True)

def synthesize_speech(text: str, speaker: str) -> AudioSegment:
    """
    Synthesizes speech and applies pitch shifting to create three distinct voices
    from a single-speaker model.

    Args:
        text (str): The text to synthesize.
        speaker (str): The speaker identifier ('A', 'B', or 'C').

    Returns:
        AudioSegment: A pydub AudioSegment object of the synthesized speech.
    """
    if tts_instance is None:
        raise RuntimeError("TTS service is not initialized. High-quality synthesis is unavailable.")
    
    try:
        wav_buffer = io.BytesIO()
        
        tts_instance.tts_to_file(
            text=text,
            speaker=None,
            file_path=wav_buffer,
            speed=1.1
        )
        wav_buffer.seek(0)
        
        audio_segment = AudioSegment.from_file(wav_buffer, format="wav")

        # --- REFINED Pitch Shifting for Three Distinct Voices ---
        # A semitone is a musical interval. We shift by fractions of a semitone for subtle changes.
        # The formula for semitone shift is 2**(semitones/12).
        
        if speaker.upper() == 'A':
            # Speaker A (Learner): Higher pitch to simulate a female voice.
            # Shift up by +2 semitones.
            semitones = 2.0
            new_sample_rate = int(audio_segment.frame_rate * (2.0 ** (semitones / 12.0)))
            
        elif speaker.upper() == 'B':
            # Speaker B (Expert): Lower pitch for a deep, authoritative male voice.
            # Shift down by -2 semitones.
            semitones = -2.0
            new_sample_rate = int(audio_segment.frame_rate * (2.0 ** (semitones / 12.0)))

        else: # Speaker C (Host)
            # Speaker C (Host): Slightly lower pitch for a standard, neutral male voice, distinct from the expert.
            # Shift down by -0.5 semitones.
            semitones = -0.5
            new_sample_rate = int(audio_segment.frame_rate * (2.0 ** (semitones / 12.0)))
        
        pitched_segment = audio_segment._spawn(audio_segment.raw_data, overrides={'frame_rate': new_sample_rate})
        return pitched_segment.set_frame_rate(audio_segment.frame_rate)

    except Exception as e:
        logger.error(f"Error during TTS synthesis for speaker {speaker}: {e}", exc_info=True)
        raise IOError(f"Failed to synthesize audio for speaker {speaker}.")