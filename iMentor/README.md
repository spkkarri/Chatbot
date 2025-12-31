# AI Tutor: Intelligent Learning Assistant

This project is a comprehensive AI-powered tutoring application designed to assist users through interactive chat, document analysis, and knowledge exploration. It integrates multiple Large Language Models (LLMs), Retrieval Augmented Generation (RAG) for contextual understanding from user-uploaded documents, and knowledge graph capabilities for critical thinking. The system also includes an admin interface for managing shared knowledge resources.

---

## Core Features

### Intelligent & Interactive Chat

-   **Multi-LLM Orchestration**: The system uses an intelligent **LLM Router** (`llmRouterService.js`) that analyzes each user query against heuristic keywords (e.g., 'code', 'translate') and the current context. It dynamically selects the best-suited model from a database of configured LLMs (e.g., a coding model for a programming question, a multilingual model for translation) to ensure the highest quality response. Users can also manually override their default provider.
-   **Explainable Thinking Process (Tree of Thoughts)**: When "Critical Thinking Mode" is enabled, the application activates a **Tree of Thoughts (ToT) orchestrator** (`totOrchestrator.js`). This agent breaks complex queries into a multi-step plan, evaluates the best plan, and executes each step. Its reasoning is streamed to the user in real-time via the **Thinking Dropdown** (`ThinkingDropdown.jsx`), making the AI's decision-making process fully transparent.
-   **Custom AI Persona**: Users can tailor the AI's behavior by selecting from pre-configured system prompts (e.g., "Friendly Tutor," "Concept Explorer") or writing their own custom instructions in the **Left Panel** (`LeftPanel.jsx`). This `systemPrompt` is passed to the LLM with every request.
-   **Speech-to-Text (STT) & Text-to-Speech (TTS)**: The UI supports voice interaction. The `useWebSpeech` hook enables voice input via the browser's native Speech Recognition API, and the `useTextToSpeech` hook reads the AI's responses aloud (`ChatInput.jsx`, `MessageBubble.jsx`).
-   **Rich Content Rendering**: The AI is prompted to respond using Markdown, tables, and **KaTeX** for mathematical formulas. The frontend (`MessageBubble.jsx`, `markdownUtils.jsx`) correctly renders this rich content, including syntax-highlighted code snippets via **Prism.js**.

### Advanced Knowledge Management & RAG

-   **Multi-Modal Knowledge Ingestion**: The platform can ingest and process a wide array of sources (`SourceIngestion.jsx`). The backend `knowledge_engine.py` and `media_processor.py` can handle:
    -   **Documents**: PDF, DOCX, TXT, Markdown.
    -   **Media Files**: MP3, MP4 (audio is extracted and transcribed).
    -   **Web Content**: Standard webpage URLs and YouTube video links (transcripts are fetched).
-   **Comprehensive RAG Pipeline**: When a source is ingested, it undergoes a full processing pipeline in `ai_core.py`:
    1.  **Extraction**: Text, tables, and images are extracted using libraries like `pdfplumber`, `python-docx`, and `fitz`.
    2.  **OCR**: **Tesseract** extracts text from images or scanned PDFs.
    3.  **Transcription**: **OpenAI Whisper** transcribes audio from media files.
    4.  **Cleaning**: Text is cleaned and lemmatized using **spaCy**.
    5.  **Layout Reconstruction**: Tables are converted to Markdown and integrated with the text.
    6.  **Chunking & Embedding**: The final text is segmented and converted into vector embeddings using **Sentence Transformers**.
    7.  **Storage**: Embeddings are stored in **Qdrant**, and metadata is prepared for the Knowledge Graph.
-   **Admin-Curated Subjects**: Professors can upload foundational documents via the **Admin Dashboard**. These appear as selectable "Subjects" (`SubjectList.jsx`) for all students, allowing users to focus their RAG queries on a specific, curated curriculum.

### Personalized Learning & Academic Tools

