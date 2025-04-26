// server/routes/files.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BACKUP_DIR = path.join(__dirname, '..', 'backup_assets');

// --- Helper functions ---
const sanitizeUsernameForDir = (username) => {
    if (!username) return '';
    return username.replace(/[^a-zA-Z0-9_-]/g, '_');
};
const parseServerFilename = (filename) => {
    const match = filename.match(/^(\d+)-(.*?)(\.\w+)$/);
    if (match && match.length === 4) {
        return { timestamp: match[1], originalName: `${match[2]}${match[3]}`, extension: match[3] };
    }
     // Handle cases where the original name might not have an extension or parsing fails
    const ext = path.extname(filename);
    const base = filename.substring(0, filename.length - ext.length);
    const tsMatch = base.match(/^(\d+)-(.*)$/);
    if (tsMatch) {
        return { timestamp: tsMatch[1], originalName: `${tsMatch[2]}${ext}`, extension: ext };
    }
    // Fallback if no timestamp prefix found (less ideal)
    return { timestamp: null, originalName: filename, extension: path.extname(filename) };
};
const ensureDirExists = async (dirPath) => {
    try { await fs.mkdir(dirPath, { recursive: true }); }
    catch (error) { if (error.code !== 'EEXIST') { console.error(`Error creating dir ${dirPath}:`, error); throw error; } }
};
// --- End Helper Functions ---


// --- @route   GET /api/files ---
// Use tempAuth middleware
router.get('/', tempAuth, async (req, res) => {
    // req.user is guaranteed to exist here because of tempAuth middleware
    const sanitizedUsername = sanitizeUsernameForDir(req.user.username);
    if (!sanitizedUsername) {
        console.warn("GET /api/files: Invalid user identifier after sanitization.");
        return res.status(400).json({ message: 'Invalid user identifier.' });
    }

    const userAssetsDir = path.join(ASSETS_DIR, sanitizedUsername);
    const fileTypes = ['docs', 'images', 'code', 'others'];
    const userFiles = [];

    try {
        // Check if user directory exists
        try { await fs.access(userAssetsDir); }
        catch (e) {
             if (e.code === 'ENOENT') { return res.status(200).json([]); } // No dir, no files
             throw e; // Other error
        }

        // Scan subdirectories
        for (const type of fileTypes) {
            const typeDir = path.join(userAssetsDir, type);
            try {
                const filesInDir = await fs.readdir(typeDir);
                for (const filename of filesInDir) {
                    const filePath = path.join(typeDir, filename);
                    try {
                        const stats = await fs.stat(filePath);
                        if (stats.isFile()) {
                            const parsed = parseServerFilename(filename);
                            userFiles.push({
                                serverFilename: filename, originalName: parsed.originalName, type: type,
                                relativePath: path.join(type, filename).replace(/\\/g, '/'),
                                size: stats.size, lastModified: stats.mtime,
                            });
                        }
                    } catch (statError) { console.warn(`GET /api/files: Stat failed for ${filePath}:`, statError.message); }
                }
            } catch (err) { if (err.code !== 'ENOENT') { console.warn(`GET /api/files: Read failed for ${typeDir}:`, err.message); } }
        }

        userFiles.sort((a, b) => a.originalName.localeCompare(b.originalName));
        res.status(200).json(userFiles);

    } catch (error) {
        console.error(`!!! Error in GET /api/files for user ${sanitizedUsername}:`, error);
        res.status(500).json({ message: 'Failed to retrieve file list.' });
    }
});

