# server/rag_service/app.py
import os
import sys
import traceback
from flask import Flask, request, jsonify, current_app, send_from_directory, after_this_request
import logging
import atexit
import uuid
import subprocess
import tempfile
import shutil
import json
import re
from werkzeug import utils as werkzeug_utils
import aiohttp
from ddgs import DDGS
from qdrant_client import models as qdrant_models
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from prometheus_flask_exporter import PrometheusMetrics

# --- THIS IS THE FIX: Add the parent 'server' directory to the Python path ---
# This allows imports like 'from rag_service import ...' to work correctly.
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)
# --- END OF FIX ---

# --- Import configurations and services using the corrected path ---
from rag_service import config, knowledge_engine, media_processor, neo4j_handler, ai_core
from rag_service.vector_db_service import VectorDBService
from rag_service import document_generator, podcast_generator, quiz_utils
from rag_service.tts_service import initialize_tts
from rag_service.prompts import CODE_ANALYSIS_PROMPT_TEMPLATE, TEST_CASE_GENERATION_PROMPT_TEMPLATE, EXPLAIN_ERROR_PROMPT_TEMPLATE, QUIZ_GENERATION_PROMPT_TEMPLATE
from rag_service.academic_search import search_all_apis as academic_search
from rag_service.integrity_services import submit_to_turnitin, get_turnitin_report, check_bias_hybrid, calculate_readability
import asyncio
import google.generativeai as genai

config.setup_logging()
app = Flask(__name__)
logger = logging.getLogger(__name__)

if config.SENTRY_DSN:
    sentry_sdk.init(
        dsn=config.SENTRY_DSN,
        integrations=[FlaskIntegration()],
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )
    logger.info("Sentry initialized successfully for Python RAG service.")
else:
    logger.warn("SENTRY_DSN not found in config. Sentry is disabled for Python RAG service.")

metrics = PrometheusMetrics(app)
logger.info("Prometheus metrics endpoint initialized at /metrics.")

GENERATED_DOCS_DIR = os.path.join(os.path.dirname(__file__), 'generated_docs')
os.makedirs(GENERATED_DOCS_DIR, exist_ok=True)
app.config['GENERATED_DOCS_DIR'] = GENERATED_DOCS_DIR

# Initialize services
vector_service = None
try:
    vector_service = VectorDBService()
    vector_service.setup_collection()
    app.vector_service = vector_service
except Exception as e:
    logger.critical(f"Failed to initialize VectorDBService: {e}", exc_info=True)

try:
    neo4j_handler.init_driver()
except Exception as e:
    logger.critical(f"Neo4j driver failed to initialize: {e}.")
atexit.register(neo4j_handler.close_driver)

initialize_tts()

# --- Helper Functions ---
if config.GEMINI_API_KEY:
    genai.configure(api_key=config.GEMINI_API_KEY)
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    LLM_MODEL = genai.GenerativeModel(config.GEMINI_MODEL_NAME, safety_settings=safety_settings)
else:
    LLM_MODEL = None
    logging.getLogger(__name__).error("GEMINI_API_KEY not found, AI features will fail.")

def llm_wrapper(prompt, api_key=None):
    key_to_use = api_key or config.GEMINI_API_KEY
    if not key_to_use:
        raise ConnectionError("Gemini API Key is not configured for this request.")

    genai.configure(api_key=key_to_use)
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    model_instance = genai.GenerativeModel(config.GEMINI_MODEL_NAME, safety_settings=safety_settings)

    for attempt in range(3):
        try:
            response = model_instance.generate_content(prompt)
            if response.parts:
                return "".join(part.text for part in response.parts if hasattr(part, 'text'))
            elif response.prompt_feedback and response.prompt_feedback.block_reason:
                 raise ValueError(f"Prompt blocked by API. Reason: {response.prompt_feedback.block_reason_message}")
            else:
                logger.warning("LLM returned empty response without explicit block reason.")
                return ""
        except Exception as e:
            logger.warning(f"LLM generation attempt {attempt + 1} failed: {e}")
            if attempt == 2: raise
    return ""

def create_error_response(message, status_code=500, details=None):
    log_message = f"API Error ({status_code}): {message}"
    if details: log_message += f" | Details: {details}"
    current_app.logger.error(log_message)
    response_payload = {"error": message}
    if details and status_code != 500: response_payload["details"] = details
    return jsonify(response_payload), status_code

