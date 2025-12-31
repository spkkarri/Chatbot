#!/bin/bash

# ==============================================================================
# iMentor Project Installer for Debian/Ubuntu (venv Edition)
# ==============================================================================
# This script will:
#   1. Check for and install all required system-level dependencies.
#   2. Create a Python 3.10 virtual environment (venv) for the RAG service.
#   3. Configure the project by creating .env files with placeholders for secrets.
#   4. Install all Node.js and Python dependencies into their respective environments.
#   5. Run the initial database seeder script.
# ==============================================================================

# --- Configuration & Helpers ---
set -e # Exit immediately if a command fails

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function to check if a command exists
function check_command() {
    command -v "$1" &> /dev/null
}

# --- Main Functions ---

function install_system_dependencies() {
    echo -e "${YELLOW}[INFO] Updating package lists...${NC}"
    apt-get update

    echo -e "${YELLOW}[INFO] Installing base dependencies (curl, git, tesseract, ffmpeg, software-properties)...${NC}"
    apt-get install -y curl git tesseract-ocr ffmpeg gnupg software-properties-common

    # --- Install Docker ---
    if ! check_command docker; then
        echo -e "${YELLOW}[INFO] Docker not found. Installing...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl start docker
        systemctl enable docker
        rm get-docker.sh
    else
        echo -e "${GREEN}[SUCCESS] Docker is already installed.${NC}"
    fi

    # --- Install Node.js v18 ---
    if ! check_command node || ! node -v | grep -q "v18"; then
        echo -e "${YELLOW}[INFO] Node.js v18 not found. Installing...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        echo -e "${GREEN}[SUCCESS] Node.js v18 is already installed.${NC}"
    fi

    # --- Install Python 3.10 & venv ---
    if ! check_command python3.10; then
        echo -e "${YELLOW}[INFO] Python 3.10 not found. Adding PPA and installing...${NC}"
        add-apt-repository ppa:deadsnakes/ppa -y
        apt-get update
        apt-get install -y python3.10 python3.10-venv python3-pip
    else
        echo -e "${GREEN}[SUCCESS] Python 3.10 is already installed.${NC}"
        # Ensure venv is also installed
        apt-get install -y python3.10-venv python3-pip
    fi

    # --- Install MongoDB ---
    if ! check_command mongod; then
        echo -e "${YELLOW}[INFO] MongoDB not found. Installing...${NC}"
        curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        apt-get update
        apt-get install -y mongodb-org
        systemctl start mongod
        systemctl enable mongod
    else
        echo -e "${GREEN}[SUCCESS] MongoDB is already installed.${NC}"
    fi
}

function configure_project_env_files() {
    echo -e "\n${YELLOW}[INFO] Creating .env files with placeholders...${NC}"

    # Create server/.env
    cat > server/.env << EOL
# --- Server Port & Database ---
PORT=2000
MONGO_URI="mongodb://localhost:27017/chatbot_gemini"

# --- Security ---
JWT_SECRET="GENERATE_A_STRONG_RANDOM_SECRET_KEY_HERE"
ENCRYPTION_SECRET="GENERATE_A_64_CHAR_HEX_SECRET_HERE_ (e.g., using 'openssl rand -hex 32')"

# --- Language Model (LLM) APIs ---
GEMINI_API_KEY="ADD_YOUR_GOOGLE_GEMINI_API_KEY_HERE"
OLLAMA_API_BASE_URL="http://localhost:11434"
OLLAMA_DEFAULT_MODEL="qwen2.5:14b-instruct"

# --- Internal & External Service URLs ---
PYTHON_RAG_SERVICE_URL="http://127.0.0.1:2001"
REDIS_URL="redis://localhost:2005"
ELASTICSEARCH_URL=http://localhost:2006
SENTRY_DSN="ADD_YOUR_SENTRY_DSN_HERE_OR_LEAVE_BLANK"

# --- Admin credentials for Basic Auth on admin routes ---
FIXED_ADMIN_USERNAME=admin@admin.com
FIXED_ADMIN_PASSWORD=admin123

# --- AWS S3 Credentials for Dataset Management ---
S3_BUCKET_NAME="your-s3-bucket-name-here"
AWS_ACCESS_KEY_ID="ADD_YOUR_AWS_ACCESS_KEY_ID_HERE"
AWS_SECRET_ACCESS_KEY="ADD_YOUR_AWS_SECRET_ACCESS_KEY_HERE"
AWS_REGION="us-east-1"

# ---------------- Node Mailer Service ----------------
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EOL
    echo -e "${GREEN}[SUCCESS] Created server/.env${NC}"

    # Create frontend/.env
    cat > frontend/.env << EOL
VITE_API_BASE_URL=http://localhost:2000/api
EOL
    echo -e "${GREEN}[SUCCESS] Created frontend/.env${NC}"

    echo -e "\n${RED}================== ACTION REQUIRED ==================${NC}"
    echo -e "${YELLOW}Your .env files have been created."
    echo -e "${YELLOW}You MUST edit ${RED}server/.env${YELLOW} to add your secret keys for Gemini, AWS, etc."
    echo -e "${YELLOW}The application will NOT run correctly without them!${NC}"
    echo -e "${RED}=====================================================${NC}\n"
}

