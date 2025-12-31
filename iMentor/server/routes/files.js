// // server/routes/files.js
// const express = require('express');
// const fs = require('fs').promises;
// const path = require('path');
// const { authMiddleware } = require('../middleware/authMiddleware');
// const User = require('../models/User');
// const axios = require('axios');
// const router = express.Router();

// const ASSETS_DIR = path.join(__dirname, '..', 'assets');
// const BACKUP_DIR = path.join(__dirname, '..', 'backup_assets');

// // --- Helper functions (sanitizeUsernameForDir, parseServerFilename, ensureDirExists are existing) ---
// const sanitizeUsernameForDir = (username) => {
//     if (!username) return '';
//     return username.replace(/[^a-zA-Z0-9_-]/g, '_');
// };

// const parseServerFilename = (filename) => {
//     // Matches "timestamp-originalName.ext"
//     // Allows originalName to contain dots now.
//     const match = filename.match(/^(\d+)-(.+?)(\.\w+)$/);
//     if (match && match.length === 4) {
//         return { timestamp: match[1], originalName: `${match[2]}${match[3]}`, extension: match[3] };
//     }
//     // Fallback for names that might not perfectly fit the new pattern, or originalName without extension before timestamp
//     const ext = path.extname(filename);
//     const baseWithoutExt = filename.substring(0, filename.length - ext.length);
//     const tsMatch = baseWithoutExt.match(/^(\d+)-(.*)$/);
//     if (tsMatch) {
//         return { timestamp: tsMatch[1], originalName: `${tsMatch[2]}${ext}`, extension: ext };
//     }
//     // Final fallback if no timestamp prefix is reliably parsed
//     return { timestamp: null, originalName: filename, extension: path.extname(filename) };
// };

// const ensureDirExists = async (dirPath) => {
//     try { await fs.mkdir(dirPath, { recursive: true }); }
//     catch (error) { if (error.code !== 'EEXIST') { console.error(`Error creating dir ${dirPath}:`, error); throw error; } }
// };

// async function callPythonDeletionEndpoint(method, endpointPath, userId, originalName, logContext) {
//     const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL || process.env.DEFAULT_PYTHON_RAG_URL || 'http://localhost:5000'; // Fallback if not set
//     if (!pythonServiceUrl) {
//         console.error(`Python Service Deletion Error for ${logContext}: PYTHON_RAG_SERVICE_URL not set.`);
//         return { success: false, message: "Python service URL not configured." };
//     }

//     const deleteUrl = `${pythonServiceUrl.replace(/\/$/, '')}${endpointPath}`;

//     try {
//         console.log(`Calling Python Service (${method.toUpperCase()}) for deletion: ${deleteUrl} (Doc: ${originalName}, User: ${userId})`);
//         let response;
//         if (method.toUpperCase() === 'DELETE') {
//             // For DELETE, data is often in query params or path, but axios allows a 'data' field for body
//             response = await axios.delete(deleteUrl, {
//                 data: { // For Python endpoints that expect a body (like a new Qdrant delete one)
//                     user_id: userId,
//                     document_name: originalName
//                 },
//                 timeout: 30000 // 30s timeout
//             });
//         } else {
//             throw new Error(`Unsupported method for Python deletion: ${method}`);
//         }

//         if (response.status === 200 || response.status === 204) { // 204 No Content is also success
//             return { success: true, message: response.data?.message || `Successfully deleted from ${endpointPath}` };
//         } else {
//             return { success: false, message: response.data?.message || `Python service returned ${response.status} for ${endpointPath}` };
//         }
//     } catch (error) {
//         const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || `Unknown error deleting from ${endpointPath}`;
//         console.error(`Error calling Python Service for deletion (${deleteUrl}) for ${originalName} (User: ${userId}): ${errorMsg}`, error.response ? { status: error.response.status, data: error.response.data } : error);
//         return { success: false, message: `Python service call failed for ${endpointPath}: ${errorMsg}` };
//     }
// }
// // --- End Helper Functions ---


// // --- @route   GET /api/files ---
// // Use authMiddleware middleware 
// // TO GET FILE NAMES
// router.get('/', authMiddleware, async (req, res) => {
    