# This config is now cleaner. The platform-specific logic is handled in the route.
LANGUAGE_CONFIG = {
    "python": {"filename": "main.py", "compile_cmd": None, "run_cmd": [sys.executable, "main.py"]},
    "java": {"filename": "Main.java", "compile_cmd": ["javac", "-Xlint:all", "Main.java"], "run_cmd": ["java", "Main"]},
    "c": {"filename": "main.c", "compile_cmd": ["gcc", "main.c", "-o", "main", "-Wall", "-Wextra", "-pedantic"], "run_cmd": ["main"]},
    "cpp": {"filename": "main.cpp", "compile_cmd": ["g++", "main.cpp", "-o", "main", "-Wall", "-Wextra", "-pedantic"], "run_cmd": ["main"]}
}

# === API Endpoints ===

@app.route('/execute_code', methods=['POST'])
def execute_code():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    code, language, test_cases = data.get('code'), data.get('language', '').lower(), data.get('testCases', [])
    if not code or not language: return create_error_response("Missing 'code' or 'language'", 400)
    lang_config = LANGUAGE_CONFIG.get(language)
    if not lang_config:
        return jsonify({"compilationError": f"Language '{language}' is not currently supported."}), 200

    results = []
    temp_dir = tempfile.mkdtemp()
    try:
        source_path = os.path.join(temp_dir, lang_config["filename"])
        with open(source_path, 'w', encoding='utf-8') as f: f.write(code)

        if lang_config["compile_cmd"]:
            try:
                compile_process = subprocess.run(lang_config["compile_cmd"], cwd=temp_dir, capture_output=True, text=True, timeout=10, encoding='utf-8', check=False)
            except FileNotFoundError:
                compiler_name = lang_config["compile_cmd"][0]
                error_msg = f"Compiler Error: '{compiler_name}' not found. Ensure it's installed and in your system's PATH."
                logger.error(error_msg)
                return jsonify({"compilationError": error_msg}), 200
                
            if compile_process.returncode != 0:
                error_output = (compile_process.stdout + "\n" + compile_process.stderr).strip()
                logger.warning(f"Compilation failed for {language}. Error: {error_output}")
                return jsonify({"compilationError": error_output}), 200

        for case in test_cases:
            case_input, expected_output = case.get('input', ''), str(case.get('expectedOutput', '')).strip()
            case_result = { "input": case_input, "expected": expected_output, "output": "", "error": None, "status": "fail" }
            try:
                run_command = lang_config["run_cmd"][:]
                if language in ["c", "cpp"]:
                    executable_name = run_command[0]
                    if os.name == 'nt': executable_name += '.exe'
                    run_command[0] = os.path.join(temp_dir, executable_name)

                run_process = subprocess.run(run_command, cwd=temp_dir, input=case_input, capture_output=True, text=True, timeout=5, encoding='utf-8')
                stdout, stderr = run_process.stdout.strip().replace('\r\n', '\n'), run_process.stderr.strip()
                case_result["output"] = stdout

                if run_process.returncode != 0:
                    case_result["status"] = "error"
                    case_result["error"] = stderr or "Script failed with a non-zero exit code."
                elif stderr:
                     case_result["error"] = f"Warning (stderr):\n{stderr}"
                
                if case_result["status"] != "error":
                    case_result["status"] = "pass" if stdout == expected_output else "fail"
            except subprocess.TimeoutExpired:
                case_result.update({"status": "error", "error": "Execution timed out after 5 seconds."})
            except Exception as exec_err:
                case_result.update({"status": "error", "error": f"An unexpected execution error occurred: {str(exec_err)}"})
            results.append(case_result)
    finally:
        shutil.rmtree(temp_dir)
    return jsonify({"results": results}), 200

@app.route('/analyze_code', methods=['POST'])
def analyze_code_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    
    code, language, api_key = data.get('code'), data.get('language'), data.get('apiKey')
    
    if not all([code, language]):
        return create_error_response("Missing 'code' or 'language'", 400)
        
    try:
        prompt = CODE_ANALYSIS_PROMPT_TEMPLATE.format(language=language, code=code)
        analysis = llm_wrapper(prompt, api_key)
        return jsonify({"analysis": analysis}), 200
    except Exception as e:
        return create_error_response(f"Failed to analyze code: {str(e)}", 500)

