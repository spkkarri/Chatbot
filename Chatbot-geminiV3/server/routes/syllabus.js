// server/routes/syllabus.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware'); // Protect the route

const router = express.Router();
const SYLLABI_DIR = path.join(__dirname, '..', 'syllabi');

// --- @route   GET /api/syllabus/:subjectId ---
// --- @desc    Get syllabus content for a specific subject ---
// --- @access  Private (requires auth) ---
router.get('/:subjectId', tempAuth, async (req, res) => {
    const { subjectId } = req.params;

    // Basic sanitization: Allow only alphanumeric and underscores
    // Prevents directory traversal (e.g., ../../etc/passwd)
    const sanitizedSubjectId = subjectId.replace(/[^a-zA-Z0-9_]/g, '');

    if (!sanitizedSubjectId || sanitizedSubjectId !== subjectId) {
        console.warn(`Syllabus request rejected due to invalid characters: ${subjectId}`);
        return res.status(400).json({ message: 'Invalid subject identifier format.' });
    }

    const filePath = path.join(SYLLABI_DIR, `${sanitizedSubjectId}.md`);

    try {
        // Check if file exists first (more specific error)
        await fs.access(filePath);

        // Read the file content
        const content = await fs.readFile(filePath, 'utf-8');

        res.status(200).json({ syllabus: content });

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Syllabus file not found: ${filePath}`);
            return res.status(404).json({ message: `Syllabus for '${subjectId}' not found.` });
        } else {
            console.error(`Error reading syllabus file ${filePath}:`, error);
            return res.status(500).json({ message: 'Server error retrieving syllabus.' });
        }
    }
});

module.exports = router;
