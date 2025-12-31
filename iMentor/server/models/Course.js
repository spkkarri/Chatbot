// server/models/Course.js
const mongoose = require('mongoose');

const LectureSchema = new mongoose.Schema({
  lectureNumber: { type: String, required: true }, // e.g., "1.1" or "Week 1"
  title: { type: String, required: true },
  scheduleDate: { type: Date },
  // This links the lecture to a specific document uploaded by the admin
  documentSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminDocument', default: null }
}, { _id: true, timestamps: true });

const CurriculumModuleSchema = new mongoose.Schema({
  moduleNumber: { type: String, required: true }, // e.g., "Module 1"
  title: { type: String, required: true },
  lectures: [LectureSchema]
}, { _id: true });

const CourseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, unique: true, index: true }, // e.g., "EE301"
  title: { type: String, required: true },
  description: { type: String },
  syllabus: { type: String, default: '# Syllabus\n\n*Coming soon...*' }, // The full syllabus in Markdown
  modules: [CurriculumModuleSchema],
  createdBy: { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);