@app.route('/generate_test_cases', methods=['POST'])
def generate_test_cases_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    
    code, language, api_key = data.get('code'), data.get('language'), data.get('apiKey')
    
    if not all([code, language]):
        return create_error_response("Missing 'code' or 'language'", 400)

    try:
        prompt = TEST_CASE_GENERATION_PROMPT_TEMPLATE.format(language=language, code=code)
        response_text = llm_wrapper(prompt, api_key)
        
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if not json_match:
            raise ValueError("LLM response did not contain a valid JSON array for test cases.")
        
        test_cases = json.loads(json_match.group(0))
        return jsonify({"testCases": test_cases}), 200
    except Exception as e:
        return create_error_response(f"Failed to generate test cases: {str(e)}", 500)

@app.route('/explain_error', methods=['POST'])
def explain_error_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    
    code, language, error_message, api_key = data.get('code'), data.get('language'), data.get('errorMessage'), data.get('apiKey')
    
    if not all([code, language, error_message]):
        return create_error_response("Missing 'code', 'language', or 'errorMessage'", 400)
        
    try:
        prompt = EXPLAIN_ERROR_PROMPT_TEMPLATE.format(language=language, code=code, error_message=error_message)
        explanation = llm_wrapper(prompt, api_key)
        return jsonify({"explanation": explanation}), 200
    except Exception as e:
        return create_error_response(f"Failed to explain error: {str(e)}", 500)

@app.route('/generate_quiz', methods=['POST'])
def generate_quiz_route():
    if 'file' not in request.files:
        return create_error_response("No file part in the request", 400)
    
    file = request.files['file']
    quiz_option = request.form.get('quizOption', 'standard')
    api_key = request.form.get('api_key')
    
    quiz_option_map = {'quick': 5, 'standard': 10, 'deep_dive': 15, 'comprehensive': 20}
    num_questions = quiz_option_map.get(quiz_option, 10)

    if file.filename == '': return create_error_response("No selected file", 400)
    if not api_key: return create_error_response("API Key is required", 400)

    temp_dir = tempfile.mkdtemp()
    try:
        filename = werkzeug_utils.secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)

        document_text = quiz_utils.extract_text_for_quiz(file_path)
        if not document_text or not document_text.strip():
            return create_error_response("Could not extract any text from the document.", 422)

        prompt = QUIZ_GENERATION_PROMPT_TEMPLATE.format(num_questions=num_questions, document_text=document_text)
        response_text = llm_wrapper(prompt, api_key)
        
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if not json_match:
            raise ValueError("LLM response did not contain a valid JSON array for the quiz.")
        
        quiz_data = json.loads(json_match.group(0))
        return jsonify({"quiz": quiz_data}), 200
    except Exception as e:
        return create_error_response(f"Quiz Generation failed: {str(e)}", 500)
    finally:
        shutil.rmtree(temp_dir)

@app.route('/query', methods=['POST'])
def search_qdrant_documents():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    
    query_text, user_id, doc_context, use_kg = data.get('query'), data.get('user_id'), data.get('documentContextName'), data.get('use_kg_critical_thinking', False)
    if not query_text or not user_id: return create_error_response("Missing 'query' or 'user_id'", 400)

    try:
        k = data.get('k', 5)
        facts_from_kg = ""
        if use_kg and doc_context:
            facts_from_kg = neo4j_handler.search_knowledge_graph(user_id, doc_context, query_text)

        must_conditions = []
        if doc_context:
            must_conditions.append(qdrant_models.FieldCondition(key="file_name", match=qdrant_models.MatchValue(value=doc_context)))
        
        qdrant_filters = qdrant_models.Filter(must=must_conditions) if must_conditions else None
        
        retrieved_docs, snippet_from_vector, docs_map = vector_service.search_documents(query=query_text, k=k, filter_conditions=qdrant_filters)
        
        final_snippet = f"{facts_from_kg}\n\n---\n\n{snippet_from_vector}" if facts_from_kg and "No specific facts" not in facts_from_kg else snippet_from_vector
        
        return jsonify({
            "retrieved_documents_list": [d.to_dict() for d in retrieved_docs],
            "formatted_context_snippet": final_snippet.strip(), 
            "retrieved_documents_map": docs_map,
        }), 200
    except Exception as e:
        return create_error_response(f"Query failed: {str(e)}", 500)

@app.route('/health', methods=['GET'])
def health_check():
    status = {"status": "ok", "services": {}}
    http_code = 200
    try:
        vector_service.client.get_collection(collection_name=vector_service.collection_name)
        status["services"]["qdrant"] = "ok"
    except Exception as e:
        status["services"]["qdrant"] = f"error: {e}"
        http_code = 503
    
    neo4j_ok, neo4j_msg = neo4j_handler.check_neo4j_connectivity()
    status["services"]["neo4j"] = "ok" if neo4j_ok else f"error: {neo4j_msg}"
    if not neo4j_ok: http_code = 503
    
    if http_code == 503: status["status"] = "error"
    return jsonify(status), http_code

