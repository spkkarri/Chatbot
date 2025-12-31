# server/rag_service/podcast_generator.py
import logging
import re
from pydub import AudioSegment
import tts_service  # Import our high-quality TTS service

logger = logging.getLogger(__name__)

# --- PROMPT UPDATED FOR THREE SPEAKERS ---
PODCAST_SCRIPT_PROMPT_TEMPLATE = """
You are an AI podcast script generator. Your SOLE task is to generate a highly realistic, emotionally engaging, three-speaker educational dialogue based on the provided text. The script should sound like real people collaborating, complete with natural flow, occasional laughter, casual banter, and distinct personalities.

**CRITICAL INSTRUCTION:** Your entire output must be ONLY the script itself. Start directly with "SPEAKER_C:". Do NOT include any preamble, introduction, or metadata like "Here is the script:".

---
## Podcast Style Guide
- **Format**: Three-speaker conversational podcast.
- **SPEAKER_A**: The "Curious Learner" (Female Voice). Asks insightful and sometimes playful or puzzled questions, often relating topics to everyday experiences. Brings warmth and emotional curiosity to the discussion.
- **SPEAKER_B**: The "Expert Teacher" (Male Voice). Offers rich, articulate explanations using metaphors, relatable examples, and the occasional witty comment. Confident but not robotic — he should show excitement when explaining something cool or important.
- **SPEAKER_C**: The "Podcast Host" (Male Voice). Friendly, energetic, and sometimes humorous. Opens and steers the conversation, keeps it on track, and wraps up each segment with key takeaways. Brings moments of laughter, “aha!” moments, or surprise reactions to keep things lively.
- **Tone**: Natural, engaging, collaborative, warm, and sometimes humorous. Do not be afraid to insert laughter (e.g., [laughs], [chuckles]) or expressions (e.g., “Wow!”, “That’s wild!”, “Wait, really?”) to mimic real-life conversations.
- **Dialogue Flow**: The Host (C) starts the podcast. Ensure an authentic, dynamic back-and-forth among all speakers. Create at least 8–10 meaningful exchanges to ensure a deep and flowing discussion.
- **Add Personality**: Speakers should occasionally react to each other’s points (e.g., “That’s a great point, B!”, “Exactly!”, “Oof, I never thought of it that way!”). Avoid making it too scripted or flat — let the speakers interrupt briefly, joke, or affirm each other naturally.

---
## Task-Specific Instructions
- **Podcast Purpose**: {purpose_instruction}
- **Podcast Length**: {length_instruction} (Minimum 800–1000 words. Don’t rush through the discussion — let each speaker fully express thoughts and responses.)

---
## Source Material
**STUDY FOCUS (The main topic for the podcast):**
{study_focus}
**DOCUMENT TEXT (Use this for all factual answers):**
{document_content}
---
**FINAL SCRIPT OUTPUT (Remember: Start IMMEDIATELY with "SPEAKER_C:")**
"""


def generate_podcast_script(source_document_text, outline_content, podcast_options, llm_function):
    """Generates a three-speaker podcast script using the LLM with dynamic options."""
    logger.info(f"Generating 3-speaker podcast script with options: {podcast_options}")

    purpose_map = {
        'introduction': "Focus on high-level concepts and definitions. Assume the listener is new to the topic. Keep explanations simple and clear.",
        'exam_prep': "Focus on key facts, data, and potential test questions. The dialogue should be structured like a Q&A review session, covering the most important material for an exam.",
        'deep_dive': "Explore the topic in great detail. Discuss nuances, complexities, and specific examples from the text. Assume the listener has some prior knowledge.",
        'review': "Provide a balanced overview of the main topics. Cover the most important points without getting lost in minor details. This is for general understanding."
    }
    
    length_map = {
        'quick': "The script should be concise, resulting in approximately 5-7 minutes of spoken audio. Aim for around 800-1000 words.",
        'standard': "The script should be of a standard length, resulting in approximately 10-15 minutes of spoken audio. Aim for around 1500-2000 words.",
        'comprehensive': "The script should be very detailed and long, resulting in approximately 15-25 minutes of spoken audio. Aim for over 2500 words."
    }

    purpose_instruction = purpose_map.get(podcast_options.get('studyPurpose'), purpose_map['review'])
    length_instruction = length_map.get(podcast_options.get('sessionLength'), length_map['standard'])

    prompt = PODCAST_SCRIPT_PROMPT_TEMPLATE.format(
        purpose_instruction=purpose_instruction,
        length_instruction=length_instruction,
        document_content=source_document_text[:60000],
        study_focus=outline_content,
    )
    
    script = llm_function(prompt)
    if not script or not script.strip():
        raise ValueError("LLM failed to generate a podcast script.")
    logger.info(f"LLM generated 3-speaker podcast script. Length: {len(script)}")
    return script

def create_podcast_from_script(script: str, output_path: str):
    """
    Synthesizes a full podcast from a script using the multi-speaker TTS service.
    
    Args:
        script (str): The script with SPEAKER_A, SPEAKER_B, and SPEAKER_C labels.
        output_path (str): The path to save the final MP3 file.
    """
    logger.info(f"Starting high-quality 3-speaker podcast synthesis for script of length {len(script)}.")
    
    final_podcast = AudioSegment.empty()
    silence_between_speakers = AudioSegment.silent(duration=700)

    lines = script.strip().split('\n')
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # --- REGEX UPDATED FOR THREE SPEAKERS (A, B, or C) ---
        match = re.match(r'SPEAKER_([ABC]):\s*(.*)', line, re.IGNORECASE)
        if match:
            speaker, text = match.groups()
            text = text.strip()

            if text:
                logger.info(f"Synthesizing line {i+1}/{len(lines)} for SPEAKER_{speaker}...")
                try:
                    # The tts_service will handle the pitch shifting based on the speaker label
                    audio_segment = tts_service.synthesize_speech(text, speaker)
                    
                    final_podcast += audio_segment + silence_between_speakers
                except Exception as e:
                    logger.error(f"Could not synthesize line {i+1}. Skipping. Error: {e}")
            else:
                logger.warning(f"Skipping empty dialogue line for SPEAKER_{speaker} at line {i+1}.")
        else:
            logger.warning(f"Line {i+1} does not match speaker format and will be skipped: '{line[:50]}...'")

    if len(final_podcast) == 0:
        raise ValueError("Podcast synthesis resulted in an empty audio file. Check script format and TTS service.")

    logger.info(f"Exporting final 3-speaker podcast ({len(final_podcast) / 1000:.2f} seconds) to {output_path}")
    final_podcast.export(output_path, format="mp3", bitrate="192k")
    logger.info(f"High-quality 3-speaker podcast saved successfully to {output_path}")