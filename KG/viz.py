import pipmaster as pm

if not pm.is_installed("pyvis"):
    pm.install("pyvis")

import json
import random
from pyvis.network import Network
import os
import sys # Needed if using installation check

# --- Configuration ---
json_file_path = "kg3.json"  # Path to your JSON file
output_html_file = "kg3.html" # Name for the output HTML

# --- 1. Check if JSON file exists ---
if not os.path.exists(json_file_path):
    print(f"Error: JSON file not found at '{json_file_path}'")
    sys.exit(1) # Exit if the file doesn't exist

# --- 2. Load JSON data ---
print(f"Loading data from {json_file_path}...")
try:
    with open(json_file_path, 'r', encoding='utf-8') as f: # Added encoding for broader compatibility
        data = json.load(f)
except json.JSONDecodeError as e:
    print(f"Error decoding JSON file: {e}")
    sys.exit(1)
except Exception as e:
    print(f"An error occurred while reading the file: {e}")
    sys.exit(1)

# --- 3. Validate JSON structure (Basic Check) ---
if "nodes" not in data or not isinstance(data["nodes"], list):
    print("Error: JSON file must contain a 'nodes' key with a list value.")
    sys.exit(1)
# Edges might be optional depending on the graph, but check if present
if "edges" in data and not isinstance(data["edges"], list):
     print("Warning: JSON file has an 'edges' key, but it's not a list.")
     # Decide if this is an error or just a warning based on requirements


# --- 4. Create a Pyvis network ---
# Increased height/width for potentially large graphs, added heading
net = Network(height="95vh", width="100%", notebook=True, heading="Machine Learning Knowledge Graph")

# --- 5. Add Nodes to the Pyvis Network ---
print("Processing nodes...")
node_ids = set() # To check if nodes referenced by edges actually exist
added_nodes_count = 0
for node_data in data.get("nodes", []):
    node_id = node_data.get("id")
    node_desc = node_data.get("description", "No description available.") # Default text if missing
    node_type = node_data.get("type", "unknown") # Get type for potential customization

    if not node_id:
        print(f"Warning: Skipping node with missing ID: {node_data}")
        continue

    if node_id in node_ids:
        print(f"Warning: Duplicate node ID found and skipped: {node_id}")
        continue

    node_ids.add(node_id)

    # Set node properties
    node_label = node_id # Text displayed *on* the node
    node_title = node_desc # Text displayed on *hover* (tooltip)
    node_color = "#{:06x}".format(random.randint(0, 0xFFFFFF)) # Random color

    # Optional: Customize appearance based on node type
    node_shape = "dot"
    node_size = 15
    if node_type == "major":
        node_shape = "star"
        node_size = 25
    elif node_type == "subnode":
        node_size = 10
        # You could add more conditions for other types if needed

    net.add_node(
        n_id=node_id,
        label=node_label,
        title=node_title,  # This sets the hover text
        color=node_color,
        shape=node_shape,
        size=node_size
        # value=node_size # Optional: influence physics based on size
    )
    added_nodes_count += 1

print(f"Added {added_nodes_count} nodes.")

# --- 6. Add Edges to the Pyvis Network ---
print("Processing edges...")
added_edges_count = 0
skipped_edges_count = 0
if "edges" in data:
    for edge_data in data.get("edges", []):
        source_id = edge_data.get("from")
        target_id = edge_data.get("to")
        relationship = edge_data.get("relationship", "") # Get relationship for edge title

        if not source_id or not target_id:
            print(f"Warning: Skipping edge with missing source/target ID: {edge_data}")
            skipped_edges_count += 1
            continue

        # IMPORTANT: Check if both source and target nodes were actually added
        if source_id not in node_ids:
            print(f"Warning: Skipping edge from '{source_id}' to '{target_id}' because source node '{source_id}' was not found or was skipped.")
            skipped_edges_count += 1
            continue
        if target_id not in node_ids:
             print(f"Warning: Skipping edge from '{source_id}' to '{target_id}' because target node '{target_id}' was not found or was skipped.")
             skipped_edges_count += 1
             continue


        # Add edge with relationship as hover title
        net.add_edge(
            source=source_id,
            to=target_id,
            title=relationship, # Hover text for the edge
            arrows="to" # Make edges directed
            # You can add more edge properties like 'width', 'color', 'dashes' etc.
        )
        added_edges_count += 1

    print(f"Added {added_edges_count} edges.")
    if skipped_edges_count > 0:
        print(f"Skipped {skipped_edges_count} edges due to missing nodes or IDs.")
else:
    print("No 'edges' key found in the JSON file.")


# --- 7. Configure Physics/Layout (Optional but often helpful) ---
# net.show_buttons(filter_=['physics']) # Uncomment to add physics control buttons
# Example physics settings (experiment with these):
# net.barnes_hut(gravity=-8000, central_gravity=0.3, spring_length=200, spring_strength=0.01, damping=0.09, overlap=0.1)
# net.force_atlas_2based(gravity=-50, central_gravity=0.01, spring_length=100, spring_strength=0.08, damping=0.4, overlap=0)
net.repulsion(node_distance=200, central_gravity=0.1, spring_length=150, spring_strength=0.05, damping=0.09)


# --- 8. Save and Display the Network ---
try:
    net.save_graph(output_html_file)
    print(f"\nSuccessfully generated graph visualization!")
    print(f"Output saved to: {os.path.abspath(output_html_file)}")
    print("Open this HTML file in your web browser to view the interactive graph.")
    # net.show(output_html_file) # .show() also saves the file and tries to open it
except Exception as e:
    print(f"An error occurred while saving the graph: {e}")
