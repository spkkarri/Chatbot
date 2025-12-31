// server/models/Dataset.js
const mongoose = require('mongoose');

const DatasetSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  s3Key: { // The unique key for the object in the S3 bucket
    type: String,
    required: true,
    unique: true,
  },
  category: {
    type: String,
    required: [true, "Dataset category is required."],
    trim: true,
  },
  version: {
    type: String,
    required: [true, "Dataset version is required."],
    trim: true,
  },
  fileType: { // e.g., 'application/pdf'
    type: String,
    required: true,
  },
  size: { // Size in bytes
    type: Number,
    required: true,
  },
  uploadedBy: {
    type: String, // For now, we'll just store 'admin'
    required: true,
    default: 'admin',
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

DatasetSchema.index({ category: 1, version: 1 });

const Dataset = mongoose.model('Dataset', DatasetSchema);

module.exports = Dataset;