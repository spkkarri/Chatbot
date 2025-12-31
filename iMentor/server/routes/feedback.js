// server/routes/feedback.js
const express = require('express');
const router = express.Router();
const LLMPerformanceLog = require('../models/LLMPerformanceLog');

// @route   POST /api/feedback/:logId
// @desc    Submit user feedback for a specific AI response
// @access  Private (authMiddleware is applied in server.js)
router.post('/:logId', async (req, res) => {
    const { logId } = req.params;
    const { feedback } = req.body; // 'positive' or 'negative'
    const userId = req.user._id;

    if (!['positive', 'negative'].includes(feedback)) {
        return res.status(400).json({ message: 'Invalid feedback value.' });
    }

    console.log(`[Feedback Route] ==> Received '${feedback}' feedback for Log ID: ${logId}`);
    try {
        const logEntry = await LLMPerformanceLog.findById(logId);

        // Security check: Ensure the log belongs to the user submitting feedback
        if (!logEntry || logEntry.userId.toString() !== userId.toString()) {
            return res.status(404).json({ message: 'Log entry not found or access denied.' });
        }

        // Update the feedback field
        logEntry.userFeedback = feedback;
        await logEntry.save();

        console.log(`[Feedback Route] <== Successfully saved feedback for Log ID: ${logId}`);
        res.status(200).json({ message: 'Thank you for your feedback!' });
    } catch (error) {
        console.error(`Error saving feedback for log ${logId}:`, error);
        res.status(500).json({ message: 'Server error while saving feedback.' });
    }
});

module.exports = router;