function install_project_dependencies() {
    echo -e "\n${YELLOW}[INFO] Installing Node.js dependencies for backend...${NC}"
    (cd server && npm install)
    
    echo -e "\n${YELLOW}[INFO] Installing Node.js dependencies for frontend...${NC}"
    (cd frontend && npm install)
    
    echo -e "\n${YELLOW}[INFO] Creating Python virtual environment (venv) with Python 3.10...${NC}"
    if [ -d "server/rag_service/venv" ]; then
        echo -e "${YELLOW}[INFO] 'venv' directory already exists. Skipping creation.${NC}"
    else
        python3.10 -m venv server/rag_service/venv
    fi

    echo -e "\n${YELLOW}[INFO] Installing Python dependencies into 'venv'... (This may take a very long time)${NC}"
    # Activate venv and install packages in one subshell
    (
        source server/rag_service/venv/bin/activate
        pip install --upgrade pip
        pip install -r server/rag_service/requirements.txt
        echo -e "\n${YELLOW}[INFO] Downloading SpaCy model into 'venv'...${NC}"
        python -m spacy download en_core_web_sm
    )
}

function seed_database() {
    echo -e "\n${YELLOW}[INFO] Seeding database with initial LLM configurations...${NC}"
    (cd server && node scripts/seedLLMs.js)
}

# --- Main Script Logic ---
echo -e "${GREEN}========================================="
echo "  iMentor Project Installer (venv Edition) "
echo "=========================================${NC}"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[ERROR] This script requires superuser privileges to install system dependencies." >&2
  echo -e "Please run with 'sudo'." >&2
  exit 1
fi

install_system_dependencies
configure_project_env_files
install_project_dependencies
seed_database

# --- Completion Message ---
echo
echo -e "${GREEN}========================================="
echo "         Installation Complete!          "
echo "=========================================${NC}"
echo
echo -e "${RED}IMPORTANT:${NC} Remember to edit ${YELLOW}server/.env${NC} with your secret keys!"
echo
echo -e "${YELLOW}To run the application, open FOUR separate terminal windows:${NC}"
echo
echo "1. ${GREEN}Terminal 1 (Docker Services):${NC}"
echo "   ${RED}sudo${NC} docker compose up -d"
echo
echo "2. ${GREEN}Terminal 2 (Python RAG Service):${NC}"
echo "   cd server/rag_service"
echo "   ${GREEN}source venv/bin/activate${NC}"
echo "   python app.py"
echo
echo "3. ${GREEN}Terminal 3 (Node.js Backend):${NC}"
echo "   cd server"
echo "   npm start"
echo
echo "4. ${GREEN}Terminal 4 (Frontend):${NC}"
echo "   cd frontend"
echo "   npm run dev"
echo
echo "Then, open your browser to the URL provided by the frontend terminal (usually ${YELLOW}http://localhost:5173${NC})"
echo
