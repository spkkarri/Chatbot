import os
import ollama
import json
from pdfminer.high_level import extract_text
from tqdm import tqdm
import logging

# Set up logging to capture warnings and errors
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Configure Ollama client
ollama_client = ollama.Client(host="http://172.180.9.127:11434")

# Path to the PDF file
file_path = "./default_pdfs/229.txt"
with open(file_path, "r") as file:
     lecture_notes = file.read()


# Function to split text into chunks
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

# Prompt template
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

# Function to merge graphs
def merge_graphs(graphs):
    logger.info("Merging graphs...")
    final_nodes = {}
    final_edges = set() # Use a set to automatically handle duplicate edges

    for i, graph in enumerate(graphs):
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
                    # Example: Prioritize longer descriptions
                    existing_desc = final_nodes[node_id].get('description', '')
                    new_desc = node.get('description', '')
                    if isinstance(new_desc, str) and len(new_desc) > len(existing_desc):
                         final_nodes[node_id]['description'] = new_desc
                    # Ensure 'parent' and 'type' are also reasonable, potentially updating if null previously
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
                # Check if essential keys exist
                if not all(k in edge for k in ['from', 'to', 'relationship']):
                    logger.warning(f"Skipping edge with missing keys in graph {i}: {edge}")
                    continue

                # ---- START: Key fix for the TypeError ----
                from_node = edge['from']
                to_node = edge['to']
                relationship = edge['relationship']

                # Check if all components are strings (hashable)
                if not isinstance(from_node, str) or not isinstance(to_node, str) or not isinstance(relationship, str):
                    logger.warning(
                        f"Skipping edge with non-string component(s) in graph {i}: {edge}. "
                        f"Types: from={type(from_node)}, to={type(to_node)}, rel={type(relationship)}"
                    )
                    continue
                # ---- END: Key fix for the TypeError ----


                # Create a tuple representation of the edge (tuples are hashable)
                edge_tuple = (from_node, to_node, relationship)
                final_edges.add(edge_tuple) # Add the tuple to the set
        else:
            logger.warning(f"Graph {i} has non-list 'edges' field: {type(graph['edges'])}")


    # Convert the set of edge tuples back to a list of dictionaries
    final_edge_list = [{"from": e[0], "to": e[1], "relationship": e[2]} for e in final_edges]

    return {
        "nodes": list(final_nodes.values()),
        "edges": final_edge_list
    }

# Function to save graph
def save_graph(graph, filename="kgV1.json"):
    try:
        logger.info(f"Saving graph to {filename}...")
        with open(filename, "w") as file:
            json.dump(graph, file, indent=2)
        logger.info(f"Graph saved successfully to {filename}")
    except Exception as e:
        logger.error(f"Error saving graph: {e}")

# Split text into chunks
chunks = split_into_chunks(lecture_notes, chunk_size=2048, overlap=256)
all_graphs = []

# Process chunks
for i, chunk in enumerate(tqdm(chunks, desc="Processing chunks", unit="chunk")):
    full_prompt = prompt_template.format(chunk_text=chunk)

    try:
        logger.debug(f"Processing chunk {i+1}/{len(chunks)}...")
        response = ollama_client.chat(
            model="qwen2.5:14b-instruct",  # Use your desired model
            messages=[{"role": "user", "content": full_prompt}],
            format="json",
            options={"num_ctx": 4096, "temperature": 0.3}  # Optimize for determinism
        )

        # Parse response
        content = response.get('message', {}).get('content', '')
        if not content:
            logger.warning(f"Empty response content for chunk {i+1}")
            continue

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
                all_graphs.append(graph_data)
            else:
                logger.warning(f"Invalid graph structure or types received for chunk {i+1}. Data: {content[:200]}...") # Log snippet
                # Optionally save the bad response for debugging:
                # with open(f"bad_response_chunk_{i+1}.json", "w") as f:
                #     f.write(content)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error in chunk {i+1}: {e}")
            logger.debug(f"Raw response content for chunk {i+1}: {content}")
            # Optionally save the bad response for debugging:
            # with open(f"bad_response_chunk_{i+1}_parse_error.txt", "w") as f:
            #     f.write(content)
            continue

    except Exception as e:
        logger.error(f"LLM API call error or other processing error in chunk {i+1}: {e}")
        # Consider adding a small delay or retry logic here if errors are transient
        continue

# Merge and save graphs
if all_graphs:
    logger.info(f"Attempting to merge {len(all_graphs)} graphs.")
    final_graph = merge_graphs(all_graphs)
    logger.info("Final Merged Graph (Nodes: {}, Edges: {}):".format(len(final_graph.get('nodes', [])), len(final_graph.get('edges', []))))
    # Avoid printing potentially huge graph to console, rely on file output
    # print(json.dumps(final_graph, indent=2))
    save_graph(final_graph)
else:
    logger.error("No valid graphs were generated or processed successfully.")
