import json
import os
import logging
from collections import defaultdict
import textwrap

# --- Configuration ---
INPUT_JSON_FILE = "kg1.json"
# Changed output filename again for clarity
OUTPUT_HTML_VISJS = "kg1_visjs_interactive_progress.html"
DETAILS_DIV_ID = "nodeDetails"
MAX_LABEL_WIDTH = 15

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Function to Load JSON Data ---
# (Keep the load_json_data function as before)
def load_json_data(filename):
    """Loads graph data from a JSON file."""
    if not os.path.exists(filename):
        logger.error(f"Error: Input JSON file not found at '{filename}'")
        return None
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"Successfully loaded graph data from '{filename}'")
        if not isinstance(data, dict) or 'nodes' not in data or 'edges' not in data:
             logger.warning("Loaded JSON data does not have the expected 'nodes' and 'edges' keys.")
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from '{filename}': {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading '{filename}': {e}")
        return None

# --- Load the Data ---
logger.info(f"Attempting to load graph data from {INPUT_JSON_FILE}...")
graph_data = load_json_data(INPUT_JSON_FILE)
nodes_dict = {}

if graph_data and isinstance(graph_data.get('nodes'), list):
    nodes_dict = {node['id']: node for node in graph_data['nodes'] if isinstance(node, dict) and 'id' in node}
    logger.info(f"Created nodes_dict with {len(nodes_dict)} entries.")
    skipped_nodes = len(graph_data['nodes']) - len(nodes_dict)
    if skipped_nodes > 0:
        logger.warning(f"Skipped {skipped_nodes} entries from 'nodes' list due to missing 'id' or incorrect format.")
elif graph_data:
     logger.warning("Graph data loaded, but 'nodes' key is missing or not a list. Cannot create nodes_dict.")

# === STRATEGY 3: Direct Vis.js Integration ===

# --- Preprocess data specifically for Vis.js ---
# (Keep the prepare_visjs_data function as before, including text wrapping)
def prepare_visjs_data(graph_data, nodes_dict):
    """Separates nodes, hierarchical edges, and other edges. Wraps node labels."""
    vis_nodes = []
    hierarchical_edges_vis = []
    other_edges_vis = []
    if not nodes_dict:
        logger.error("Cannot prepare Vis.js data: nodes_dict is empty.")
        return [], [], []

    added_nodes = set(nodes_dict.keys())
    hierarchical_edge_tuples = set()

    node_type_colors = {"major": "#FF6347", "subnode": "#4682B4", "unknown": "#D3D3D3"}
    node_type_shapes = {"major": "star", "subnode": "dot", "unknown": "ellipse"}
    node_type_sizes = {"major": 25, "subnode": 15, "unknown": 15}

    logger.info(f"Wrapping node labels to approximately {MAX_LABEL_WIDTH} characters per line.")
    for node_id, node_data in nodes_dict.items():
        node_type = node_data.get('type', 'unknown')
        wrapped_label = textwrap.fill(node_id, width=MAX_LABEL_WIDTH)
        vis_nodes.append({
            "id": node_id,
            "label": wrapped_label,
            "title": f"<b>{node_id}</b> ({node_type})<hr>{node_data.get('description', 'N/A')}",
            "shape": node_type_shapes.get(node_type, "ellipse"),
            "size": node_type_sizes.get(node_type, 15),
            "color": node_type_colors.get(node_type, node_type_colors["unknown"]),
            "description": node_data.get('description', 'No description provided.'),
            "node_type": node_type
        })

    for node_id, node_data in nodes_dict.items():
        parent_id = node_data.get('parent')
        if parent_id and parent_id in added_nodes:
            edge_tuple = (parent_id, node_id)
            hierarchical_edge_tuples.add(edge_tuple)
            hierarchical_edges_vis.append({
                "from": parent_id, "to": node_id, "arrows": "to",
                "title": f"Subtopic of {parent_id}",
                "color": {"color": "#333333", "highlight": "#000000"},
                "width": 2, "dashes": False, "is_hierarchical": True
            })

    if graph_data and isinstance(graph_data.get('edges'), list):
        for edge_data in graph_data['edges']:
            if not isinstance(edge_data, dict): continue
            source = edge_data.get('from')
            target = edge_data.get('to')
            relationship = edge_data.get('relationship', 'related_to')
            if source in added_nodes and target in added_nodes:
                if (source, target) not in hierarchical_edge_tuples:
                    other_edges_vis.append({
                        "id": f"other_{source}_{target}_{relationship}",
                        "from": source, "to": target, "arrows": "to",
                        "title": f"{relationship}",
                        "color": {"color": "#cccccc", "highlight": "#aaaaaa"},
                        "width": 1, "dashes": True, "is_hierarchical": False
                    })
    elif graph_data:
        logger.warning("Graph data exists, but 'edges' key is missing or not a list. No 'other' edges will be processed.")

    logger.info(f"Prepared Vis.js data: {len(vis_nodes)} nodes, {len(hierarchical_edges_vis)} hierarchy edges, {len(other_edges_vis)} other edges.")
    return vis_nodes, hierarchical_edges_vis, other_edges_vis

# --- HTML Template (MODIFIED) ---
# --- HTML Template (CORRECTED WITH ESCAPED BRACES) ---
html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>KG1 Visualization (Vis.js Interactive - Progress)</title>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style type="text/css">
        body {{ font-family: sans-serif; margin: 0; display: flex; height: 100vh; }} /* Escaped braces */
        #networkContainer {{ flex-grow: 1; height: 100%; border-right: 1px solid lightgray; position: relative; }} /* Escaped braces */
        #mynetwork {{ width: 100%; height: 100%; }} /* Escaped braces */
        #detailsContainer {{ width: 300px; height: 100%; overflow-y: auto; padding: 15px; box-sizing: border-box; background-color: #f8f8f8; }} /* Escaped braces */
        #detailsContainer h3 {{ margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }} /* Escaped braces */
        #detailsContainer p {{ font-size: 0.9em; line-height: 1.4; }} /* Escaped braces */

        /* Loading Overlay Styles */
        .loading-overlay {{
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(255, 255, 255, 0.85); /* Slightly more opaque */
            z-index: 10;
            display: flex; /* Use flexbox for centering */
            flex-direction: column; /* Stack items vertically */
            justify-content: center;
            align-items: center;
            font-size: 1.2em;
            text-align: center; /* Center text */
        }} /* Escaped braces */

        /* Progress Bar Styles */
        #progressBarContainer {{
            width: 80%; /* Width of the progress bar */
            max-width: 400px; /* Max width */
            background-color: #e0e0e0;
            border-radius: 5px;
            overflow: hidden; /* Hide overflowing inner bar */
            margin-top: 15px; /* Space below the text */
            height: 20px; /* Height of the bar */
            border: 1px solid #ccc;
        }} /* Escaped braces */
        #progressBarInner {{
            width: 0%; /* Start at 0% */
            height: 100%;
            background-color: #4CAF50; /* Green progress color */
            text-align: center; /* Center percentage text if needed */
            line-height: 20px; /* Vertically center text */
            color: white;
            font-size: 0.8em;
            transition: width 0.2s ease-out; /* Smooth transition */
        }} /* Escaped braces */
        #progressText {{
             margin-bottom: 5px; /* Space above progress bar */
        }} /* Escaped braces */
    </style>
