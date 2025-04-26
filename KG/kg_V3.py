import os
import ollama
import json
# Removed pdfminer import as text is read from file directly
# from pdfminer.high_level import extract_text
from tqdm import tqdm
import logging
import concurrent.futures # Added for parallelization
import time # Optional: for adding delays if needed

# Set up logging to capture warnings and errors
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Configure Ollama client
# Ensure this client instance is thread-safe or create new ones if needed.
# The official ollama-python client is generally thread-safe for requests.
ollama_client = ollama.Client(host="http://172.180.9.127:11434")

# Path to the text file (previously PDF)
file_path = "./default_pdfs/229.txt"
try:
    with open(file_path, "r", encoding='utf-8') as file: # Added encoding
         lecture_notes = file.read()
    logger.info(f"Successfully read text file: {file_path}")
except FileNotFoundError:
    logger.error(f"Error: File not found at {file_path}")
    exit() # Exit if the file doesn't exist
except Exception as e:
    logger.error(f"Error reading file {file_path}: {e}")
    exit()


# Function to split text into chunks (no changes needed)
def split_into_chunks(text, chunk_size=2048, overlap=256):
    logger.info(f"Splitting text into chunks (size={chunk_size}, overlap={overlap})...")
    chunks = []
    start = 0
    text_len = len(text) # Calculate length once
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        # Make sure overlap doesn't push start beyond end when chunk_size is small
        next_start = end - overlap
        # Ensure start always progresses, handle last chunk without negative overlap
        start = max(next_start, start + 1) if end < text_len else end
    logger.info(f"Split text into {len(chunks)} chunks.")
    return chunks

# Prompt template (no changes needed)
prompt_template = """
You are an expert in knowledge graph creation. I have a chunk of lecture notes on machine learning. Your task is to read the text and create a partial graph-based memory map. Identify major topics as top-level nodes, subtopics as subnodes under their respective parents, and relationships between nodes. Output the result as a valid JSON object with "nodes" and "edges" sections. Ensure the JSON is complete and properly formatted. Ensure all node IDs and relationship types are strings.

Text chunk:
{chunk_text}

Output format:
{{
  "nodes": [
    {{"id": "Node Name", "type": "major/subnode", "parent": "Parent Node (if subnode) or null", "description": "Short description (max 50 words)"}},
    ...
  ],
  "edges": [
    {{"from": "Node A", "to": "Node B", "relationship": "subtopic/depends_on/related_to"}},
    ...
  ]
}}
"""

# --- Function to process a single chunk (for parallel execution) ---
def process_single_chunk(chunk_data):
    """
    Processes a single chunk of text to generate a graph fragment.
    Handles API calls and JSON parsing.

    Args:
        chunk_data (tuple): A tuple containing (index, chunk_text).

    Returns:
        dict or None: The parsed graph data as a dictionary, or None if an error occurs.
    """
    index, chunk_text = chunk_data
    chunk_num = index + 1 # For logging (1-based index)
    full_prompt = prompt_template.format(chunk_text=chunk_text)

    try:
        # logger.debug(f"Processing chunk {chunk_num} in parallel...") # Debug level might be too verbose
        response = ollama_client.chat(
            model="qwen2.5:14b-instruct",  # Use your desired model
            messages=[{"role": "user", "content": full_prompt}],
            format="json",
            options={"num_ctx": 4096, "temperature": 0.3}  # Optimize for determinism
        )

        # Parse response
        content = response.get('message', {}).get('content', '')
        if not content:
            logger.warning(f"Empty response content for chunk {chunk_num}")
            return None # Return None on failure

        try:
            # Attempt to strip potential markdown code fences if present
            if content.strip().startswith("```json"):
                content = content.strip()[7:-3].strip()
            elif content.strip().startswith("```"):
                 content = content.strip()[3:-3].strip()

            graph_data = json.loads(content)

            # Basic validation of the parsed structure
            if isinstance(graph_data, dict) and 'nodes' in graph_data and 'edges' in graph_data and \
               isinstance(graph_data['nodes'], list) and isinstance(graph_data['edges'], list):
                # logger.debug(f"Successfully processed chunk {chunk_num}.") # Optional success log
                return graph_data # Return the valid graph data
            else:
                logger.warning(f"Invalid graph structure or types received for chunk {chunk_num}. Data: {content[:200]}...") # Log snippet
                return None # Return None on failure

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error in chunk {chunk_num}: {e}")
            logger.debug(f"Raw response content for chunk {chunk_num}: {content}")
            return None # Return None on failure

    except Exception as e:
        logger.error(f"LLM API call error or other processing error in chunk {chunk_num}: {e}")
        # Consider adding a small delay or retry logic here if errors are transient
        # time.sleep(1) # Example delay
        return None # Return None on failure
# --- End of process_single_chunk function ---