//     const userFiles = []
//     try {
//         const userId = req.user._id.toString();

//         // Find user by ID, select only uploadedDocuments to optimize
//         const user = await User.findById(userId).select('uploadedDocuments');

//         if (!user) return res.status(404).json({ msg: 'User not found' });

//         // Extract filenames
//         const filenames = user.uploadedDocuments
//         .map(doc => doc.filename)
//         .filter(Boolean)  // filter out undefined or null filenames just in case
//         .reverse();       // reverse the order

//         return res.json({ filenames });

//     } catch (error) {
//         console.log(error.message);
//         return res.status(500).json({ msg: 'Server error' });
//     }
// });


// // --- @route   DELETE /api/files/:serverFilename ---
// // Use authMiddleware middleware
// router.delete('/:serverFilename', authMiddleware, async (req, res) => {
  
//     const { serverFilename } = req.params;
//     const userId = req.user._id.toString(); // Get userId from authenticated user
//     const usernameForLog = req.user.username;

//     if (!serverFilename) {
//         return res.status(400).json({ message: 'Server filename parameter is required.' });
//     }

//     const parsedFileDetails = parseServerFilename(serverFilename);
//     const originalName = parsedFileDetails.originalName;
//     if (!originalName) {
//         console.error(`DELETE /api/files: Could not parse originalName from serverFilename: ${serverFilename}`);
//         return res.status(400).json({ message: 'Invalid server filename format for deletion.' });
//     }
//     const logContext = `File: '${originalName}' (server: ${serverFilename}), User: ${usernameForLog} (${userId})`;
//     console.log(`Attempting to delete all data for ${logContext}`);

//     const results = {
//         mongodb: { success: false, message: "Not attempted" },
//         qdrant: { success: false, message: "Not attempted" },
//         neo4j: { success: false, message: "Not attempted" },
//         filesystem: { success: false, message: "Not attempted" },
//     };
//     let overallSuccess = true; // Assume success, set to false if any critical step fails
//     let httpStatus = 200;
//     let fileFoundInMongo = false;
//     let physicalFileFound = false;

//     try {
//         // 1. Delete from MongoDB
//         try {
//             const user = await User.findById(userId);
//             if (!user) {
//                 results.mongodb.message = "User not found.";
//                 // If user not found, we can't confirm if the file was theirs.
//                 // Treat as if the file wasn't found for this user.
//             } else {
//                 const docIndex = user.uploadedDocuments.findIndex(doc => doc.filename === originalName);
//                 if (docIndex > -1) {
//                     fileFoundInMongo = true;
//                     user.uploadedDocuments.splice(docIndex, 1);
//                     await user.save();
//                     results.mongodb.success = true;
//                     results.mongodb.message = "Successfully removed from user's document list.";
//                     console.log(`MongoDB: Document entry '${originalName}' removed for user ${userId}.`);
//                 } else {
//                     results.mongodb.message = "Document not found in user's list.";
//                     console.log(`MongoDB: Document entry '${originalName}' not found for user ${userId}.`);
//                 }
//             }
//         } catch (mongoError) {
//             console.error(`MongoDB Deletion Error for ${logContext}:`, mongoError);
//             results.mongodb.message = `MongoDB deletion failed: ${mongoError.message}`;
//             overallSuccess = false; // DB error is critical
//         }

//         // 2. Delete from Qdrant (via Python service)
//         // This endpoint will need to be created in Python: e.g., /delete_qdrant_document_data
//         // It should expect { user_id: userId, document_name: originalName } in the body
//         const qdrantDeleteResult = await callPythonDeletionEndpoint(
//             'DELETE',
//             `/delete_qdrant_document_data`,
//             userId,
//             originalName,
//             logContext
//         );
//         results.qdrant = qdrantDeleteResult;
//         if (!qdrantDeleteResult.success) {
//             console.warn(`Qdrant deletion failed or reported no data for ${logContext}. Message: ${qdrantDeleteResult.message}`);
//             // overallSuccess = false; // Non-critical for now, but log
//         }