-   **Personalized Study Plans**: From the `StudyPlanPage.jsx`, users can state a learning goal. The `curriculumOrchestrator.js` first uses an LLM to determine if the goal is specific enough. If not, it generates clarifying questions. Once the goal is refined, it creates a multi-module, step-by-step curriculum tailored to the user's profile and identified weaknesses, which is then saved to the `LearningPath` database model.
-   **Knowledge Gap Identification & Recommendations**: After a chat session concludes, the `sessionAnalysisService.js` uses an LLM to analyze the transcript. It identifies topics where the user showed confusion (**Knowledge Gaps**) and saves them to their profile. It then generates **"Next Step" recommendations** based on the key topics discussed, which are cached in **Redis** and presented at the start of the next session.
-   **Real-time Dynamic Concept Mapping**: During a live chat, the AI extracts key concepts and relationships in the background (`kgExtractionService.js`). Users can open the **Live Concept Map** (`RealtimeKgPanel.jsx`) to see an interactive **ReactFlow** visualization of how ideas in the current conversation are connected, fetched directly from the **Neo4j** graph database.
-   **Secure Code Executor & AI Assistant**: A sandboxed environment (`CodeExecutorPage.jsx`) where users can write and run code in Python, Java, C, and C++. The backend (`app.py`) uses temporary directories and the `subprocess` module for secure execution. An integrated **AI Assistant** (`AIAssistantBot.jsx`) can:
    -   **Analyze Code**: Provide a detailed review of functionality, bugs, and improvements.
    -   **Generate Test Cases**: Create a suite of standard, edge, and error cases.
    -   **Explain Errors**: Give a beginner-friendly explanation for compilation or runtime errors.
-   **Academic Integrity Suite**: A dedicated page (`AcademicIntegrityPage.jsx`) with tools to promote ethical writing. The `integrity_services.py` backend provides:
    -   **Plagiarism Detection**: Integrates with the **Turnitin API** for similarity reports.
    -   **Bias & Inclusivity Check**: Uses a hybrid approach of wordlists (`bias_wordlists.py`) and an LLM to flag potentially biased language and suggest alternatives.
    -   **Readability Analysis**: Calculates Flesch-Kincaid, Gunning Fog, and other scores using `textstat`.
-   **Generative Content Tools**:
    -   **AI Quiz Generator**: Users can upload a document, and the backend (`quiz_utils.py`, `app.py`) will use an LLM to generate a multiple-choice quiz based on its content.
    -   **Multi-Voice Podcast Generator**: Transforms any document into a high-quality, three-speaker conversational podcast. `podcast_generator.py` uses an LLM to write a script, then uses **Coqui TTS** (`tts_service.py`) to synthesize distinct voices by pitch-shifting a base voice model.
    -   **DOCX & PPTX Generation**: From any analysis modal, users can generate a report. The `document_generator.py` backend uses an LLM to expand the content and then uses the `python-docx` and `python-pptx` libraries to create and serve the downloadable files.

### Administrator & Platform Management

-   **Full Analytics Dashboard**: The `/admin/analytics` route (`AnalyticsDashboardPage.jsx`) provides a comprehensive overview of platform health. Backend routes in `analytics.js` query **MongoDB** for user counts and **Elasticsearch** for event logs to populate charts showing user growth, feature adoption, and content engagement.
-   **Secure Dataset Management**: The admin dashboard features a `DatasetManager.jsx` for managing fine-tuning datasets. It interfaces with `s3Service.js` to use **pre-signed URLs**, allowing direct, secure uploads from the admin's browser to an **AWS S3** bucket without routing large files through the application server.
-   **Feedback Loop for Model Fine-Tuning**:
    1.  **Feedback Collection**: Users can give thumbs up/down feedback on AI responses (`MessageBubble.jsx`). This is stored in the `LLMPerformanceLog` collection (`feedback.js`).
    2.  **Orchestration**: An admin can trigger a fine-tuning job from the dashboard (`ModelFeedbackStats.jsx`).
    3.  **Execution**: The Node.js backend (`finetuning.js`) collects all positive feedback data, saves it to a shared volume, and calls the Python service. The `fine_tuner.py` script then uses **Unsloth** and Hugging Face's `SFTTrainer` to fine-tune a base model (e.g., Llama 3) and registers the new, improved model with **Ollama**.
-   **Secure Authentication & API Key Management**: The platform uses JWTs for session management with hashed passwords stored using `bcryptjs`. The admin dashboard (`ApiKeyRequestManager.jsx`) allows professors to review and approve/reject student requests for a system-provided Gemini API key. Approved keys are encrypted (`crypto.js`) and stored in the user's profile.

### Full-Stack Observability