# Function to merge graphs (no changes needed)
def merge_graphs(graphs):
    logger.info("Merging graphs...")
    final_nodes = {}
    final_edges = set() # Use a set to automatically handle duplicate edges

    for i, graph in enumerate(graphs):
        # Added check for None graphs which might result from failed parallel tasks
        if graph is None:
            logger.warning(f"Skipping None graph at index {i} (likely due to processing error).")
            continue
        if not isinstance(graph, dict) or 'nodes' not in graph or 'edges' not in graph:
            logger.warning(f"Skipping invalid graph structure at index {i}")
            continue

        # Process nodes
        if isinstance(graph['nodes'], list):
            for node in graph['nodes']:
                if not isinstance(node, dict):
                    logger.warning(f"Skipping non-dict node item in graph {i}: {node}")
                    continue
                node_id = node.get('id')
                if not node_id or not isinstance(node_id, str): # Ensure node_id exists and is a string
                    logger.warning(f"Skipping node without valid string ID in graph {i}: {node}")
                    continue
                if node_id not in final_nodes:
                    final_nodes[node_id] = node
                else:
                    # Optional: Merge descriptions or other properties if needed
                    existing_desc = final_nodes[node_id].get('description', '')
                    new_desc = node.get('description', '')
                    if isinstance(new_desc, str) and len(new_desc) > len(existing_desc):
                         final_nodes[node_id]['description'] = new_desc
                    if final_nodes[node_id].get('parent') is None and node.get('parent') is not None:
                        final_nodes[node_id]['parent'] = node.get('parent')
                    if final_nodes[node_id].get('type') is None and node.get('type') is not None:
                        final_nodes[node_id]['type'] = node.get('type')
        else:
            logger.warning(f"Graph {i} has non-list 'nodes' field: {type(graph['nodes'])}")


        # Process edges
        if isinstance(graph['edges'], list):
            for edge in graph['edges']:
                if not isinstance(edge, dict):
                    logger.warning(f"Skipping non-dict edge item in graph {i}: {edge}")
                    continue
                if not all(k in edge for k in ['from', 'to', 'relationship']):
                    logger.warning(f"Skipping edge with missing keys in graph {i}: {edge}")
                    continue

                from_node = edge['from']
                to_node = edge['to']
                relationship = edge['relationship']

                if not isinstance(from_node, str) or not isinstance(to_node, str) or not isinstance(relationship, str):
                    logger.warning(
                        f"Skipping edge with non-string component(s) in graph {i}: {edge}. "
                        f"Types: from={type(from_node)}, to={type(to_node)}, rel={type(relationship)}"
                    )
                    continue

                edge_tuple = (from_node, to_node, relationship)
                final_edges.add(edge_tuple)
        else:
            logger.warning(f"Graph {i} has non-list 'edges' field: {type(graph['edges'])}")


    final_edge_list = [{"from": e[0], "to": e[1], "relationship": e[2]} for e in final_edges]

    return {
        "nodes": list(final_nodes.values()),
        "edges": final_edge_list
    }

# Function to save graph (no changes needed)
def save_graph(graph, filename="kg3.json"): # Changed default filename slightly
    try:
        logger.info(f"Saving graph to {filename}...")
        with open(filename, "w", encoding='utf-8') as file: # Added encoding
            json.dump(graph, file, indent=2, ensure_ascii=False) # Added ensure_ascii=False
        logger.info(f"Graph saved successfully to {filename}")
    except Exception as e:
        logger.error(f"Error saving graph: {e}")

# --- Main Execution Logic ---

# Split text into chunks
chunks = split_into_chunks(lecture_notes, chunk_size=2048, overlap=256)
all_graphs = [] # Initialize list to store results

# --- Parallel Processing using ThreadPoolExecutor ---
# Determine the number of workers (threads)
# Adjust max_workers based on your Ollama server's capacity and network latency
# Too many might overload the server or not provide further speedup.
# Start with a moderate number, e.g., 5, 10, or os.cpu_count()
MAX_WORKERS = 10 # Example: Set to 10 concurrent requests
logger.info(f"Starting parallel processing with up to {MAX_WORKERS} workers...")

# Use ThreadPoolExecutor to process chunks in parallel
with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    # Create a list of tasks to submit. We use enumerate to pass the index along with the chunk.
    # The process_single_chunk function expects a tuple (index, chunk_text).
    tasks = {executor.submit(process_single_chunk, (i, chunk)): i for i, chunk in enumerate(chunks)}

    # Process results as they complete, using tqdm for progress
    # Use as_completed to get results as soon as they are ready
    # Wrap with tqdm for a progress bar
    results = [None] * len(chunks) # Pre-allocate list to store results in order
    for future in tqdm(concurrent.futures.as_completed(tasks), total=len(chunks), desc="Processing chunks", unit="chunk"):
        original_index = tasks[future] # Get the original index of the chunk
        try:
            graph_data = future.result() # Get the result (graph dict or None)
            results[original_index] = graph_data # Store result in the correct position
        except Exception as exc:
            logger.error(f'Chunk {original_index + 1} generated an exception: {exc}')
            # results[original_index] remains None

# Filter out None results (failed chunks) before merging
all_graphs = [graph for graph in results if graph is not None]
logger.info(f"Successfully processed {len(all_graphs)} out of {len(chunks)} chunks.")

# --- End of Parallel Processing ---


# Merge and save graphs (no changes needed in this part's logic)
if all_graphs:
    logger.info(f"Attempting to merge {len(all_graphs)} graphs.")
    final_graph = merge_graphs(all_graphs) # Pass the collected valid graphs
    logger.info("Final Merged Graph (Nodes: {}, Edges: {}):".format(len(final_graph.get('nodes', [])), len(final_graph.get('edges', []))))
    save_graph(final_graph,'kg3.json')
else:
    logger.error("No valid graphs were generated or processed successfully.")

logger.info("Knowledge graph generation process finished.")