@app.route('/add_document', methods=['POST'])
def add_document_qdrant():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    
    user_id, file_path, original_name, text_content_override = data.get('user_id'), data.get('file_path'), data.get('original_name'), data.get('text_content_override')
    llm_provider = data.get('llm_provider', 'gemini')

    if not all([user_id, original_name]): return create_error_response("Missing 'user_id' or 'original_name'", 400)

    process_args = {"original_name": original_name, "user_id": user_id, "llm_provider": llm_provider}
    if text_content_override:
        process_args.update({"file_path": "", "text_content_override": text_content_override})
    elif file_path and os.path.exists(file_path):
        process_args["file_path"] = file_path
    else:
        return create_error_response("File path missing or invalid, and no text override provided.", 400)

    processed_chunks, raw_text, kg_chunks = ai_core.process_document_for_qdrant(**process_args)
    num_added, status = (vector_service.add_processed_chunks(processed_chunks), "added_to_qdrant") if processed_chunks else (0, "processed_no_content")
    
    return jsonify({
        "message": "Document processed.", "status": status, "filename": original_name,
        "num_chunks_added_to_qdrant": num_added, "raw_text_for_analysis": raw_text or "",
        "chunks_with_metadata": kg_chunks
    }), 201

@app.route('/academic_search', methods=['POST'])
def academic_search_route():
    data = request.get_json()
    if not data or 'query' not in data: return create_error_response("Missing 'query'", 400)
    try:
        results = asyncio.run(academic_search(data['query'], max_results_per_api=data.get('max_results', 3)))
        return jsonify({"success": True, "results": results}), 200
    except Exception as e:
        return create_error_response(f"Academic search failed: {str(e)}", 500)

@app.route('/web_search', methods=['POST'])
def web_search_route():
    data = request.get_json()
    if not data or 'query' not in data: return create_error_response("Missing 'query'", 400)
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(data['query'], max_results=5))
        return jsonify([{"title": r.get("title"), "url": r.get("href"), "content": r.get("body")} for r in results]), 200
    except Exception as e: return create_error_response(f"Web search failed: {str(e)}", 500)

@app.route('/export_podcast', methods=['POST'])
def export_podcast_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    source_document_text, analysis_content, podcast_options, api_key = data.get('sourceDocumentText'), data.get('analysisContent'), data.get('podcastOptions', {}), data.get('api_key')
    if not all([source_document_text, analysis_content, api_key]):
        return create_error_response("Missing 'sourceDocumentText', 'analysisContent', or 'api_key'", 400)

    try:
        script = podcast_generator.generate_podcast_script(source_document_text, analysis_content, podcast_options, lambda p: llm_wrapper(p, api_key))
        final_mp3_filename = f"podcast_final_{uuid.uuid4()}.mp3"
        final_mp3_path = os.path.join(app.config['GENERATED_DOCS_DIR'], final_mp3_filename)
        podcast_generator.create_podcast_from_script(script, final_mp3_path)

        @after_this_request
        def cleanup(response):
            try: os.remove(final_mp3_path)
            except OSError as e: logger.error(f"Error deleting temp podcast file {final_mp3_path}: {e}")
            return response
        return send_from_directory(app.config['GENERATED_DOCS_DIR'], final_mp3_filename, as_attachment=True)
    except Exception as e:
        return create_error_response(f"Failed to generate podcast: {str(e)}", 500)

@app.route('/download_document/<filename>', methods=['GET'])
def download_document_route(filename):
    if '..' in filename: return create_error_response("Invalid filename.", 400)
    file_path = os.path.join(app.config['GENERATED_DOCS_DIR'], filename)
    if not os.path.exists(file_path): return create_error_response("File not found.", 404)
    @after_this_request
    def cleanup(response):
        try: os.remove(file_path)
        except OSError as e: logger.error(f"Error deleting temp file {file_path}: {e}")
        return response
    return send_from_directory(app.config['GENERATED_DOCS_DIR'], filename, as_attachment=True)

