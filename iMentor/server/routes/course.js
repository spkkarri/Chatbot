// server/routes/course.js
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

// GET /api/courses/search?code=EE301
router.get('/search', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ message: 'Course code is required.' });
    }
    try {
        const course = await Course.findOne({ courseCode: { $regex: new RegExp(`^${code}$`, 'i') } });
        if (!course) {
            return res.status(404).json({ message: `Course with code '${code}' not found.` });
        }
        res.json(course);
    } catch (error) {
        res.status(500).json({ message: 'Server error searching for course.' });
    }
});

module.exports = router;
