// server/server.js
const dotenv = require("dotenv");
dotenv.config();

const { register } = require('./utils/metrics');
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios"); // Import axios for checkRagService

// --- Custom Modules & Middleware ---
const connectDB = require("./config/db");
const { getLocalIPs } = require("./utils/networkUtils");
const { authMiddleware } = require("./middleware/authMiddleware");
const { adminAuthMiddleware } = require('./middleware/adminAuthMiddleware');
const { connectRedis } = require("./config/redisClient");
const { logger } = require('./utils/logger');
const { checkEmailCredentials } = require('./services/emailService');
const { setupAdmin } = require('./scripts/setupAdmin');

logger.info('--- WINSTON LOGGER INITIALIZED IN SERVER.JS ---');

// --- User-Facing Route Imports ---
const networkRoutes = require("./routes/network");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chat");
const uploadRoutes = require("./routes/upload");
const analysisRoutes = require("./routes/analysis");
const subjectsRoutes = require("./routes/subjects");
const generationRoutes = require("./routes/generationRoutes");
const exportRoutes = require("./routes/export");
const kgRoutes = require("./routes/kg");
const llmConfigRoutes = require("./routes/llmConfig");
const toolsRoutes = require("./routes/tools");
const learningRoutes = require("./routes/learning");
const learningPathRoutes = require("./routes/learningPath");
const knowledgeSourceRoutes = require("./routes/knowledgeSource");
const feedbackRoutes = require('./routes/feedback');
const courseRoutes = require("./routes/course"); 

// --- Admin-Specific Route Imports ---
const adminCoreRoutes = require('./routes/admin');
const courseAdminRoutes = require('./routes/courseAdmin');
const documentAdminRoutes = require('./routes/documentAdmin');
const datasetRoutes = require('./routes/datasetRoutes');
const analyticsRoutes = require('./routes/analytics');
const finetuningRoutes = require('./routes/finetuning');

// --- Configuration & Express App Setup ---
const port = process.env.PORT || 5001;
const mongoUri = process.env.MONGO_URI;
const pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL;

if (!process.env.JWT_SECRET || !process.env.ENCRYPTION_SECRET) {
  logger.error("!!! FATAL: JWT_SECRET or ENCRYPTION_SECRET is not set in .env file.");
  process.exit(1);
}
if (!mongoUri) {
  logger.error("!!! FATAL: MONGO_URI is not set in .env file.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

app.use((req, res, next) => {
  console.log(`[Server] --> ${req.method} ${req.originalUrl}`);
  next();
});

// --- Public Routes ---
app.get("/", (req, res) => res.send("AI Tutor Backend API is running..."));
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
app.use("/network", networkRoutes);
app.use("/auth", authRoutes);

// --- Admin Routes ---
// Apply the admin authentication middleware to all routes prefixed with /admin.
app.use('/admin', adminAuthMiddleware);

// Now, mount each admin-specific router directly and explicitly.
// Express will find the correct route without ambiguity.
app.use('/admin/documents', documentAdminRoutes);
app.use('/admin/courses', courseAdminRoutes);
app.use('/admin/datasets', datasetRoutes);
app.use('/admin/analytics', analyticsRoutes);
app.use('/admin/finetuning', finetuningRoutes);
app.use('/admin', adminCoreRoutes); // General routes like /llms, /key-requests come last.

// --- GLOBAL AUTHENTICATION GATE for regular users ---
app.use(authMiddleware);

// --- Protected User Routes ---
app.use("/user", userRoutes);
app.use("/courses", courseRoutes); 
app.use("/chat", chatRoutes);
app.use("/learning", learningRoutes);
app.use("/learning/paths", learningPathRoutes);
app.use("/upload", uploadRoutes);
app.use("/analysis", analysisRoutes);
app.use("/subjects", subjectsRoutes);
app.use("/generate", generationRoutes);
app.use("/export", exportRoutes);
app.use("/kg", kgRoutes);
app.use("/llm", llmConfigRoutes);
app.use("/tools", toolsRoutes);
app.use("/knowledge-sources", knowledgeSourceRoutes);
app.use('/feedback', feedbackRoutes);

// --- Centralized Error Handling ---
app.use((err, req, res, next) => {
  logger.error("Unhandled Error:", { message: err.message, stack: err.stack });
  const statusCode = err.status || 500;
  const message = err.message || "An internal server error occurred.";
  if (!res.headersSent) {
    res.status(statusCode).json({ message });
  }
});

// --- Server Startup Logic ---
async function startServer() {
  logger.info("--- Starting Server Initialization ---");
  try {
    await setupAdmin(mongoUri);
    await connectDB(mongoUri);
    await checkEmailCredentials();
    await checkRagService(pythonRagUrl);
    await connectRedis();

    const server = app.listen(port, "0.0.0.0", () => {
      logger.info("=== Node.js Server (HTTP) Ready ===");
      logger.info(`🚀 Server listening on port ${port}`);
      getLocalIPs().forEach((ip) => {
        logger.info(`   - http://${ip}:${port}`);
      });
      logger.info("============================");
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(async () => {
        logger.info("HTTP server closed.");
        await mongoose.disconnect();
        logger.info("MongoDB connection closed.");
        process.exit(0);
      });
    };
    
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  } catch (error) {
    logger.error("!!! Failed to start Node.js server:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

async function checkRagService(url) {
  if (!url) {
    logger.warn("Python RAG service URL not configured.");
    return;
  }
  try {
    const response = await axios.get(`${url}/health`, { timeout: 7000 });
    if (response.data.status === "ok") {
      logger.info("✓ Python RAG service is available.");
    } else {
      logger.warn(`! RAG service is not healthy. Status: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    logger.warn(`! RAG service is not reachable at ${url}. Error: ${error.message}`);
  }
}

startServer();
