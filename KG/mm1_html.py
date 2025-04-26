import json
import os
import logging
from collections import defaultdict # Keep this if needed elsewhere, not strictly required for this part

# --- Configuration ---
INPUT_JSON_FILE = "kg1.json" # Define the input file name
OUTPUT_HTML_VISJS = "kg1_visjs_interactive.html"
DETAILS_DIV_ID = "nodeDetails" # ID for the details panel

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Function to Load JSON Data ---
def load_json_data(filename):
    """Loads graph data from a JSON file."""
    if not os.path.exists(filename):
        logger.error(f"Error: Input JSON file not found at '{filename}'")
        return None
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"Successfully loaded graph data from '{filename}'")
        # Basic validation
        if not isinstance(data, dict) or 'nodes' not in data or 'edges' not in data:
             logger.warning("Loaded JSON data does not have the expected 'nodes' and 'edges' keys.")
             # Decide if you want to return None or the data as is
             # return None
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from '{filename}': {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading '{filename}': {e}")
        return None

# --- Load the Data (This was the missing part) ---
logger.info(f"Attempting to load graph data from {INPUT_JSON_FILE}...")
graph_data = load_json_data(INPUT_JSON_FILE)
nodes_dict = {} # Initialize nodes_dict

if graph_data and isinstance(graph_data.get('nodes'), list):
    # Create a dictionary for quick node lookup by ID
    nodes_dict = {node['id']: node for node in graph_data['nodes'] if isinstance(node, dict) and 'id' in node}
    logger.info(f"Created nodes_dict with {len(nodes_dict)} entries.")
    # Optional: Log if some nodes were skipped
    skipped_nodes = len(graph_data['nodes']) - len(nodes_dict)
    if skipped_nodes > 0:
        logger.warning(f"Skipped {skipped_nodes} entries from 'nodes' list due to missing 'id' or incorrect format.")
elif graph_data:
     logger.warning("Graph data loaded, but 'nodes' key is missing or not a list. Cannot create nodes_dict.")
# If graph_data is None, the error is already logged by load_json_data

# === STRATEGY 3: Direct Vis.js Integration ===

# --- Preprocess data specifically for Vis.js ---
# (Keep your prepare_visjs_data function exactly as it was)
def prepare_visjs_data(graph_data, nodes_dict):
    """Separates nodes, hierarchical edges, and other edges."""
    vis_nodes = []
    hierarchical_edges_vis = []
    other_edges_vis = []
    # Ensure nodes_dict is not empty before proceeding
    if not nodes_dict:
        logger.error("Cannot prepare Vis.js data: nodes_dict is empty.")
        return [], [], []

    added_nodes = set(nodes_dict.keys())
    hierarchical_edge_tuples = set() # Track parent-child links

    node_type_colors = {"major": "#FF6347", "subnode": "#4682B4", "unknown": "#D3D3D3"}
    node_type_shapes = {"major": "star", "subnode": "dot", "unknown": "ellipse"}
    node_type_sizes = {"major": 25, "subnode": 15, "unknown": 15}

    # Format nodes for Vis.js
    for node_id, node_data in nodes_dict.items():
        node_type = node_data.get('type', 'unknown')
        vis_nodes.append({
            "id": node_id,
            "label": node_id,
            "title": f"<b>{node_id}</b> ({node_type})<hr>{node_data.get('description', 'N/A')}", # Hover title
            "shape": node_type_shapes.get(node_type, "ellipse"),
            "size": node_type_sizes.get(node_type, 15),
            "color": node_type_colors.get(node_type, node_type_colors["unknown"]),
            "description": node_data.get('description', 'No description provided.'), # Store full description for JS
            "node_type": node_type # Store type for potential JS logic
        })

    # Identify and format hierarchical edges
    for node_id, node_data in nodes_dict.items():
        parent_id = node_data.get('parent')
        if parent_id and parent_id in added_nodes:
            edge_tuple = (parent_id, node_id)
            hierarchical_edge_tuples.add(edge_tuple)
            hierarchical_edges_vis.append({
                "from": parent_id,
                "to": node_id,
                "arrows": "to",
                "title": f"Subtopic of {parent_id}",
                "color": {"color": "#333333", "highlight": "#000000"},
                "width": 2,
                "dashes": False,
                "is_hierarchical": True # Custom flag
            })

    # Format other edges (Ensure graph_data exists and has 'edges')
    if graph_data and isinstance(graph_data.get('edges'), list):
        for edge_data in graph_data['edges']:
            # Add checks for edge format
            if not isinstance(edge_data, dict):
                logger.warning(f"Skipping non-dictionary edge item: {edge_data}")
                continue
            source = edge_data.get('from')
            target = edge_data.get('to')
            relationship = edge_data.get('relationship', 'related_to')

            # Check if required fields exist and are valid nodes
            if source in added_nodes and target in added_nodes:
                # Only add if NOT the primary parent-child link
                if (source, target) not in hierarchical_edge_tuples:
                    other_edges_vis.append({
                        "id": f"other_{source}_{target}_{relationship}", # Unique ID for potential removal
                        "from": source,
                        "to": target,
                        "arrows": "to",
                        "title": f"{relationship}", # Simple title
                        "color": {"color": "#cccccc", "highlight": "#aaaaaa"},
                        "width": 1,
                        "dashes": True,
                        "is_hierarchical": False # Custom flag
                    })
            else:
                 # Log skipped edges due to missing nodes (optional, can be verbose)
                 # if source not in added_nodes: logger.debug(f"Skipping edge, source node missing: {source}")
                 # if target not in added_nodes: logger.debug(f"Skipping edge, target node missing: {target}")
                 pass # Silently skip if source/target node doesn't exist in nodes_dict
    elif graph_data:
        logger.warning("Graph data exists, but 'edges' key is missing or not a list. No 'other' edges will be processed.")


    logger.info(f"Prepared Vis.js data: {len(vis_nodes)} nodes, {len(hierarchical_edges_vis)} hierarchy edges, {len(other_edges_vis)} other edges.")
    return vis_nodes, hierarchical_edges_vis, other_edges_vis

# --- HTML Template ---
# (Keep your html_template exactly as it was)
html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>KG1 Visualization (Vis.js Interactive)</title>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style type="text/css">
        body {{ font-family: sans-serif; margin: 0; display: flex; height: 100vh; }}
        #networkContainer {{ flex-grow: 1; height: 100%; border-right: 1px solid lightgray; position: relative; }}
        #mynetwork {{ width: 100%; height: 100%; }}
        #detailsContainer {{ width: 300px; height: 100%; overflow-y: auto; padding: 15px; box-sizing: border-box; background-color: #f8f8f8; }}
        #detailsContainer h3 {{ margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
        #detailsContainer p {{ font-size: 0.9em; line-height: 1.4; }}
        .loading-overlay {{
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(255, 255, 255, 0.8); z-index: 10;
            display: flex; justify-content: center; align-items: center; font-size: 1.2em;
        }}
    </style>
</head>
<body>
    <div id="networkContainer">
        <div id="mynetwork"></div>
        <div id="loadingOverlay" class="loading-overlay">Loading & Initial Layout...</div>
    </div>
    <div id="detailsContainer">
        <h3>Node Details</h3>
        <div id="{details_div_id}">Select a node to see details.</div>
    </div>

    <script type="text/javascript">
        // --- Embedded Data (Generated by Python) ---
        const nodesData = {nodes_json};
        const hierarchicalEdgesData = {hierarchical_edges_json};
        const otherEdgesData = {other_edges_json}; // All non-hierarchical edges
        const detailsDivId = "{details_div_id}";
        // ------------------------------------------

        const nodes = new vis.DataSet(nodesData);
        const hierarchicalEdges = new vis.DataSet(hierarchicalEdgesData);
        // Create an empty DataSet for dynamic edges initially
        const dynamicOtherEdges = new vis.DataSet([]);

        const container = document.getElementById('mynetwork');
        const detailsDiv = document.getElementById(detailsDivId);
        const loadingOverlay = document.getElementById('loadingOverlay');

        // Combine static hierarchical edges and dynamic other edges into a single DataSet for the network
        // We start with only hierarchical edges visible. Other edges are added dynamically on selection.
        const allEdges = new vis.DataSet(hierarchicalEdges.get());


        const data = {{
            nodes: nodes,
            edges: allEdges // Use combined dataset (starts with hierarchical only)
        }};

        const options = {{
            layout: {{
                hierarchical: {{
                    enabled: true,
                    levelSeparation: 150,
                    nodeSpacing: 100,
                    treeSpacing: 200,
                    direction: 'UD', // Up-Down layout
                    sortMethod: 'directed' // Try 'hubsize' if UD doesn't look right
                }}
            }},
            physics: {{
                enabled: true, // Enable physics initially for hierarchical layout
                hierarchicalRepulsion: {{ // Physics specifically for hierarchical
                    centralGravity: 0.0,
                    springLength: 100,
                    springConstant: 0.01,
                    nodeDistance: 120,
                    damping: 0.09
                }},
                minVelocity: 0.75,
                solver: 'hierarchicalRepulsion' // Use the specific solver
            }},
            interaction: {{
                 hover: true, // Show tooltips on hover
                 tooltipDelay: 300
            }},
            nodes: {{
                borderWidth: 1,
                borderWidthSelected: 2
            }},
            edges: {{
                smooth: {{ // Smoother curves for hierarchical
                    type: "cubicBezier",
                    forceDirection: "vertical",
                    roundness: 0.4
                }}
            }}
        }};

        const network = new vis.Network(container, data, options);
        let currentlyShownOtherEdges = []; // Keep track of dynamically added edges

        // --- Event Listeners ---

        // Hide loading overlay and optionally disable physics after stabilization
        network.on("stabilizationIterationsDone", function () {{
            loadingOverlay.style.display = 'none'; // Hide loading overlay
            // Optional: Disable physics for smoother interaction after layout
            // network.setOptions({{ physics: false }});
            // console.log("Physics disabled after stabilization.");
        }});

        // Show details and related edges on node selection
        network.on("selectNode", function (params) {{
            if (params.nodes.length > 0) {{
                const selectedNodeId = params.nodes[0];
                const nodeData = nodes.get(selectedNodeId); // Get full node data

                // Display description
                if (nodeData && detailsDiv) {{
                    detailsDiv.innerHTML = `
                        <h3>${{nodeData.label}} Details</h3>
                        <p><b>Type:</b> ${{nodeData.node_type || 'unknown'}}</p>
                        <p><b>Description:</b><br>${{nodeData.description || 'N/A'}}</p>
                    `;
                }} else {{
                     detailsDiv.innerHTML = "<h3>Node Details</h3><p>Details not found.</p>";
                }}

                // Clear previously shown 'other' edges from the dynamic DataSet
                if (currentlyShownOtherEdges.length > 0) {{
                    // console.log("Removing other edges:", currentlyShownOtherEdges);
                    dynamicOtherEdges.remove(currentlyShownOtherEdges); // Remove from dynamic set
                    allEdges.remove(currentlyShownOtherEdges); // Also remove from the main network edges set
                    currentlyShownOtherEdges = [];
                }}

                // Find relevant 'other' edges from the pre-processed list
                const relevantEdges = otherEdgesData.filter(edge => edge.from === selectedNodeId || edge.to === selectedNodeId);
                if (relevantEdges.length > 0) {{
                    // console.log("Adding other edges:", relevantEdges);
                    dynamicOtherEdges.add(relevantEdges); // Add to dynamic set (for tracking)
                    allEdges.add(relevantEdges); // Add to the main network edges set to make them visible
                    currentlyShownOtherEdges = relevantEdges.map(edge => edge.id); // Store IDs to remove later
                    detailsDiv.innerHTML += `<p><b>Other Relationships Shown (${{relevantEdges.length}})</b></p>`;
                }}

            }}
        }});

        // Clear details and temporary edges when deselecting
         network.on("deselectNode", function (params) {{
             detailsDiv.innerHTML = "<h3>Node Details</h3><p>Select a node to see details.</p>";
             // Clear previously shown 'other' edges
             if (currentlyShownOtherEdges.length > 0) {{
                //  console.log("Removing other edges on deselect:", currentlyShownOtherEdges);
                 dynamicOtherEdges.remove(currentlyShownOtherEdges); // Remove from dynamic set
                 allEdges.remove(currentlyShownOtherEdges); // Also remove from the main network edges set
                 currentlyShownOtherEdges = [];
             }}
         }});

         // Optional: Also clear on background click
         network.on("click", function (params) {{
             if (params.nodes.length === 0 && params.edges.length === 0) {{ // Clicked on background
                 detailsDiv.innerHTML = "<h3>Node Details</h3><p>Select a node to see details.</p>";
                 if (currentlyShownOtherEdges.length > 0) {{
                    //  console.log("Removing other edges on background click:", currentlyShownOtherEdges);
                     dynamicOtherEdges.remove(currentlyShownOtherEdges); // Remove from dynamic set
                     allEdges.remove(currentlyShownOtherEdges); // Also remove from the main network edges set
                     currentlyShownOtherEdges = [];
                 }}
             }}
         }});

    </script>
</body>
</html>
"""

# --- Main execution for Strategy 3 ---
logger.info("Starting Strategy 3: Generating Vis.js Interactive HTML...")

# Now this check works because graph_data is defined (or None)
if graph_data and nodes_dict: # Check both graph_data and that nodes_dict was successfully created
    vis_nodes, hierarchical_edges, other_edges = prepare_visjs_data(graph_data, nodes_dict)

    # Check if preparation yielded any nodes before proceeding
    if not vis_nodes:
        logger.error("Vis.js data preparation resulted in zero nodes. Aborting HTML generation.")
    else:
        # Safely embed data into the HTML template
        # json.dumps handles escaping characters correctly for JavaScript
        html_content = html_template.format(
            nodes_json=json.dumps(vis_nodes, indent=None), # No indent for inline JS
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
     logger.error("Graph data loaded, but failed to create nodes_dict (check warnings above). Cannot generate Vis.js graph.")
else:
    # Error message already logged by load_json_data if graph_data is None
    logger.error("No graph data loaded or processed, cannot generate Vis.js graph.")

print("-" * 30)
logger.info("Strategy 3 execution finished.") # Changed message slightly