</head>
<body>
    <div id="networkContainer">
        <div id="mynetwork"></div>
        <!-- Modified Loading Overlay -->
        <div id="loadingOverlay" class="loading-overlay">
            <div id="progressText">Loading & Initial Layout...</div>
            <div id="progressBarContainer">
                <div id="progressBarInner"></div>
            </div>
        </div>
    </div>
    <div id="detailsContainer">
        <h3>Node Details</h3>
        <div id="{details_div_id}">Select a node to see details.</div> <!-- KEEP SINGLE BRACES HERE -->
    </div>

    <script type="text/javascript">
        // --- Embedded Data ---
        const nodesData = {nodes_json}; /* KEEP SINGLE BRACES HERE */
        const hierarchicalEdgesData = {hierarchical_edges_json}; /* KEEP SINGLE BRACES HERE */
        const otherEdgesData = {other_edges_json}; /* KEEP SINGLE BRACES HERE */
        const detailsDivId = "{details_div_id}"; /* KEEP SINGLE BRACES HERE */
        // ---------------------

        const nodes = new vis.DataSet(nodesData);
        const hierarchicalEdges = new vis.DataSet(hierarchicalEdgesData);
        const dynamicOtherEdges = new vis.DataSet([]);

        const container = document.getElementById('mynetwork');
        const detailsDiv = document.getElementById(detailsDivId);
        // --- Get Loading Elements ---
        const loadingOverlay = document.getElementById('loadingOverlay');
        const progressText = document.getElementById('progressText');
        const progressBarInner = document.getElementById('progressBarInner');
        // --------------------------

        const allEdges = new vis.DataSet(hierarchicalEdges.get());

        // Escape braces for JS object literal
        const data = {{
            nodes: nodes,
            edges: allEdges
        }};

        // Escape braces for JS object literal and nested objects
        const options = {{
            layout: {{
                hierarchical: {{
                    enabled: true, levelSeparation: 150, nodeSpacing: 120,
                    treeSpacing: 220, direction: 'UD', sortMethod: 'directed'
                }}
            }},
            physics: {{
                enabled: true, // Keep physics enabled initially for layout
                stabilization: {{ // Fine-tune stabilization if needed
                    enabled: true,
                    iterations: 1000, // Default is 1000
                    updateInterval: 25 // Default 50, update progress more often?
                }},
                hierarchicalRepulsion: {{
                    centralGravity: 0.0, springLength: 100, springConstant: 0.01,
                    nodeDistance: 120, damping: 0.09
                }},
                minVelocity: 0.75,
                solver: 'hierarchicalRepulsion'
            }},
            interaction: {{ hover: true, tooltipDelay: 300 }},
            nodes: {{
                borderWidth: 1, borderWidthSelected: 2,
                font: {{ multi: 'html' }} // Escaped braces for font object
            }},
            edges: {{
                smooth: {{ type: "cubicBezier", forceDirection: "vertical", roundness: 0.4 }} // Escaped braces for smooth object
            }}
        }};

        const network = new vis.Network(container, data, options);
        let currentlyShownOtherEdges = [];

        // --- Event Listeners ---

        // Escape braces for function body
        network.on("stabilizationProgress", function(params) {{
            const progressPercentage = Math.min(100, Math.max(0, (params.iterations / params.total) * 100));
            // console.log(`Stabilization progress: ${{params.iterations}}/${{params.total}} (${{progressPercentage.toFixed(1)}}%)`); // Escape template literal braces
            if (progressBarInner) {{
                progressBarInner.style.width = progressPercentage + '%';
            }}
            if (progressText) {{
                 // Update text to show percentage
                 progressText.innerText = `Calculating Layout: ${{Math.round(progressPercentage)}}%`; // Escape template literal braces
            }}
        }});

        // Escape braces for function body
        network.on("stabilizationIterationsDone", function () {{
            console.log("Stabilization finished."); // For debugging
            if (progressBarInner) {{
                 progressBarInner.style.width = '100%'; // Ensure it shows 100% briefly
            }}
             if (progressText) {{
                 progressText.innerText = 'Layout Complete!';
            }}
            // Hide the overlay after a short delay to show completion
            setTimeout(() => {{ // Arrow function syntax also uses braces
                if (loadingOverlay) {{
                    loadingOverlay.style.display = 'none';
                }}
            }}, 300); // 300ms delay

            // Optional: Disable physics now for smoother interaction
            // network.setOptions({{ physics: false }}); // Escape braces if uncommented
            // console.log("Physics disabled after stabilization.");
        }});

        // Escape braces for function body and template literals
        network.on("selectNode", function (params) {{
            if (params.nodes.length > 0) {{
                const selectedNodeId = params.nodes[0];
                const nodeData = nodes.get(selectedNodeId);
                if (nodeData && detailsDiv) {{
                    // Escape braces for template literal interpolation
                    detailsDiv.innerHTML = `
                        <h3>${{nodeData.id}} Details</h3>
                        <p><b>Type:</b> ${{nodeData.node_type || 'unknown'}}</p>
                        <p><b>Description:</b><br>${{nodeData.description || 'N/A'}}</p>
                    `;
                }} else {{
                     detailsDiv.innerHTML = "<h3>Node Details</h3><p>Details not found.</p>";
                }}
                if (currentlyShownOtherEdges.length > 0) {{
                    allEdges.remove(currentlyShownOtherEdges);
                    currentlyShownOtherEdges = [];
                }}
                const relevantEdges = otherEdgesData.filter(edge => edge.from === selectedNodeId || edge.to === selectedNodeId);
                if (relevantEdges.length > 0) {{
                    allEdges.add(relevantEdges);
                    currentlyShownOtherEdges = relevantEdges.map(edge => edge.id);
                    // Escape braces for template literal interpolation
                    detailsDiv.innerHTML += `<p><b>Other Relationships Shown (${{relevantEdges.length}})</b></p>`;
                }}
            }}
        }});

        // Escape braces for function body
         network.on("deselectNode", function (params) {{
             detailsDiv.innerHTML = "<h3>Node Details</h3><p>Select a node to see details.</p>";
             if (currentlyShownOtherEdges.length > 0) {{
                 allEdges.remove(currentlyShownOtherEdges);
                 currentlyShownOtherEdges = [];
             }}
         }});

        // Escape braces for function body
         network.on("click", function (params) {{
             if (params.nodes.length === 0 && params.edges.length === 0) {{ // Clicked on background
                 detailsDiv.innerHTML = "<h3>Node Details</h3><p>Select a node to see details.</p>";
                 if (currentlyShownOtherEdges.length > 0) {{
                     allEdges.remove(currentlyShownOtherEdges);
                     currentlyShownOtherEdges = [];
                 }}
             }}
         }});

    </script>
