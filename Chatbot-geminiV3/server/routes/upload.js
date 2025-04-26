// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// --- Constants ---
const UPLOAD_DIR = path.join(__dirname, '..', 'assets');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Define allowed types by mimetype and extension (lowercase)
// Mapping mimetype to subfolder name
const allowedMimeTypes = {
    // Documents -> 'docs'
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs', // .docx
    'application/msword': 'docs', // .doc (Might be less reliable mimetype)
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docs', // .pptx
    'application/vnd.ms-powerpoint': 'docs', // .ppt (Might be less reliable mimetype)
    'text/plain': 'docs', // .txt
    // Code -> 'code'
    'text/x-python': 'code', // .py
    'application/javascript': 'code', // .js
    'text/javascript': 'code', // .js (alternative)
    'text/markdown': 'code', // .md
    'text/html': 'code', // .html
    'application/xml': 'code', // .xml
    'text/xml': 'code', // .xml
    'application/json': 'code', // .json
    'text/csv': 'code', // .csv
    // Images -> 'images'
    'image/jpeg': 'images',
    'image/png': 'images',
    'image/bmp': 'images',
    'image/gif': 'images',
    // Add more specific types if needed, otherwise they fall into 'others'
};
// Define allowed extensions (lowercase) - This is a secondary check
const allowedExtensions = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt',
    '.py', '.js', '.md', '.html', '.xml', '.json', '.csv', '.log', // Added .log
    '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];

// --- Multer Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // tempAuth middleware ensures req.user exists here
        if (!req.user || !req.user.username) {
            // This should ideally not happen if tempAuth works correctly
            console.error("Multer Destination Error: User context missing after auth middleware.");
            return cb(new Error("Authentication error: User context not found."));
        }
        const sanitizedUsername = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();

        // Determine subfolder based on mimetype, default to 'others'
        const fileTypeSubfolder = allowedMimeTypes[fileMimeType] || 'others';
        const destinationPath = path.join(UPLOAD_DIR, sanitizedUsername, fileTypeSubfolder);

        // Ensure the destination directory exists (use async for safety)
        fs.mkdir(destinationPath, { recursive: true }, (err) => {
             if (err) {
                 console.error(`Error creating destination path ${destinationPath}:`, err);
                 cb(err);
             } else {
                 cb(null, destinationPath);
             }
         });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        // Sanitize base name: remove extension, replace invalid chars, limit length
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
                                      .replace(/[^a-zA-Z0-9._-]/g, '_') // Allow letters, numbers, dot, underscore, hyphen
                                      .substring(0, 100); // Limit base name length
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});

const fileFilter = (req, file, cb) => {
    // tempAuth middleware should run before this, ensuring req.user exists
    if (!req.user) {
         console.warn(`Upload Rejected (File Filter): User context missing.`);
         const error = new multer.MulterError('UNAUTHENTICATED'); // Custom code?
         error.message = `User not authenticated.`;
         return cb(error, false);
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // Primary check: Mimetype must be in our known list OR extension must be allowed
    // Secondary check: Extension must be in the allowed list
    const isMimeTypeKnown = !!allowedMimeTypes[mimeType];
    const isExtensionAllowed = allowedExtensions.includes(fileExt);

    // Allow if (MIME type is known OR extension is explicitly allowed) AND extension is in the allowed list
    // This allows known MIME types even if extension isn't listed, and listed extensions even if MIME isn't known (e.g. text/plain for .log)
    // But we always require the extension itself to be in the allowed list for safety.
    // if ((isMimeTypeKnown || isExtensionAllowed) && isExtensionAllowed) {

    // Stricter: Allow only if BOTH mimetype is known AND extension is allowed
    if (isMimeTypeKnown && isExtensionAllowed) {
        cb(null, true); // Accept file
    } else {
        console.warn(`Upload Rejected (File Filter): User='${req.user.username}', File='${file.originalname}', MIME='${mimeType}', Ext='${fileExt}'. MimeKnown=${isMimeTypeKnown}, ExtAllowed=${isExtensionAllowed}`);
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        error.message = `Invalid file type or extension. Allowed extensions: ${allowedExtensions.join(', ')}`;
        cb(error, false); // Reject file
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});
// --- End Multer Config ---


// --- Function to call Python RAG service ---
async function triggerPythonRagProcessing(userId, filePath, originalName) {
    // Read URL from environment variable set during startup
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("PYTHON_RAG_SERVICE_URL is not set in environment. Cannot trigger processing.");
        // Optionally: Delete the uploaded file if processing can't be triggered?
        // await fs.promises.unlink(filePath).catch(e => console.error(`Failed to delete unprocessed file ${filePath}: ${e}`));
        return { success: false, message: "RAG service URL not configured." }; // Indicate failure
    }
    const addDocumentUrl = `${pythonServiceUrl}/add_document`;
    console.log(`Triggering Python RAG processing for ${originalName} (User: ${userId}) at ${addDocumentUrl}`);
    try {
        // Send absolute path
        const response = await axios.post(addDocumentUrl, {
            user_id: userId,
            file_path: filePath, // Send the absolute path
            original_name: originalName
        }, { timeout: 300000 }); // 5 minute timeout for processing

        console.log(`Python RAG service response for ${originalName}:`, response.data);
        // Check response.data.status ('added' or 'skipped')
        if (response.data?.status === 'skipped') {
             console.warn(`Python RAG service skipped processing ${originalName}: ${response.data.message}`);
             return { success: true, status: 'skipped', message: response.data.message };
        } else if (response.data?.status === 'added') {
             return { success: true, status: 'added', message: response.data.message };
        } else {
             console.warn(`Unexpected response status from Python RAG service for ${originalName}: ${response.data?.status}`);
             return { success: false, message: `Unexpected RAG status: ${response.data?.status}` };
        }

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Unknown RAG service error";
        console.error(`Error calling Python RAG service for ${originalName}:`, errorMsg);
        // Maybe delete the file if the call fails? Depends on retry logic.
        // await fs.promises.unlink(filePath).catch(e => console.error(`Failed to delete file ${filePath} after RAG call error: ${e}`));
        return { success: false, message: `RAG service call failed: ${errorMsg}` }; // Indicate failure
    }
}
// --- End Function ---


