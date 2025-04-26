import os
import ollama
import json
from pdfminer.high_level import extract_text
from tqdm import tqdm
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Configure Ollama client
ollama_client = ollama.Client(host="http://172.180.9.127:11435")

# Path to the PDF file
file_path = "./default_pdfs/229.txt"
with open(file_path, "r") as file:
     lecture_notes = file.read()

# Function to split text into chunks
def split_into_chunks(text, chunk_size=4096, overlap=256):
    logger.info(f"Splitting text into chunks (size={chunk_size}, overlap={overlap})...")
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start = end - overlap if end < len(text) else end
    return chunks

# Prompt template with stricter JSON output instructions
prompt_template = """
You are an expert in knowledge graph creation. I have a chunk of lecture notes on machine learning. Your task is to read the text and create a partial graph-based memory map. Identify major topics as top-level nodes, subtopics as subnodes under their respective parents, and relationships between nodes. Output the result as a valid JSON object with "nodes" and "edges" sections. Ensure the JSON is complete, properly formatted, and the 'relationship' field in edges is a single string (e.g., "subtopic", "depends_on", "related_to"), not a list.

Text chunk:
{chunk_text}

Output format:
{{
  "nodes": [
    {{"id": "Node Name", "type": "major|subnode", "parent": "Parent Node (if subnode) or null", "description": "Short description (max 50 words)"}},
    ...
  ],
  "edges": [
    {{"from": "Node A", "to": "Node B", "relationship": "subtopic|depends_on|related_to"}},
    ...
  ]
}}
"""

# Function to merge graphs
def merge_graphs(graphs):
    logger.info("Merging graphs...")
    final_nodes = {}
    final_edges = set()
    
    for graph in graphs:
        if not isinstance(graph, dict) or 'nodes' not in graph or 'edges' not in graph:
            logger.warning("Skipping invalid graph")
            continue
            
        for node in graph['nodes']:
            node_id = node.get('id')
            if not node_id:
                logger.warning("Skipping node without ID")
                continue
            if node_id not in final_nodes:
                final_nodes[node_id] = node
            else:
                if len(node.get('description', '')) > len(final_nodes[node_id].get('description', '')):
                    final_nodes[node_id]['description'] = node['description']
        
        for edge in graph['edges']:
            if not all(k in edge for k in ['from', 'to', 'relationship']):
                logger.warning(f"Skipping invalid edge: {edge}")
                continue
            # Ensure edge fields are strings (hashable)
            from_node = str(edge['from']) if edge['from'] is not None else None
            to_node = str(edge['to']) if edge['to'] is not None else None
            relationship = str(edge['relationship']) if edge['relationship'] is not None else None
            
            if from_node and to_node and relationship:
                edge_tuple = (from_node, to_node, relationship)
                final_edges.add(edge_tuple)
            else:
                logger.warning(f"Skipping edge with invalid fields: {edge}")
    
    return {
        "nodes": list(final_nodes.values()),
        "edges": [{"from": e[0], "to": e[1], "relationship": e[2]} for e in final_edges]
    }

# Function to save graph
def save_graph(graph, filename="graph.json"):
    try:
        logger.info(f"Saving graph to {filename}...")
        # Ensure the directory exists
        if os.path.dirname(filename):
            os.makedirs(os.path.dirname(filename), exist_ok=True)
        # Use absolute path to avoid directory issues
        abs_filename = os.path.abspath(filename)
        with open(abs_filename, "w", encoding='utf-8') as file:
            json.dump(graph, file, indent=2)
        logger.info(f"Graph saved successfully to {abs_filename}")
    except Exception as e:
        logger.error(f"Error saving graph: {e}")
# Split text into chunks
chunks = split_into_chunks(lecture_notes, chunk_size=2048, overlap=256)
all_graphs = []

# Process chunks in parallel
def process_chunk(chunk, index, total_chunks):
    logger.debug(f"Processing chunk {index+1}/{total_chunks}...")
    full_prompt = prompt_template.format(chunk_text=chunk)

    try:
        response = ollama_client.chat(
            model="qwen2.5:14b-instruct",  # Switched to Qwen2.5-7B-Instruct
            messages=[{"role": "user", "content": full_prompt}],
            format="json",
            options={"num_ctx": 8192, "temperature": 0.2}  # Increased context, lower temperature
        )

        # Parse response
        content = response.get('message', {}).get('content', '')
        if not content:
            logger.warning(f"Empty response for chunk {index+1}")
            return None

        try:
            graph = json.loads(content)
            if isinstance(graph, dict) and 'nodes' in graph and 'edges' in graph:
                return graph
            else:
                logger.warning(f"Invalid graph structure for chunk {index+1}: {graph}")
                return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error in chunk {index+1}: {e}")
            logger.debug(f"Raw response: {content}")
            return None

    except Exception as e:
        logger.error(f"LLM error in chunk {index+1}: {e}")
        return None

logger.info(f"Processing {len(chunks)} chunks in parallel (using 16 cores)...")
with ThreadPoolExecutor(max_workers=16) as executor:  # Increased workers for 4 GPUs
    future_to_chunk = {
        executor.submit(process_chunk, chunk, i, len(chunks)): i
        for i, chunk in enumerate(chunks)
    }
    for future in tqdm(as_completed(future_to_chunk), total=len(chunks), desc="Processing chunks", unit="chunk"):
        chunk_idx = future_to_chunk[future]
        graph = future.result()
        if graph:
            logger.info(f"Chunk {chunk_idx+1} yielded a valid graph")
            all_graphs.append(graph)
        else:
            logger.warning(f"No valid graph from chunk {chunk_idx+1}")

# Merge and save graphs
if all_graphs:
    final_graph = merge_graphs(all_graphs)
    logger.info("Final Merged Graph:")
    print(json.dumps(final_graph, indent=2))
    save_graph(final_graph,"kg1.json")
else:
    logger.error("No graphs processed successfully.")