</body>
</html>
"""

# --- Main execution for Strategy 3 ---
# (Keep the rest of your Python code exactly the same)
logger.info("Starting Strategy 3: Generating Vis.js Interactive HTML with Progress Bar...")

if graph_data and nodes_dict:
    vis_nodes, hierarchical_edges, other_edges = prepare_visjs_data(graph_data, nodes_dict)

    if not vis_nodes:
        logger.error("Vis.js data preparation resulted in zero nodes. Aborting HTML generation.")
    else:
        # This line should now work correctly
        html_content = html_template.format(
            nodes_json=json.dumps(vis_nodes, indent=None),
            hierarchical_edges_json=json.dumps(hierarchical_edges, indent=None),
            other_edges_json=json.dumps(other_edges, indent=None),
            details_div_id=DETAILS_DIV_ID
        )

        try:
            with open(OUTPUT_HTML_VISJS, 'w', encoding='utf-8') as f:
                f.write(html_content)
            logger.info(f"Vis.js interactive graph saved to {OUTPUT_HTML_VISJS}")
            print(f"\n>>> Open '{OUTPUT_HTML_VISJS}' in your browser. Click nodes to see details and related links.")
        except Exception as e:
            logger.error(f"Failed to write Vis.js HTML file: {e}")

elif graph_data and not nodes_dict:
     logger.error("Graph data loaded, but failed to create nodes_dict. Cannot generate Vis.js graph.")
else:
    logger.error("No graph data loaded or processed, cannot generate Vis.js graph.")

print("-" * 30)
logger.info("Strategy 3 execution finished.")
