# === STRATEGY 2: Modified Pyvis for Hierarchy ===
import json
import os
import logging
import random
from pyvis.network import Network # Ensure pyvis is installed

# (Include the common starting point code from above: imports, logging, load_json_data, graph_data, nodes_dict)

OUTPUT_HTML_PYVIS = "kg1_pyvis_hierarchical.html"

# --- Main execution for Strategy 2 ---
logging.info("Starting Strategy 2: Generating Hierarchical Pyvis HTML...")
if graph_data:
    net = Network(height="95vh", width="100%", notebook=True, heading="KG1 Hierarchical View (Pyvis)")

    added_nodes = set()
    node_type_colors = {
        "major": "#FF6347", "subnode": "#4682B4", "unknown": "#D3D3D3"
    }

    # 1. Add Nodes
    logging.info("Adding nodes...")
    for node_id, node_data in nodes_dict.items():
        node_desc = node_data.get('description', 'N/A')
        node_type = node_data.get('type', 'unknown')
        node_title = f"<b>{node_id}</b> ({node_type})<hr>{node_desc}"
        node_color = node_type_colors.get(node_type, node_type_colors["unknown"])
        node_shape = "star" if node_type == "major" else "dot"
        node_size = 25 if node_type == "major" else 15

        net.add_node(
            n_id=node_id, label=node_id, title=node_title, color=node_color,
            shape=node_shape, size=node_size
        )
        added_nodes.add(node_id)
    logging.info(f"Added {len(added_nodes)} nodes.")

    # 2. Add Edges (Distinguish Hierarchical vs Other)
    logging.info("Adding edges...")
    hierarchical_edge_tuples = set()
    added_edge_count = 0

    # Add hierarchical edges first (solid lines)
    for node_id, node_data in nodes_dict.items():
        parent_id = node_data.get('parent')
        if parent_id and parent_id in added_nodes: # Ensure parent exists
            edge_tuple = (parent_id, node_id)
            if edge_tuple not in hierarchical_edge_tuples:
                 net.add_edge(
                     source=parent_id, to=node_id,
                     title=f"{node_id} is subtopic of {parent_id}", # Hover text
                     arrows="to",
                     color="#000000", # Black solid lines for hierarchy
                     width=2
                 )
                 hierarchical_edge_tuples.add(edge_tuple)
                 added_edge_count += 1

    # Add other relationships (dashed lines)
    for edge_data in graph_data.get('edges', []):
        source = edge_data.get('from')
        target = edge_data.get('to')
        relationship = edge_data.get('relationship', 'related_to')

        if source in added_nodes and target in added_nodes:
            # Only add if it's NOT the primary parent-child link we already added
            if (source, target) not in hierarchical_edge_tuples:
                net.add_edge(
                    source=source, to=target,
                    title=f"{source} -> {target} ({relationship})", # Hover text
                    arrows="to",
                    dashes=True, # Make non-hierarchical dashed
                    color="#AAAAAA", # Lighter color
                    width=1
                )
                added_edge_count += 1
        else:
            logging.warning(f"Skipping edge with missing node: {source} -> {target}")

    logging.info(f"Added {added_edge_count} edges total.")

    # 3. Configure Layout
    logging.info("Applying hierarchical layout...")
    # You might need to experiment with these options
    net.hrepulsion(
        node_distance=150,   # Distance between nodes
        central_gravity=0.5, # How strongly nodes are pulled to center
        spring_length=120,   # Ideal edge length
        spring_strength=0.05,
        damping=0.09
    )
    # Alternative: Try Vis.js hierarchical options directly
    # net.set_options("""
    # var options = {
    #   "layout": {
    #     "hierarchical": {
    #       "enabled": true,
    #       "levelSeparation": 150,
    #       "nodeSpacing": 120,
    #       "treeSpacing": 200,
    #       "direction": "UD",        // UD, DU, LR, RL
    #       "sortMethod": "hubsize" // hubsize, directed
    #     }
    #   },
    #   "physics": {
    #      "enabled": false // Disable physics if using hierarchical layout
    #   }
    # }
    # """)

    # Add physics toggle button for user control
    net.show_buttons(filter_=['physics'])

    # 4. Save
    try:
        net.save_graph(OUTPUT_HTML_PYVIS)
        logging.info(f"Pyvis hierarchical graph saved to {OUTPUT_HTML_PYVIS}")
        print(f"\n>>> Open '{OUTPUT_HTML_PYVIS}' in your browser.")
    except Exception as e:
        logging.error(f"Failed to save Pyvis graph: {e}")

else:
    logging.error("No graph data loaded, cannot generate Pyvis graph.")

print("-" * 30)
