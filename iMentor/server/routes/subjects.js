// server/routes/subjects.js
const express = require('express');
const router = express.Router();
const AdminDocument = require('../models/AdminDocument'); // Model for admin-uploaded documents

// @route   GET /api/subjects
// @desc    Get a list of available subject names (derived from admin-uploaded document originalNames)
// @access  Private (Regular User Authenticated via JWT)
router.get('/', async (req, res) => {
    // req.user is available here from authMiddleware
    console.log(`User ${req.user.username} is requesting the list of subjects.`);
    try {
        // Fetch distinct originalName values from the AdminDocument collection
        // and sort them alphabetically.
        const subjectObjects = await AdminDocument.find().sort({ originalName: 1 }).select('originalName').lean();
        const subjectNames = subjectObjects.map(doc => doc.originalName);
        
        // Alternative using distinct, but sorting might be different or need post-processing
        // const subjectNames = await AdminDocument.distinct('originalName').exec();
        // subjectNames.sort((a, b) => a.localeCompare(b));


        res.json({ subjects: subjectNames }); // Send as { subjects: ["Subject 1", "Subject 2", ...] }
    } catch (error) {
        console.error("Error fetching subjects for user display:", error);
        res.status(500).json({ message: "Server error while fetching available subjects." });
    }
});

module.exports = router;