// --- @route   PATCH /api/files/:serverFilename ---
// Use tempAuth middleware
router.patch('/:serverFilename', tempAuth, async (req, res) => {
    const { serverFilename } = req.params;
    const { newOriginalName } = req.body;
    const sanitizedUsername = sanitizeUsernameForDir(req.user.username); // req.user set by tempAuth

    // Validations
    if (!sanitizedUsername) return res.status(400).json({ message: 'Invalid user identifier.' });
    if (!serverFilename) return res.status(400).json({ message: 'Server filename parameter is required.' });
    if (!newOriginalName || typeof newOriginalName !== 'string' || newOriginalName.trim() === '') return res.status(400).json({ message: 'New file name is required.' });
    if (newOriginalName.includes('/') || newOriginalName.includes('\\') || newOriginalName.includes('..')) return res.status(400).json({ message: 'New file name contains invalid characters.' });

    try {
        const parsedOld = parseServerFilename(serverFilename);
        if (!parsedOld.timestamp) return res.status(400).json({ message: 'Invalid server filename format (missing timestamp prefix).' });

        // Find current file path
        let currentPath = null; let fileType = '';
        const fileTypesToSearch = ['docs', 'images', 'code', 'others'];
        for (const type of fileTypesToSearch) {
            const potentialPath = path.join(ASSETS_DIR, sanitizedUsername, type, serverFilename);
            try { await fs.access(potentialPath); currentPath = potentialPath; fileType = type; break; }
            catch (e) { if (e.code !== 'ENOENT') throw e; }
        }
        if (!currentPath) return res.status(404).json({ message: 'File not found or access denied.' });

        // Construct new path
        const newExt = path.extname(newOriginalName) || parsedOld.extension; // Preserve original ext if new one is missing
        const newBaseName = path.basename(newOriginalName, path.extname(newOriginalName)); // Get base name without extension
        const sanitizedNewBase = newBaseName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize only the base name
        const finalNewOriginalName = `${sanitizedNewBase}${newExt}`; // Reconstruct original name
        const newServerFilename = `${parsedOld.timestamp}-${finalNewOriginalName}`; // Keep timestamp, use sanitized original name
        const newPath = path.join(ASSETS_DIR, sanitizedUsername, fileType, newServerFilename);

        // Perform rename
        await fs.rename(currentPath, newPath);

        res.status(200).json({
            message: 'File renamed successfully!', oldFilename: serverFilename,
            newFilename: newServerFilename, newOriginalName: finalNewOriginalName,
        });

    } catch (error) {
        console.error(`!!! Error in PATCH /api/files/${serverFilename} for user ${sanitizedUsername}:`, error);
        res.status(500).json({ message: 'Failed to rename the file.' });
    }
});


// --- @route   DELETE /api/files/:serverFilename ---
// Use tempAuth middleware
router.delete('/:serverFilename', tempAuth, async (req, res) => {
    const { serverFilename } = req.params;
    const sanitizedUsername = sanitizeUsernameForDir(req.user.username); // req.user set by tempAuth

    // Validations
    if (!sanitizedUsername) return res.status(400).json({ message: 'Invalid user identifier.' });
    if (!serverFilename) return res.status(400).json({ message: 'Server filename parameter is required.' });

    try {
        // Find current path
        let currentPath = null; let fileType = '';
        const fileTypesToSearch = ['docs', 'images', 'code', 'others'];
        for (const type of fileTypesToSearch) {
            const potentialPath = path.join(ASSETS_DIR, sanitizedUsername, type, serverFilename);
            try { await fs.access(potentialPath); currentPath = potentialPath; fileType = type; break; }
            catch (e) { if (e.code !== 'ENOENT') throw e; }
        }
        if (!currentPath) return res.status(404).json({ message: 'File not found or access denied.' });

        // Determine backup path
        const backupUserDir = path.join(BACKUP_DIR, sanitizedUsername, fileType);
        await ensureDirExists(backupUserDir);
        const backupPath = path.join(backupUserDir, serverFilename);

        // Perform move
        await fs.rename(currentPath, backupPath);

        res.status(200).json({ message: 'File deleted successfully (moved to backup).', filename: serverFilename });

    } catch (error) {
        console.error(`!!! Error in DELETE /api/files/${serverFilename} for user ${sanitizedUsername}:`, error);
        res.status(500).json({ message: 'Failed to delete the file.' });
    }
});

module.exports = router;
