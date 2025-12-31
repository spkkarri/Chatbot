# server/rag_service/visualize_parser.py
import argparse
import os
import logging
import sys

# Ensure the parent directory is in the system path to allow for package imports
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, os.path.dirname(SERVER_DIR))

# Now we can import from the rag_service package
from rag_service import ai_core, config

# Set up logging to see the detailed output from the parser
config.setup_logging()
logger = logging.getLogger(__name__)

def main():
    """
    A command-line tool to run the document parsing pipeline on a single file
    and save the final Markdown output for visual inspection.
    """
    parser = argparse.ArgumentParser(
        description="Debug and visualize the output of the document parsing pipeline."
    )
    parser.add_argument(
        "--file",
        type=str,
        required=True,
        help="The absolute or relative path to the document file (e.g., a PDF) to be processed.",
    )
    args = parser.parse_args()

    file_path = args.file
    if not os.path.exists(file_path):
        logger.critical(f"File not found: {file_path}")
        sys.exit(1)

    original_name = os.path.basename(file_path)
    logger.info(f"--- Starting Visualization Run for: {original_name} ---")

    try:
        # We call the main orchestrator function from ai_core.py.
        # This will run the full hybrid pipeline (triage, parallel processing, etc.).
        # We are interested in the second return value: the final, aggregated Markdown text.
        _qdrant_chunks, markdown_output, _kg_chunks = ai_core.process_document_for_qdrant(
            file_path=file_path,
            original_name=original_name,
            user_id="debug_user" # A dummy user_id for processing
        )

        if not markdown_output:
            logger.warning("The parser returned no text content. The document might be empty or unreadable.")
            sys.exit(0)

        # Define a clear output filename
        output_dir = os.path.join(SERVER_DIR, "parsed_outputs")
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"parsed_output_{os.path.splitext(original_name)[0]}.md"
        output_path = os.path.join(output_dir, output_filename)

        # Save the result to a Markdown file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown_output)

        logger.info("=" * 50)
        logger.info("✅ SUCCESS: Document parsing complete.")
        logger.info(f"✅ The final Markdown output has been saved to:")
        logger.info(f"   ---> {output_path}")
        logger.info("=" * 50)

    except Exception as e:
        logger.critical(f"An unexpected error occurred during the parsing process: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