//         // 3. Delete from Neo4j (via Python service)
//         // This uses the existing Python endpoint: /kg/<user_id>/<document_name>
//         const neo4jEndpointPath = `/kg/${userId}/${encodeURIComponent(originalName)}`;
//         const neo4jDeleteResult = await callPythonDeletionEndpoint(
//             'DELETE',
//             neo4jEndpointPath, // userId and originalName are in the path
//             userId, // still pass for logging consistency in helper
//             originalName, // still pass for logging consistency in helper
//             logContext
//         );
//         results.neo4j = neo4jDeleteResult;
//         if (!neo4jDeleteResult.success) {
//             console.warn(`Neo4j deletion failed or reported no data for ${logContext}. Message: ${neo4jDeleteResult.message}`);
//             // overallSuccess = false; // Non-critical for now, but log
//         }

//         // 4. Move physical file to backup (filesystem operation)
//         let currentPath = null;
//         let fileType = '';
//         const fileTypesToSearch = ['docs', 'images', 'code', 'others'];
//         const sanitizedUsernameForPath = sanitizeUsernameForDir(usernameForLog);

//         for (const type of fileTypesToSearch) {
//             const potentialPath = path.join(ASSETS_DIR, sanitizedUsernameForPath, type, serverFilename);
//             try {
//                 await fs.access(potentialPath); // Check if file exists
//                 currentPath = potentialPath;
//                 fileType = type;
//                 physicalFileFound = true;
//                 break;
//             } catch (e) {
//                 if (e.code !== 'ENOENT') {
//                     console.warn(`Filesystem: Error accessing ${potentialPath} during delete scan: ${e.message}`);
//                 }
//             }
//         }

//         if (currentPath) { // If physical file was found
//             const backupUserDir = path.join(BACKUP_DIR, sanitizedUsernameForPath, fileType);
//             await ensureDirExists(backupUserDir);
//             const backupPath = path.join(backupUserDir, serverFilename);
//             try {
//                 await fs.rename(currentPath, backupPath);
//                 results.filesystem = { success: true, message: "File moved to backup successfully." };
//                 console.log(`Filesystem: Moved '${currentPath}' to '${backupPath}'.`);
//             } catch (fsError) {
//                 console.error(`Filesystem: Error moving file ${currentPath} to backup for ${logContext}:`, fsError);
//                 results.filesystem.message = `Filesystem move to backup failed: ${fsError.message}`;
//                 // overallSuccess = false; // Decide if this is critical enough to mark overall failure
//             }
//         } else {
//             results.filesystem.message = "Physical file not found in assets, or already moved.";
//             console.log(`Filesystem: Physical file '${serverFilename}' not found for user ${usernameForLog}.`);
//         }

//         // Determine final status and message
//         const successfulDeletes = [results.mongodb.success, results.qdrant.success, results.neo4j.success, results.filesystem.success].filter(Boolean).length;

//         if (!fileFoundInMongo && !physicalFileFound) {
//             httpStatus = 404;
//             finalMessage = `File '${originalName}' not found for user.`;
//         } else if (results.mongodb.success) { // Primary record deleted
//             if (successfulDeletes === 4) {
//                 finalMessage = `Successfully deleted all data associated with '${originalName}'.`;
//                 httpStatus = 200;
//             } else {
//                 finalMessage = `File '${originalName}' removed from your list. Some backend data cleanup attempts had issues. Check server logs for details.`;
//                 httpStatus = 207; // Multi-Status
//             }
//         } else { // MongoDB deletion failed, but file might have existed
//             finalMessage = `Failed to remove '${originalName}' from your list. Some backend data cleanup may have also failed. Check server logs.`;
//             httpStatus = 500;
//         }

//         console.log(`Deletion outcome for ${logContext}: HTTP Status=${httpStatus}, Overall Success Flag (was pre-status logic)=${overallSuccess}`);
//         return res.status(httpStatus).json({
//             message: finalMessage,
//             details: results
//         });

//     } catch (error) {
//         console.error(`!!! UNEXPECTED Error in DELETE /api/files/${serverFilename} for user ${usernameForLog}:`, error);
//         return res.status(500).json({
//             message: 'An unexpected server error occurred during file deletion.',
//             details: results // Send partial results if any
//         });
//     }
// });


// module.exports = router;
