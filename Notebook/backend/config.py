import os
from dotenv import load_dotenv
import logging
from langchain.prompts import PromptTemplate # Import PromptTemplate

# Load environment variables from .env file in the same directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- Environment Variables & Defaults ---

# Ollama Configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'deepseek-r1') # Default model for generation/analysis
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large') # Default model for embeddings
# Optional: Increase Ollama request timeout (in seconds) if needed for long operations
OLLAMA_REQUEST_TIMEOUT = int(os.getenv('OLLAMA_REQUEST_TIMEOUT', 180)) # Default 3 minutes

# Application Configuration Paths (relative to backend directory)
backend_dir = os.path.dirname(__file__)
FAISS_FOLDER = os.path.join(backend_dir, os.getenv('FAISS_FOLDER', 'faiss_store'))
UPLOAD_FOLDER = os.path.join(backend_dir, os.getenv('UPLOAD_FOLDER', 'uploads'))
DATABASE_NAME = os.getenv('DATABASE_NAME', 'chat_history.db')
DATABASE_PATH = os.path.join(backend_dir, DATABASE_NAME)
DEFAULT_PDFS_FOLDER = os.path.join(backend_dir, os.getenv('DEFAULT_PDFS_FOLDER', 'default_pdfs'))

# File Handling
ALLOWED_EXTENSIONS = {'pdf'}

# RAG Configuration
RAG_CHUNK_K = int(os.getenv('RAG_CHUNK_K', 5)) # Number of unique chunks to finally send to LLM
RAG_SEARCH_K_PER_QUERY = int(os.getenv('RAG_SEARCH_K_PER_QUERY', 3)) # Number of chunks to retrieve per sub-query before deduplication
MULTI_QUERY_COUNT = int(os.getenv('MULTI_QUERY_COUNT', 3)) # Number of sub-questions (0 to disable)

# Analysis Configuration
ANALYSIS_MAX_CONTEXT_LENGTH = int(os.getenv('ANALYSIS_MAX_CONTEXT_LENGTH', 8000)) # Max chars for analysis context

# Logging Configuration
LOGGING_LEVEL_NAME = os.getenv('LOGGING_LEVEL', 'INFO').upper()
LOGGING_LEVEL = getattr(logging, LOGGING_LEVEL_NAME, logging.INFO)
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'


# --- Prompt Templates ---

# Sub-Query Generation Prompt (Thinking optional here, focus on direct output)
SUB_QUERY_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "num_queries"],
    template="""You are an AI assistant skilled at decomposing user questions into effective search queries for a vector database containing chunks of engineering documents.
Given the user's query, generate {num_queries} distinct search queries targeting different specific aspects, keywords, or concepts within the original query.
Focus on creating queries that are likely to retrieve relevant text chunks individually.
Output ONLY the generated search queries, each on a new line. Do not include numbering, labels, explanations, or any other text.

User Query: "{query}"

Generated Search Queries:"""
)



# RAG Synthesis Prompt (Mandatory Thinking)
SYNTHESIS_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "context"],
    template="""You are an Faculty for engineering students who has inde[th klnowledge in all engineering subjects and am Expert for an academic audience, ranging from undergraduates to PhD scholars. . Your goal is to answer the user's query based on the provided context document chunks, augmented with your general knowledge when necessary. You have to Provide detailed, technical, and well-structured responses suitable for this audience. Use precise terminology, include relevant concepts, algorithms, and applications, and organize your response with sections or bullet points where appropriate.
                

**TASK:** Respond to the user's query using the provided context and your general knowledge.

**USER QUERY:**
"{query}"

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---

**INSTRUCTIONS:**

**STEP 1: THINKING PROCESS (MANDATORY):**
*   **CRITICAL:** Before writing the final answer, first articulate your step-by-step reasoning process for how you will arrive at the answer. Explain how you will use the context and potentially supplement it with general knowledge.
*   Use a step-by-step Chain of Thought (CoT) approach to arrive at a logical and accurate answer, and include your reasoning in a <think> tag.Enclose this entire reasoning process   *exclusively* within `<thinking>` and `</thinking>` tags.
*   Example: `<thinking>The user asks about X. Context [1] defines X. Context [3] gives an example Z. Context [2] seems less relevant. The context doesn't cover aspect Y, so I will synthesize information from [1] and [3] and then add general knowledge about Y, clearly indicating it's external information.</thinking>`
*   **DO NOT** put any text before `<thinking>` or after `</thinking>` except for the final answer.

**STEP 2: FINAL ANSWER (After the `</thinking>` tag):**
*   Provide a comprehensive and helpful answer to the user query.
*   **Prioritize Context:** Base your answer **primarily** on information within the `PROVIDED CONTEXT`.
*   **Cite Sources:** When using information *directly* from a context chunk, **you MUST cite** its number like [1], [2], [1][3]. Cite all relevant sources for each piece of information derived from the context.
*   **Insufficient Context:** If the context does not contain information needed for a full answer, explicitly state what is missing (e.g., "The provided documents don't detail the specific algorithm used...").
*   **Integrate General Knowledge:** *Seamlessly integrate* your general knowledge to fill gaps, provide background, or offer broader explanations **after** utilizing the context. Clearly signal when you are using general knowledge (e.g., "Generally speaking...", "From external knowledge...", "While the documents focus on X, it's also important to know Y...").
*   **Be a Tutor:** Explain concepts clearly. Be helpful, accurate, and conversational. Use Markdown formatting (lists, bolding, code blocks) for readability.
*   **Accuracy:** Do not invent information not present in the context or verifiable general knowledge. If unsure, state that.

**BEGIN RESPONSE (Start *immediately* with the `<thinking>` tag):**
<thinking>"""
)

