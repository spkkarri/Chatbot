# server/rag_service/knowledge_graph_generator.py
import logging
import json
import re
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

KG_GENERATION_PROMPT = """
You are an expert data architect. Your task is to analyze the provided text and extract a detailed knowledge graph. The graph should represent the core entities, concepts, and their relationships.

**INSTRUCTIONS:**
1.  **Identify Entities/Nodes**: Identify the key entities (people, places, concepts, processes, technologies). These will be your nodes. For each node, provide a unique ID (a short, descriptive string) and a 'type' (e.g., 'Concept', 'Technology', 'Process').
2.  **Identify Relationships/Edges**: Determine how these nodes are connected. The relationship should be a descriptive verb phrase (e.g., 'IS_A', 'USES', 'RESULTS_IN', 'PART_OF').
3.  **Format as JSON**: Your entire output MUST be a single, valid JSON object containing two keys: "nodes" and "edges".
    -   **Nodes**: An array of objects, where each object is `{"id": "NodeID", "label": "Full Node Name", "type": "NodeType"}`. The `label` is the full name, the `id` is a concise version for linking.
    -   **Edges**: An array of objects, where each object is `{"from": "SourceNodeID", "to": "TargetNodeID", "relationship": "RELATIONSHIP_TYPE"}`.
4.  **Be Thorough**: Extract as many meaningful nodes and edges as possible to create a rich, interconnected graph.

---
**DOCUMENT TEXT TO ANALYZE:**
__DOCUMENT_TEXT_PLACEHOLDER__
---

**FINAL KNOWLEDGE GRAPH JSON (start immediately with `{`):**
"""

def generate_graph_from_text(document_text: str, llm_function) -> Dict[str, Any]:
    """Uses an LLM to generate a knowledge graph from a block of text."""
    logger.info(f"Generating knowledge graph from text of length {len(document_text)}...")
    
    prompt = KG_GENERATION_PROMPT.replace(
        "__DOCUMENT_TEXT_PLACEHOLDER__", 
        document_text[:60000]
    )
    
    response_text = llm_function(prompt)
    
    if not response_text or not response_text.strip():
        raise ValueError("LLM failed to generate knowledge graph content.")
        
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if not json_match:
        raise ValueError("LLM response did not contain a valid JSON object for the knowledge graph.")
    
    json_string = json_match.group(0)
    
    try:
        graph_data = json.loads(json_string)
        if "nodes" not in graph_data or "edges" not in graph_data:
            raise ValueError("Parsed JSON is missing 'nodes' or 'edges' keys.")
        
        logger.info(f"Successfully generated knowledge graph with {len(graph_data['nodes'])} nodes and {len(graph_data['edges'])} edges.")
        return graph_data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from LLM response for KG: {e}")
        raise ValueError("LLM returned invalid JSON format for the knowledge graph.") from e