// server/routes/courseAdmin.js
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const AdminDocument = require('../models/AdminDocument');

// GET all courses
router.get('/', async (req, res) => {
    console.log('[Admin Course Route] ==> GET /api/admin/courses - Fetching all courses.');
    try {
        const courses = await Course.find().sort({ courseCode: 1 });
        res.json(courses);
    } catch (error) {
        console.error('[Admin Course Route] <== Error fetching courses:', error);
        res.status(500).json({ message: 'Server error fetching courses.' });
    }
});

// POST a new course
router.post('/', async (req, res) => {
    console.log('[Admin Course Route] ==> POST /api/admin/courses - Creating new course with data:', req.body);
    try {
        const { courseCode, title } = req.body;
        if (!courseCode || !title) {
            console.warn('[Admin Course Route] <== Validation failed: Missing courseCode or title.');
            return res.status(400).json({ message: 'Course Code and Title are required.' });
        }
        const newCourse = new Course({ courseCode, title, description: req.body.description || '', syllabus: req.body.syllabus || '', modules: req.body.modules || [] });
        await newCourse.save();
        console.log(`[Admin Course Route] <== Successfully created course: ${newCourse.courseCode}`);
        res.status(201).json(newCourse);
    } catch (error) {
        console.error('[Admin Course Route] <== Error creating course:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A course with this code already exists.' });
        }
        res.status(500).json({ message: 'Server error creating course.' });
    }
});

// GET a single course by ID
router.get('/:id', async (req, res) => {
    console.log(`[Admin Course Route] ==> GET /api/admin/courses/${req.params.id} - Fetching course by ID.`);
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            console.warn(`[Admin Course Route] <== Course with ID ${req.params.id} not found.`);
            return res.status(404).json({ message: 'Course not found.' });
        }
        res.json(course);
    } catch (error) {
        console.error(`[Admin Course Route] <== Error fetching course ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error fetching course details.' });
    }
});

// PUT (update) a course
router.put('/:id', async (req, res) => {
    console.log(`[Admin Course Route] ==> PUT /api/admin/courses/${req.params.id} - Updating course.`);
    try {
        const { courseCode, title, description, syllabus, modules } = req.body;
        const course = await Course.findByIdAndUpdate(
            req.params.id,
            { courseCode, title, description, syllabus, modules },
            { new: true, runValidators: true }
        );
        if (!course) {
            console.warn(`[Admin Course Route] <== Course with ID ${req.params.id} not found for update.`);
            return res.status(404).json({ message: 'Course not found.' });
        }
        console.log(`[Admin Course Route] <== Successfully updated course: ${course.courseCode}`);
        res.json(course);
    } catch (error) {
        console.error(`[Admin Course Route] <== Error updating course ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error updating course.' });
    }
});

// DELETE a course
router.delete('/:id', async (req, res) => {
    console.log(`[Admin Course Route] ==> DELETE /api/admin/courses/${req.params.id} - Deleting course.`);
    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (!course) {
            console.warn(`[Admin Course Route] <== Course with ID ${req.params.id} not found for deletion.`);
            return res.status(404).json({ message: 'Course not found.' });
        }
        console.log(`[Admin Course Route] <== Successfully deleted course: ${course.courseCode}`);
        res.json({ message: 'Course deleted successfully.' });
    } catch (error) {
        console.error(`[Admin Course Route] <== Error deleting course ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error deleting course.' });
    }
});

module.exports = router;