@app.route('/delete_qdrant_document_data', methods=['DELETE'])
def delete_qdrant_data_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    user_id, document_name = data.get('user_id'), data.get('document_name') 
    if not user_id or not document_name: return create_error_response("Missing fields", 400)
    try:
        result = vector_service.delete_document_vectors(user_id, document_name)
        return jsonify(result), 200
    except Exception as e: return create_error_response(f"Deletion failed: {str(e)}", 500)

@app.route('/kg', methods=['POST'])
def add_or_update_kg_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    user_id, original_name, nodes, edges = data.get('userId'), data.get('originalName'), data.get('nodes'), data.get('edges')
    if not all([user_id, original_name, isinstance(nodes, list), isinstance(edges, list)]): return create_error_response("Missing fields", 400)
    try:
        result = neo4j_handler.ingest_knowledge_graph(user_id, original_name, nodes, edges)
        return jsonify({"message": "KG ingested", "status": "completed", **result}), 201
    except Exception as e: return create_error_response(f"KG ingestion failed: {str(e)}", 500)

@app.route('/kg/<user_id>/<path:document_name>', methods=['GET'])
def get_kg_route(user_id, document_name):
    try:
        kg_data = neo4j_handler.get_knowledge_graph(user_id, document_name)
        return jsonify(kg_data or {"nodes": [], "edges": []}), 200
    except Exception as e: 
        return create_error_response(f"KG retrieval failed: {str(e)}", 500)

@app.route('/kg/<user_id>/<path:document_name>', methods=['DELETE'])
def delete_kg_route(user_id, document_name):
    try:
        deleted = neo4j_handler.delete_knowledge_graph(user_id, document_name)
        return jsonify({"message": "KG deleted"}) if deleted else create_error_response("KG not found", 404)
    except Exception as e: return create_error_response(f"KG deletion failed: {str(e)}", 500)

@app.route('/query_kg', methods=['POST'])
def query_kg_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    query_text, document_name, user_id = data.get('query'), data.get('document_name'), data.get('user_id')
    if not all([query_text, document_name, user_id]): return create_error_response("Missing 'query', 'document_name', or 'user_id'", 400)
    try:
        facts_from_kg = neo4j_handler.search_knowledge_graph(user_id, document_name, query_text)
        return jsonify({"success": True, "facts": facts_from_kg}), 200
    except Exception as e:
        return create_error_response(f"KG query failed: {str(e)}", 500)

@app.route('/analyze_integrity', methods=['POST'])
def analyze_integrity_route():
    data = request.get_json()
    text, checks, api_key = data.get('text'), data.get('checks', []), data.get('api_key')
    if not text or not checks: return create_error_response("Missing 'text' or 'checks' list", 400)
    results = {}
    llm_func = lambda p: llm_wrapper(p, api_key)
    async def main():
        async with aiohttp.ClientSession() as session:
            if 'plagiarism' in checks:
                try:
                    submission_id = await submit_to_turnitin(session, text)
                    results['plagiarism'] = {"status": "pending", "submissionId": submission_id}
                except Exception as e: results['plagiarism'] = {"status": "error", "message": str(e)}
    try:
        asyncio.run(main())
        if 'bias' in checks:
            try: results['bias'] = check_bias_hybrid(text, llm_func)
            except Exception as e: results['bias'] = {"status": "error", "message": str(e)}
        if 'readability' in checks:
            try: results['readability'] = calculate_readability(text)
            except Exception as e: results['readability'] = {"status": "error", "message": str(e)}
        return jsonify(results), 200
    except Exception as e:
        return create_error_response(f"Integrity analysis failed: {str(e)}", 500)

@app.route('/get_turnitin_report', methods=['POST'])
def get_turnitin_report_route():
    submission_id = request.json.get('submissionId')
    if not submission_id: return create_error_response("Missing 'submissionId'", 400)
    async def main():
        async with aiohttp.ClientSession() as session:
            return await get_turnitin_report(session, submission_id)
    try:
        report = asyncio.run(main())
        return jsonify({"status": "completed", "report": report}), 200
    except TimeoutError:
        return jsonify({"status": "pending"}), 202
    except Exception as e:
        return create_error_response(f"Failed to get Turnitin report: {str(e)}", 500)

