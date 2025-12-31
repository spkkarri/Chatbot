#!/bin/bash

# --- Configuration ---
START_DIR="."                 # Directory to start searching from (default: current directory)
MAX_DEPTH=6                   # Max depth for find (0=start_dir, 1=immediate children, ..., 6 includes files 5 levels deep)
OUTPUT_FILE="code.txt" # Name of the final Markdown file
declare -a IGNORE_DIRS=("node_modules" "assets" "backup_assets" ".git" ".vscode" "dist" "build") # Add folder names to ignore
declare -a INCLUDE_EXTENSIONS=("py" "js" "jsx" "py" "ts" "tsx" "css" "scss" "html" "txt" "env"  ) # Add file extensions to include

# --- Script Logic ---

# Check if start directory exists
if [ ! -d "$START_DIR" ]; then
  echo "Error: Start directory '$START_DIR' not found." >&2
  exit 1
fi

# Prepare the find command arguments for ignored directories
ignore_opts=()
if [ ${#IGNORE_DIRS[@]} -gt 0 ]; then
  ignore_opts+=("(")
  first_ignore=true
  for dir in "${IGNORE_DIRS[@]}"; do
    if [ "$first_ignore" = false ]; then
      ignore_opts+=("-o")
    fi
    ignore_opts+=("-name" "$dir" "-type" "d")
    first_ignore=false
  done
  ignore_opts+=(")" "-prune") # The crucial prune option
else
  # Add a condition that is never true if no ignores are specified,
  # effectively disabling the prune branch.
  ignore_opts+=("(" "-false" ")" "-prune")
fi

# Prepare the find command arguments for included file extensions
include_opts=()
if [ ${#INCLUDE_EXTENSIONS[@]} -gt 0 ]; then
  include_opts+=("(")
  first_include=true
  for ext in "${INCLUDE_EXTENSIONS[@]}"; do
    if [ "$first_include" = false ]; then
      include_opts+=("-o")
    fi
    include_opts+=("-name" "*.$ext")
    first_include=false
  done
  include_opts+=(")")
fi

# Clear or create the output file
> "$OUTPUT_FILE"
echo "Created/Cleared output file: $OUTPUT_FILE"

echo "Starting file search in '$START_DIR' up to depth ${MAX_DEPTH}..."

# Use process substitution and a while loop for robust filename handling
# find . -maxdepth 6 \( -name node_modules -o -name assets \) -prune -o \( -type f \( -name '*.py' -o -name '*.js' \) \) -print0
find "$START_DIR" -maxdepth "$MAX_DEPTH" \
  "${ignore_opts[@]}" \
  -o \
  \( -type f "${include_opts[@]}" \) \
  -print0 | while IFS= read -r -d $'\0' file; do
    # Remove leading ./ if present for cleaner paths
    clean_file="${file#./}"

    echo "Processing: $clean_file"

    # Get file extension for language hinting
    extension="${clean_file##*.}"
    lang=""
    # Convert extension to lowercase for case-insensitive matching
    extension_lower=$(tr '[:upper:]' '[:lower:]' <<< "$extension")

    # Determine Markdown language hint
    case "$extension_lower" in
      py) lang="python" ;;
      js|jsx) lang="javascript" ;;
      ts|tsx) lang="typescript" ;;
      css) lang="css" ;;
      scss) lang="scss" ;;
      html) lang="html" ;;
      md) lang="markdown" ;;
      sh) lang="bash" ;;
      json) lang="json" ;;
      yaml|yml) lang="yaml" ;;
      txt) lang="" ;; # No language hint for plain text
      *) lang="" ;;   # Default: no specific language hint
    esac

    # Append to the Markdown file
    {
      # Print the file path - using backticks for emphasis
      printf '`%s`\n\n' "$clean_file"
      # Print the opening code fence with language hint
      printf '```%s\n' "$lang"
      # Print the file content
      cat "$file" # Use original $file here which is guaranteed to exist
      # Print the closing code fence and add extra newlines for separation
      printf '\n```\n\n'
    } >> "$OUTPUT_FILE"

done

echo "Markdown generation complete: $OUTPUT_FILE"

tree -a -I 'node_modules|.git|backup_assets|assets' $START_DIR --> o.txt

exit 0
