// server/routes/analysis.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const KnowledgeSource = require('../models/KnowledgeSource');
const AdminDocument = require('../models/AdminDocument');

// @route   GET /api/analysis/:documentFilename
// @desc    Get analysis data for a user's knowledge source or an admin subject
// @access  Private
router.get('/:documentFilename', authMiddleware, async (req, res) => {
    const userId = req.user._id;
    const { documentFilename } = req.params;

    console.log(`[Analysis Route] ==> Request for analysis of '${documentFilename}' by User ${userId}`);

    if (!documentFilename) {
        return res.status(400).json({ message: 'Document filename parameter is required.' });
    }

    try {
        let sourceDocument = null;

        // 1. Check user-specific KnowledgeSource by its title
        sourceDocument = await KnowledgeSource.findOne({ userId, title: documentFilename }).select('analysis').lean();
        if (sourceDocument) console.log(`[Analysis Route] Found document in user's KnowledgeSources.`);
        
        // 2. If not found, fallback to AdminDocument (Subjects) by its originalName
        if (!sourceDocument) {
            console.log(`[Analysis Route] Document not in user's sources. Checking Admin Subjects.`);
            sourceDocument = await AdminDocument.findOne({ originalName: documentFilename }).select('analysis').lean();
            if (sourceDocument) console.log(`[Analysis Route] Found document in Admin Subjects.`);
        }

        if (!sourceDocument) {
            console.warn(`[Analysis Route] <== Document or Subject '${documentFilename}' not found.`);
            return res.status(404).json({ message: `Document or Subject '${documentFilename}' not found.` });
        }
        
        // Send the analysis sub-document, ensuring it's an object even if empty
        console.log(`[Analysis Route] <== Successfully returned analysis for '${documentFilename}'.`);
        res.status(200).json(sourceDocument.analysis || { faq: "", topics: "", mindmap: "" });

    } catch (error) {
        console.error(`[Analysis Route] Error fetching analysis for '${documentFilename}':`, error);
        res.status(500).json({ message: 'Server error while retrieving document analysis.' });
    }
});

module.exports = router;