@app.route('/generate_document', methods=['POST'])
def generate_document_route():
    data = request.get_json()
    outline, doc_type, source_text, api_key = data.get('markdownContent'), data.get('docType'), data.get('sourceDocumentText'), data.get('api_key')
    if not all([outline, doc_type, source_text, api_key]): return create_error_response("Missing required fields", 400)
    try:
        expanded_content = document_generator.expand_content_with_llm(outline, source_text, doc_type, lambda p: llm_wrapper(p, api_key))
        parsed_data = document_generator.parse_pptx_json(expanded_content) if doc_type == 'pptx' else document_generator.refined_parse_docx_markdown(expanded_content)
        if not parsed_data: return create_error_response(f"AI failed to generate valid content for {doc_type.upper()}.", 422)

        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', outline)[:50]
        filename = f"gen_{safe_name}_{uuid.uuid4()}.{doc_type}"
        file_path = os.path.join(app.config['GENERATED_DOCS_DIR'], filename)

        create_func = document_generator.create_ppt if doc_type == 'pptx' else document_generator.create_doc
        create_func(parsed_data, file_path)

        @after_this_request
        def cleanup(response):
            try: os.remove(file_path)
            except OSError as e: logger.error(f"Error deleting generated file {file_path}: {e}")
            return response
        return send_from_directory(app.config['GENERATED_DOCS_DIR'], filename, as_attachment=True)
    except Exception as e:
        return create_error_response(f"Failed to generate document: {str(e)}", 500)

@app.route('/generate_document_from_topic', methods=['POST'])
def generate_document_from_topic_route():
    data = request.get_json()
    topic, doc_type, api_key = data.get('topic'), data.get('docType'), data.get('api_key')
    if not all([topic, doc_type, api_key]): return create_error_response("Missing 'topic', 'docType', or 'api_key'", 400)
    try:
        generated_content = document_generator.generate_content_from_topic(topic, doc_type, lambda p: llm_wrapper(p, api_key))
        parsed_data = document_generator.parse_pptx_json(generated_content) if doc_type == 'pptx' else document_generator.refined_parse_docx_markdown(generated_content)
        if not parsed_data: return create_error_response(f"AI failed to generate valid content for {doc_type.upper()} on topic '{topic}'.", 422)

        safe_topic = re.sub(r'[^a-zA-Z0-9_-]', '_', topic)[:50]
        filename = f"gen_{safe_topic}_{uuid.uuid4()}.{doc_type}"
        file_path = os.path.join(app.config['GENERATED_DOCS_DIR'], filename)

        create_func = document_generator.create_ppt if doc_type == 'pptx' else document_generator.create_doc
        create_func(parsed_data, file_path)

        @after_this_request
        def cleanup(response):
            try: os.remove(file_path)
            except OSError as e: logger.error(f"Error deleting generated file {file_path}: {e}")
            return response
        return send_from_directory(app.config['GENERATED_DOCS_DIR'], filename, as_attachment=True)
    except Exception as e:
        return create_error_response(f"Failed to generate document from topic: {str(e)}", 500)

@app.route('/process_media_file', methods=['POST'])
def process_media_file_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    file_path, media_type = data.get('file_path'), data.get('media_type')
    if not file_path or not media_type: return create_error_response("Missing 'file_path' or 'media_type'", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        processors = {'audio': media_processor.process_uploaded_audio, 'video': media_processor.process_uploaded_video, 'image': media_processor.process_uploaded_image}
        if media_type not in processors: return create_error_response(f"Unsupported media_type: {media_type}", 400)
        text_content = processors[media_type](file_path)
        if not text_content or not text_content.strip():
            return create_error_response(f"Failed to extract text from the {media_type} file.", 422)
        return jsonify({"success": True, "message": f"Successfully extracted text.", "text_content": text_content}), 200
    except Exception as e:
        return create_error_response(f"Failed to process {media_type} file: {str(e)}", 500)

@app.route('/process_url', methods=['POST'])
def process_url_source_route():
    data = request.get_json()
    if not data: return create_error_response("Request must be JSON", 400)
    url, user_id = data.get('url'), data.get('user_id')
    if not url or not user_id: return create_error_response("Missing 'url' or 'user_id'", 400)
    try:
        extracted_text, final_title, source_type = knowledge_engine.process_url_source(url, user_id)
        if not extracted_text:
            return create_error_response(f"Failed to extract text from the {source_type}.", 422)
        return jsonify({"success": True, "message": "Text extracted.", "text_content": extracted_text, "title": final_title, "source_type": source_type}), 200
    except Exception as e:
        return create_error_response(f"Failed to process URL: {str(e)}", 500)

if __name__ == '__main__':
    logger.info(f"--- Starting RAG & Knowledge API Service on port {config.API_PORT} ---")
    app.run(host='0.0.0.0', port=config.API_PORT, debug=False, threaded=False)