-   **Centralized Logging**: The Node.js (`logger.js`) and Python (`config.py`) backends are configured to output structured **JSON logs**. A **Filebeat** container (`filebeat.yml`) is configured to ship these logs to an **Elasticsearch** instance.
-   **Log Visualization & Search**: A **Kibana** service is deployed, providing a powerful UI to search, filter, and create visualizations from the aggregated application logs, enabling deep debugging and user activity tracking.
-   **Performance Monitoring**: The Node.js backend exposes a `/metrics` endpoint using **prom-client**. A **Prometheus** container (`prometheus.yml`) is configured to scrape this endpoint, collecting real-time application metrics like HTTP request latency and error rates.
-   **Dashboards & Alerting**: A **Grafana** instance is deployed with a pre-configured data source for Prometheus and a sample dashboard (`dashboard.json`), allowing for easy visualization of application health and performance.
-   **Real-time Error Tracking**: Both the Node.js (`instrument.js`) and Python (`app.py`) services are integrated with **Sentry** for real-time, cross-platform error aggregation, reporting, and alerting.

---

## Getting Started

### Prerequisites

You will need the following software installed on your system to run the application.

-   **Node.js**: Version 18.x
-   **npm**: Comes bundled with Node.js
-   **Python**: Version 3.10–3.11 (3.10 is recommended)
-   **pip**: Comes bundled with Python
-   **MongoDB**: For database storage
-   **Docker & Docker Compose**: To run containerized services (Qdrant, Neo4j, ELK Stack, etc.)
-   **Tesseract OCR**: For processing image-based documents
-   **FFmpeg**: For audio and podcast generation

---

## Installation & Deployment

### Linux Setup (Debian/Ubuntu)

Follow the exact process to deploy this application in the Local Area Network

### Steps

1. Clone the Repository

```bash
git clone -b Team-2 https://github.com/tej-a192/chatbot-Team-2.git
```

2. Move to chatbot-Team-2 folder

```bash
cd chatbot-Team-2
```

3. Run install.sh script file

```bash
bash install.sh
```

4. Open project folder in the file manager and delete the node_modules and package-lock.json in **frontend** folder
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

5. Open Project in Vs code and open the .env file present in the server folder and do the further steps as mentioned

6. For JWT_SECRET, You need to generate a strong secret key for JWT authentication.  
Do **NOT** use the placeholder `GENERATE_A_STRONG_RANDOM_SECRET_KEY_HERE`.

#### 1. Generate a random secret:
Run the following commands in your terminal and place the generated key in the value

```bash
openssl rand -base64 32
```

#### 2. Generate a 64-character hexadecimal secret:
Run the following command in your terminal (Linux/macOS):

```bash
openssl rand -hex 32
```
and modify

```bash
ENCRYPTION_SECRET="your_generated_secret_here"
```

7. Provide your Gemini api key and Ollama url for admin ( Necessary)

8. **Sentry DSN Setup** ( Necessary )