# Analysis Prompts (Thinking Recommended)
_ANALYSIS_THINKING_PREFIX = """**STEP 1: THINKING PROCESS (Recommended):**
*   Before generating the analysis, briefly outline your plan in `<thinking>` tags. Example: `<thinking>Analyzing for FAQs. Will scan for key questions and answers presented in the text.</thinking>`
*   If you include thinking, place the final analysis *after* the `</thinking>` tag.

**STEP 2: ANALYSIS OUTPUT:**
*   Generate the requested analysis based **strictly** on the text provided below.
*   Follow the specific OUTPUT FORMAT instructions carefully.

--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
"""

ANALYSIS_PROMPTS = {
    "faq": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate 5-7 Frequently Asked Questions (FAQs) with concise answers based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first FAQ (after thinking, if used). Do **NOT** include preamble.
*   Format each FAQ as:
    Q: [Question derived ONLY from the text]
    A: [Answer derived ONLY from the text, concise]
*   If the text doesn't support an answer, don't invent one. Use Markdown for formatting if appropriate (e.g., lists within an answer).

**BEGIN OUTPUT (Start with 'Q:' or `<thinking>`):**
"""
    ),
    "topics": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Identify the 5-8 most important topics discussed. Provide a 1-2 sentence explanation per topic based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first topic (after thinking, if used). Do **NOT** include preamble.
*   Format as a Markdown bulleted list:
    *   **Topic Name:** Brief explanation derived ONLY from the text content (1-2 sentences max).

**BEGIN OUTPUT (Start with '*   **' or `<thinking>`):**
"""
    ),
    "mindmap": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate a mind map outline in Markdown list format representing key concepts and hierarchy ONLY from the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the main topic as the top-level item (using '-') (after thinking, if used). Do **NOT** include preamble.
*   Use nested Markdown lists ('-' or '*') with indentation (2 or 4 spaces) for hierarchy.
*   Focus **strictly** on concepts and relationships mentioned in the text. Be concise.

**BEGIN OUTPUT (Start with e.g., '- Main Topic' or `<thinking>`):**
"""
    )
}


# --- Logging Setup ---
def setup_logging():
    """Configures application-wide logging."""
    logging.basicConfig(level=LOGGING_LEVEL, format=LOGGING_FORMAT)
    # Suppress excessive logging from noisy libraries if necessary
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("faiss.loader").setLevel(logging.WARNING) # FAISS can be verbose
    # Add more loggers to suppress as needed

    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level {LOGGING_LEVEL_NAME}")
    logger.debug(f"OLLAMA_BASE_URL={OLLAMA_BASE_URL}")
    logger.debug(f"OLLAMA_MODEL={OLLAMA_MODEL}")
    logger.debug(f"OLLAMA_EMBED_MODEL={OLLAMA_EMBED_MODEL}")
    logger.debug(f"FAISS_FOLDER={FAISS_FOLDER}")
    logger.debug(f"UPLOAD_FOLDER={UPLOAD_FOLDER}")
    logger.debug(f"DATABASE_PATH={DATABASE_PATH}")
    logger.debug(f"RAG_CHUNK_K={RAG_CHUNK_K}, RAG_SEARCH_K_PER_QUERY={RAG_SEARCH_K_PER_QUERY}, MULTI_QUERY_COUNT={MULTI_QUERY_COUNT}")
    logger.debug(f"ANALYSIS_MAX_CONTEXT_LENGTH={ANALYSIS_MAX_CONTEXT_LENGTH}")
