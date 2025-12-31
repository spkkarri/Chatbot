# server/rag_service/integrity_services.py
import logging
import time
import re
import json
from typing import Dict, Any, List
import asyncio
import aiohttp

import config
from prompts import BIAS_CHECK_PROMPT_TEMPLATE
import textstat

logger = logging.getLogger(__name__)

# In-memory cache for Turnitin token
turnitin_token_cache = { "token": None, "expires_at": 0 }

def _extract_json_from_llm_response(text: str) -> Dict[str, Any]:
    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text, re.DOTALL)
    if json_match:
        json_string = json_match.group(1)
    else:
        start_index = text.find('{')
        end_index = text.rfind('}')
        if start_index != -1 and end_index != -1 and end_index > start_index:
            json_string = text[start_index:end_index+1]
        else:
            raise ValueError("No valid JSON object found in the LLM response.")
    return json.loads(json_string)

# --- Plagiarism Service (Turnitin) ---

async def get_turnitin_auth_token(session: aiohttp.ClientSession) -> str:
    """Gets a JWT from Turnitin, using a simple in-memory cache."""
    if turnitin_token_cache["token"] and time.time() < turnitin_token_cache["expires_at"]:
        return turnitin_token_cache["token"]

    if not all([config.TURNITIN_API_URL, config.TURNITIN_API_KEY, config.TURNITIN_API_SECRET]):
        raise ValueError("Turnitin API credentials are not configured on the server.")

    url = f"{config.TURNITIN_API_URL}/oauth/token"
    payload = {
        'grant_type': 'client_credentials',
        'client_id': config.TURNITIN_API_KEY,
        'client_secret': config.TURNITIN_API_SECRET
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    
    async with session.post(url, data=payload, headers=headers) as response:
        response.raise_for_status()
        data = await response.json()

        turnitin_token_cache["token"] = data['access_token']
        turnitin_token_cache["expires_at"] = time.time() + data['expires_in'] - 60
        return data['access_token']

async def submit_to_turnitin(session: aiohttp.ClientSession, text: str, filename: str = "pasted_text.txt") -> str:
    """Submits text to Turnitin and returns a submission ID."""
    token = await get_turnitin_auth_token(session)
    url = f"{config.TURNITIN_API_URL}/submissions"
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = {
        'owner': 'api-user@example.com',
        'title': f"Integrity Check - {filename}",
        'file_content': text
    }
    
    async with session.post(url, json=payload, headers=headers) as response:
        response.raise_for_status()
        data = await response.json()
        return data['id']

async def get_turnitin_report(session: aiohttp.ClientSession, submission_id: str) -> Dict[str, Any]:
    """Polls for and returns the final Turnitin similarity report."""
    token = await get_turnitin_auth_token(session)
    report_url = f"{config.TURNITIN_API_URL}/submissions/{submission_id}/similarity_report"
    headers = {'Authorization': f'Bearer {token}'}

    for _ in range(12):
        async with session.get(report_url, headers=headers) as response:
            if response.status == 200:
                return await response.json()
            elif response.status == 202:
                await asyncio.sleep(10)
            else:
                response.raise_for_status()
    raise TimeoutError("Turnitin report generation timed out after 2 minutes.")


# --- Bias & Inclusivity Service ---
def check_bias_hybrid(text: str, llm_function) -> List[Dict[str, str]]:
    from bias_wordlists import INCLUSIVE_LANGUAGE_REPLACEMENTS
    findings = []
    for term, suggestion in INCLUSIVE_LANGUAGE_REPLACEMENTS.items():
        if re.search(r'\b' + re.escape(term) + r'\b', text, re.IGNORECASE):
            findings.append({
                "text": term, 
                "reason": "This term may have a more inclusive or objective alternative.", 
                "suggestion": suggestion
            })
    prompt = BIAS_CHECK_PROMPT_TEMPLATE.format(text_to_analyze=text[:30000])
    try:
        response_text = llm_function(prompt)
        llm_findings = _extract_json_from_llm_response(response_text).get("findings", [])
        findings.extend(llm_findings)
    except Exception as e:
        logger.error(f"LLM bias check failed: {e}")
    unique_findings = {f['text'].lower(): f for f in findings}
    return list(unique_findings.values())


# --- Readability Service ---
def calculate_readability(text: str) -> Dict[str, Any]:
    """Calculates various readability metrics for the given text."""
    logger.info(f"Calculating readability for text of length {len(text)}")
    try:
        return {
            "fleschReadingEase": textstat.flesch_reading_ease(text),
            "fleschKincaidGrade": textstat.flesch_kincaid_grade(text),
            "gunningFog": textstat.gunning_fog(text),
            "daleChall": textstat.dale_chall_readability_score(text),
            "wordCount": textstat.lexicon_count(text, removepunct=True),
            "sentenceCount": textstat.sentence_count(text),
            "avgSentenceLength": textstat.avg_sentence_length(text),
        }
    except Exception as e:
        logger.error(f"Readability calculation failed: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to calculate metrics: {str(e)}"}