We use [Sentry](https://sentry.io) for error tracking and monitoring.  
To connect your application to Sentry, you’ll need a `SENTRY_DSN`.


9. **Nodemail setup** ( Necessary )

Add the mail creadentials and all into the env file as below with your own credentials ( You can ask the process to AI )

```bash
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="user mail"
EMAIL_PASS="email password"
```

#### 1. Create a free Sentry account
- Go to [https://sentry.io/signup/](https://sentry.io/signup/)
- Sign up using GitHub, GitLab, or email.

#### 2. Create a new project
- Once logged in, click **Projects → Create Project**.
- Choose your platform (e.g., **Node.js**, **React**, **Express**, etc.).
- Give the project a name (example: `my-app`).
- Select or create an **Organization** (Sentry groups projects inside orgs).
- Click **Create Project**.

#### 3. Get your DSN
- After creating the project, Sentry shows you a **setup page** with code snippets.
- Look for something like: https://<PUBLIC_KEY>@o<ORG_ID>.ingest.sentry.io/<PROJECT_ID>

That’s your **DSN**.

#### 4. Add it to your `.env` file
```env
SENTRY_DSN="https://<PUBLIC_KEY>@o<ORG_ID>.ingest.sentry.io/<PROJECT_ID>"
```

9. ☁️ AWS S3 Credentials Setup

Some functionalities (like dataset backup, cloud file storage, and retrieval) require AWS S3.  
These credentials are **optional**, but **needed if you want cloud features to work**.

#### 1. Create an AWS Account
- Go to [https://aws.amazon.com](https://aws.amazon.com) and sign up.
- You’ll need to add billing details (AWS has a Free Tier).

#### 2. Create an S3 Bucket
- Log in to the **AWS Management Console**.
- Navigate to **Services → S3 → Create bucket**.
- Enter a **unique bucket name** (e.g., `my-app-datasets`).
- Choose a region (e.g., `us-east-1`).
- Leave defaults or adjust according to your needs.
- Click **Create bucket**.

#### 3. Create an IAM User for S3 Access
- Go to **IAM (Identity & Access Management)** in AWS.
- Click **Users → Add Users**.
- Choose a username (e.g., `my-app-s3-user`).
- Select **Programmatic access** (so you can use Access Key/Secret).
- Attach permissions → choose **Attach existing policies directly**.
- Select **AmazonS3FullAccess** (or create a more restricted policy).
- Click **Next** and finish user creation.

#### 4. Get Access Keys
- After creating the IAM user, download the **Access Key ID** and **Secret Access Key**.
- Keep them safe — you won’t be able to see the secret again later.

#### 5. Add to your `.env` file
```env
S3_BUCKET_NAME="your-s3-bucket-name-here"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
AWS_REGION="us-east-1"
```



10. Check & Stop Old Containers

- Before running new containers, make sure no old ones are active:

```bash
sudo docker ps
```
If you see any containers running from a previous setup, stop them:


```bash
sudo docker compose down
```

11. Start Docker Services

Now bring up all required services in detached mode:

```bash
sudo docker compose up -d
```

12. Expose Application to LAN

- Run Rag Service

```bash
cd server/rag_service
source venv/bin/activate
python app.py
```

- Run server

Open new terminal

```bash
cd server
npm run dev
```


- Run frontend

Open new terminal

```bash
cd frontend
npm run dev
```


**Export into lan**

```bash
sudo ufw allow 2000/tcp
sudo ufw allow 2173/tcp
sudo ufw allow 2001/tcp
sudo ufw allow 2003:2009/tcp
```



### Thats it...It will be deployed in LAN

----

Windows Setup
For Windows, dependencies must be installed individually. Using a package manager like Chocolatey can simplify the process.
[!NOTE]
After installing command-line tools like FFmpeg or Tesseract, you must add their installation bin directories to your system's PATH environment variable and restart your terminal or command prompt.
Docker Desktop: Download and install from the official Docker website.
Node.js: Download and run the Node.js 18.x LTS installer from nodejs.org.
Python: Install Python 3.10 from the Microsoft Store or python.org. Ensure you check "Add Python to PATH" during installation.
MongoDB: Download and run the MongoDB Community Server installer from the MongoDB website.
Tesseract OCR: Download and run an installer from the Tesseract at UB Mannheim project.
FFmpeg: Download the FFmpeg binaries from the official website, extract the files, and add the bin folder to your system's PATH.
Usage
1. Clone the Repository
code
```Bash
git clone https://github.com/tej-a192/chatbot-Team-2.git
cd chatbot-Team-2
2. Configure Environment Variables
Create .env files for the server and frontend by copying the provided examples.
[!IMPORTANT]
The .env files contain sensitive information like API keys and database credentials. They are ignored by Git via the .gitignore file and should never be committed to your repository.
Backend Server:
```

> [!NOTE]
> Running install.sh will predefine and configures the application folder
> Just update your env by running the enironment


code
```Bash
bash install.sh
```

code
``` Bash
cd server

example env

PORT=2000
MONGO_URI="mongodb://localhost:27017/chatbot_gemini"
JWT_SECRET="your_super_strong_and_secret_jwt_key_12345"
GEMINI_API_KEY="AIzaSyCHuH6_DJuxGawHM2QqU5YNM8Zpp0xVl_I"
PROMPT_COACH_GEMINI_MODEL=gemini-2.5-pro
PROMPT_COACH_OLLAMA_MODEL=qwen2.5:14b-instruct
PYTHON_RAG_SERVICE_URL="http://127.0.0.1:2001"
OLLAMA_API_BASE_URL="https://angels-himself-fixtures-unknown.trycloudflare.com"
OLLAMA_DEFAULT_MODEL="qwen2.5:14b-instruct"
ENCRYPTION_SECRET=583c0c57ffbb993163e28273671daebf880eb972d6d1402613be9da09a5297e2
SENTRY_DSN="https://458178e6527d82e9373ea1b1b34d3954@o4509804762497024.ingest.us.sentry.io/4509804765577216"
REDIS_URL="redis://localhost:6379"
FIXED_ADMIN_USERNAME=admin@admin.com
FIXED_ADMIN_PASSWORD=admin123
ELASTICSEARCH_URL=http://localhost:2006
# --- AWS S3 Credentials for Dataset Management ---
# Replace placeholders below with your actual values
S3_BUCKET_NAME="ai-tutor-datasets-rohith"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"


```

```Bash
# From the root directory
cd frontend


example env

VITE_API_BASE_URL=http://localhost:2000/api
VITE_ADMIN_USERNAME=admin@admin.com
VITE_ADMIN_PASSWORD=admin123

```

Edit the `.env` file to point to your backend API.

### 3. Install Dependencies & Seed Database

This step installs all required packages and populates the database with the initial LLM models for the admin panel.

1.  **Install Node.js & Python packages**:
    ```bash
    # In one terminal (from root directory)
    cd server
    npm install
    
    # In a second terminal (from root directory)
    cd server/rag_service
    pip install -r requirements.txt
    python -m spacy download en_core_web_sm
    ```

2.  **Seed the LLM Data for the Admin Panel**:
    > [!IMPORTANT]
    > This script must be run once before starting the application. It populates the database with the default LLM providers, making them available for the AI Router and admin dashboard.
    ```bash
    # In your first terminal (the one in the 'server' directory)
    node scripts/seedLLMs.js
    ```

### 4. Running The Application

Open multiple terminal windows to run each component of the application in the correct order.

1.  **Start Docker Services**: Run all containerized services in detached mode.
    ```bash
    # From the root directory of the project
    docker compose up -d
    ```

2.  **Run the Python RAG Service**:
    ```bash
    # In your second terminal (the 'server/rag_service' directory)
    python app.py
    ```

3.  **Run the Node.js Backend**:
    ```bash
    # In your first terminal (the 'server' directory)
    npm start
    ```

4.  **Run the Frontend Application**:
    ```bash
    # In a third terminal (from root directory)
    cd frontend
    npm install
    npm run dev
    ```

You can now access the application at **`http://localhost:2173`** in your browser.

---

## Observability Stack

The application stack includes a full suite of monitoring tools. Access them via your browser:

> [!NOTE]
> The Neo4j Browser at `http://localhost:2004` will prompt for a username and password. The default credentials, as set in the `docker-compose.yml` file, are `neo4j` / `password`.

-   **Grafana**: `http://localhost:2009` (Visualize application performance metrics)
-   **Kibana**: `http://localhost:2007` (Explore and search application logs)
-   **Prometheus**: `http://localhost:2008` (View raw metrics and service discovery)
-   **Qdrant UI**: `http://localhost:2003/dashboard` (Inspect vector database collections)
-   **Neo4j Browser**: `http://localhost:2004` (Query and visualize the knowledge graph)

---

## Contributors
## Team Members & Contributions

| Name                     | Role / Branch | Contribution |
| ------------------------ | -------------- | ------------ |
| **Pavan Teja B**         | `dev/rex`      | - Advanced file parsing <br> - Text Chunking <br> - Vector Embeddings <br> - Multi-Query RAG <br> - KG Construction <br> - Reasoning (CoT, Critical Thinking with ToT) <br> - Content Creation (FAQ, Topics, MindMap) <br> - Markdown handling (Prism.js) <br> - Adaptive Learning Pathways & Personalized Content Curation <br> - "LLM Coach" for Prompt Engineering & Critical Evaluation <br> - Comprehensive User & System Auditing |
| **Livingston D**         | `alpha`        | - Scalable Vector DB (Qdrant) <br> - Semantic Search <br> - KG DB (Neo4j) <br> - Short & Long Term memory <br> - Academic Integrity <br> - Bias Mitigation <br> - Interactive Research Assistant with Real-time & Data-Agnostic Retrieval <br> - Generative AI for Academic Content (Reports, Presentations, Podcasts) <br> - Secure Dataset Management System |
| **Murali Krishna B**     | `dev-mk`       | - UI-Server Integration <br> - User LLM Choice <br> - KG Visualization <br> - Secure Code Executor <br> - Session Management <br> - State Management <br> - Multi-LLM support <br> - Dynamic Concept Mapping & Knowledge Synthesis <br> - Multi-LLM Orchestration for Enhanced Reasoning <br> - Quiz Generator <br> - Feedback loop |
| **Mehaboob Subhani SK**  | `skms`         | - Frontend Component Development & Optimization (UI/UX Efficiency Improvements) <br> - Web Search & arXiv Integration for Knowledge Retrieval <br> - Homepage & Feature Modules Implementation <br> - Interactive Mindmap Visualization with Knowledge Base Integration <br> - Content Generation Pipelines for PPT & DOCX Reports <br> - Rich Markdown Rendering (KaTeX + Prism.js for syntax highlighting) <br> - User-focused Feature Enhancements ensuring smooth interaction & accessibility <br> - Foundation Setup for Scalable Frontend Tooling & Component Reusability <br> - Foundation Document to Podcast Feature |
| **Anusha P**             | `anu`          | Testing |

---

## Demo Video

👉 [Click to Watch the Full Application Demo](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing)