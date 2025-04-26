// server/server.js
const express = require('express');
// const dotenv = require('dotenv'); // Removed dotenv
const cors = require('cors');
const path = require('path');
const { getLocalIPs } = require('./utils/networkUtils');
const fs = require('fs');
const axios = require('axios');
const os = require('os');
const mongoose = require('mongoose'); // Import mongoose for closing connection
const readline = require('readline').createInterface({ // For prompting
  input: process.stdin,
  output: process.stdout,
});

// --- Custom Modules ---
const connectDB = require('./config/db');
const { performAssetCleanup } = require('./utils/assetCleanup');

// --- Configuration Loading ---
// dotenv.config(); // Removed dotenv

// --- Configuration Defaults & Variables ---
const DEFAULT_PORT = 5001;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/chatbotGeminiDB'; // Default DB URI
const DEFAULT_PYTHON_RAG_URL = 'http://localhost:5002'; // Default RAG service URL

let port = process.env.PORT || DEFAULT_PORT; // Use environment variable PORT if set, otherwise default
let mongoUri = process.env.MONGO_URI || ''; // Use environment variable if set
let pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL || ''; // Use environment variable if set
let geminiApiKey = process.env.GEMINI_API_KEY || ''; // MUST be set via environment

// --- Express Application Setup ---
const app = express();

// --- Core Middleware ---
app.use(cors()); // Allows requests from frontend (potentially on different IPs in LAN)
app.use(express.json());

// --- Basic Root Route ---
app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));

// --- API Route Mounting ---
app.use('/api/network', require('./routes/network')); // For IP info
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/files', require('./routes/files'));

// --- Centralized Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const statusCode = err.status || 500;
    let message = err.message || 'An internal server error occurred.';
    // Sanitize potentially sensitive error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'An internal server error occurred.';
    }
    // Ensure response is JSON for API routes
    if (req.originalUrl.startsWith('/api/')) {
         return res.status(statusCode).json({ message: message });
    }
    // Fallback for non-API routes if any
    res.status(statusCode).send(message);
});

// --- Server Instance Variable ---
let server;

// --- Graceful Shutdown Logic ---
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    readline.close(); // Close readline interface
    try {
        // Close HTTP server first to stop accepting new connections
        if (server) {
            server.close(async () => {
                console.log('HTTP server closed.');
                // Close MongoDB connection
                try {
                    await mongoose.connection.close();
                    console.log('MongoDB connection closed.');
                } catch (dbCloseError) {
                    console.error("Error closing MongoDB connection:", dbCloseError);
                }
                process.exit(0); // Exit after server and DB are closed
            });
        } else {
             // If server wasn't assigned, try closing DB and exit
             try {
                 await mongoose.connection.close();
                 console.log('MongoDB connection closed.');
             } catch (dbCloseError) {
                 console.error("Error closing MongoDB connection:", dbCloseError);
             }
            process.exit(0);
        }

        // Force exit after timeout if server.close callback doesn't finish
        setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit.');
            process.exit(1);
        }, 10000); // 10 seconds

    } catch (shutdownError) {
        console.error("Error during graceful shutdown initiation:", shutdownError);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- RAG Service Health Check ---
async function checkRagService(url) {
    console.log(`\nChecking RAG service health at ${url}...`);
    try {
        const response = await axios.get(`${url}/health`, { timeout: 7000 }); // 7 second timeout
        if (response.status === 200 && response.data?.status === 'ok') {
            console.log('✓ RAG service is available and healthy.');
            console.log(`  Embedding: ${response.data.embedding_model_type} (${response.data.embedding_model_name})`);
            console.log(`  Default Index Loaded: ${response.data.default_index_loaded}`);
            if (response.data.message && response.data.message.includes("Warning:")) {
                 console.warn(`  RAG Health Warning: ${response.data.message}`);
            }
            return true;
        } else {
             console.warn(`! RAG service responded but status is not OK: ${response.status} - ${JSON.stringify(response.data)}`);
             return false;
        }
    } catch (error) {
        console.warn('! RAG service is not reachable.');
        if (error.code === 'ECONNREFUSED') {
             console.warn(`  Connection refused at ${url}. Ensure the RAG service (server/rag_service/app.py) is running.`);
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
             console.warn(`  Connection timed out to ${url}. The RAG service might be slow to start or unresponsive.`);
        }
         else {
             console.warn(`  Error: ${error.message}`);
        }
        console.warn('  RAG features (document upload processing, context retrieval) will be unavailable.');
        return false;
    }
}

// --- Directory Structure Check (Simplified) ---
async function ensureServerDirectories() {
    const dirs = [
        path.join(__dirname, 'assets'),
        path.join(__dirname, 'backup_assets'),
        // Add other essential dirs if needed
    ];
    console.log("\nEnsuring server directories exist...");
    try {
        for (const dir of dirs) {
            // Check existence synchronously, create asynchronously
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
                console.log(`  Created directory: ${dir}`);
            } else {
                // console.log(`  Directory exists: ${dir}`); // Optional: be less verbose
            }
        }
        console.log("✓ Server directories checked/created.");
    } catch (error) {
        console.error('!!! Error creating essential server directories:', error);
        throw error; // Prevent server start if essential dirs fail
    }
}