// --- Modified Upload Route ---
router.post('/', tempAuth, (req, res) => {
    // req.user guaranteed by tempAuth
    const uploader = upload.single('file'); // 'file' must match the key in FormData

    uploader(req, res, async function (err) {
        // Ensure req.user exists after middleware execution
        if (!req.user) {
             console.error("!!! Upload handler: req.user not found after tempAuth.");
             // Avoid sending detailed error to client
             return res.status(401).json({ message: "Authentication error during upload." });
        }
        const userId = req.user._id.toString(); // Get userId here

        // --- Handle Multer Errors ---
        if (err) {
            console.error(`!!! Error during upload middleware for user ${req.user.username}:`, err);
            if (err instanceof multer.MulterError) {
                let message = "File upload failed.";
                if (err.code === 'LIMIT_FILE_SIZE') message = `File too large. Max: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`;
                else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = err.message || 'Invalid file type.';
                else if (err.code === 'UNAUTHENTICATED') message = err.message || 'Authentication required.';
                // Avoid exposing filesystem errors directly
                return res.status(400).json({ message });
            } else {
                // Handle other errors (e.g., filesystem errors from storage)
                return res.status(500).json({ message: "Server error during upload preparation." });
            }
        }

        // --- Handle No File Case ---
        if (!req.file) {
            // This case might happen if fileFilter rejected the file but didn't throw a MulterError handled above
            console.warn(`Upload request for User '${req.user.username}' completed, but req.file is missing (potentially filtered).`);
            // Check if filter error message exists
            const filterError = req.multerFilterError; // Check if filter attached an error
            return res.status(400).json({ message: filterError?.message || "No valid file received or file type rejected." });
        }

        // --- File Successfully Saved by Multer ---
        const { path: filePath, originalname: originalName, filename: serverFilename } = req.file;
        const absoluteFilePath = path.resolve(filePath); // Ensure absolute path

        console.log(`<<< POST /api/upload successful for User '${req.user.username}'. File: ${serverFilename}.`);
        console.log(`   Absolute path: ${absoluteFilePath}`);

        // --- Trigger Python processing asynchronously ---
        // No await here, let the response go back quickly
        triggerPythonRagProcessing(userId, absoluteFilePath, originalName)
            .then(ragResult => {
                if (!ragResult.success) {
                     console.error(`Background RAG processing failed for ${originalName} (User: ${userId}): ${ragResult.message}`);
                     // Optional: Implement a mechanism to notify the user later or mark the file as unprocessed.
                } else {
                     console.log(`Background RAG processing initiated/completed for ${originalName} (User: ${userId}). Status: ${ragResult.status}`);
                }
            })
            .catch(error => {
                 // Log errors from initiating the trigger itself (should be rare)
                 console.error(`Error initiating background Python RAG processing for ${originalName}:`, error);
            });

        // --- Respond Immediately to the Client ---
        res.status(200).json({
            message: "File uploaded successfully! Background processing started.",
            filename: serverFilename, // Send back the generated server filename
            originalname: originalName,
        });
    });
});

module.exports = router;