// --- Prompt for Configuration ---
function askQuestion(query) {
    return new Promise(resolve => readline.question(query, resolve));
}

async function configureAndStart() {
    console.log("--- Starting Server Configuration ---");

    // 1. Gemini API Key Check
    if (!geminiApiKey) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FATAL: GEMINI_API_KEY environment variable is not set. !!!");
        console.error("!!! Please set it before running the server:               !!!");
        console.error("!!! export GEMINI_API_KEY='YOUR_API_KEY'                   !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    } else {
        console.log("✓ GEMINI_API_KEY found.");
    }

    // 2. MongoDB URI
    if (!mongoUri) {
        const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `);
        mongoUri = answer.trim() || DEFAULT_MONGO_URI;
    }
    console.log(`Using MongoDB URI: ${mongoUri}`);

    // 3. Python RAG Service URL
    if (!pythonRagUrl) {
        const answer = await askQuestion(`Enter Python RAG Service URL or press Enter for default (${DEFAULT_PYTHON_RAG_URL}): `);
        pythonRagUrl = answer.trim() || DEFAULT_PYTHON_RAG_URL;
    }
    console.log(`Using Python RAG Service URL: ${pythonRagUrl}`);

    // 4. Port (Optional override via prompt, primarily uses ENV or default)
    // You could add a prompt here if needed, but ENV variable is common practice
    console.log(`Node.js server will listen on port: ${port}`);

    readline.close(); // Close the prompt interface

    // --- Pass configuration to other modules (if needed) ---
    // We'll make connectDB and services read directly or pass via function calls
    process.env.MONGO_URI = mongoUri; // Set for db.js
    process.env.PYTHON_RAG_SERVICE_URL = pythonRagUrl; // Set for chat.js, upload.js
    // GEMINI_API_KEY is already in process.env

    console.log("--- Configuration Complete ---");

    // --- Proceed with Server Startup ---
    await startServer();
}


// --- Asynchronous Server Startup Function ---
async function startServer() {
    console.log("\n--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories(); // Check/create assets, backup_assets dirs
        await connectDB(mongoUri); // Connect to MongoDB - Pass URI explicitly
        await performAssetCleanup(); // Backup existing assets, create fresh user folders
        await checkRagService(pythonRagUrl); // Check Python RAG service status

        const PORT = port; // Use the configured port
        const availableIPs = getLocalIPs(); // Get all local IPs

        server = app.listen(PORT, '0.0.0.0', () => { // Listen on all interfaces
            console.log('\n=== Node.js Server Ready ===');
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log('   Access the application via these URLs (using common frontend ports):');
            const frontendPorts = [3000, 3001, 8080, 5173]; // Common React/Vite ports
            availableIPs.forEach(ip => {
                 frontendPorts.forEach(fp => {
                    console.log(`   - http://${ip}:${fp} (Frontend) -> Connects to Backend at http://${ip}:${PORT}`);
                 });
            });
            console.log('============================\n');
            console.log("💡 Hint: Client automatically detects backend IP based on how you access the frontend.");
            console.log(`   Ensure firewalls allow connections on port ${PORT} (Backend) and your frontend port.`);
            console.log("--- Server Initialization Complete ---");
        });

    } catch (error) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! Failed to start Node.js server:", error.message);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1); // Exit if initialization fails
    }
}

// --- Execute Configuration and Server Start ---
configureAndStart();
