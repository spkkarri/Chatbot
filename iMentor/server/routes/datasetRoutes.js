// server/routes/admin/datasetRoutes.js
const express = require('express');
const router = express.Router();
const Dataset = require('./../models/Dataset');
const { getSignedUploadUrl, getSignedDownloadUrl, deleteObjectFromS3 } = require('./../services/s3Service');

// @route   POST /api/admin/datasets/presigned-url
// @desc    Get a secure, pre-signed URL for uploading a dataset to S3
// @access  Admin
router.post('/presigned-url', async (req, res) => {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) {
        return res.status(400).json({ message: 'fileName and fileType are required.' });
    }

    console.log(`[Dataset Route] ==> Generating presigned URL for: ${fileName}`);
    try {
        const { url, key } = await getSignedUploadUrl(fileName, fileType);
        res.json({ url, key });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ message: 'Failed to generate upload URL.' });
    }
});

// @route   POST /api/admin/datasets/finalize-upload
// @desc    Create the dataset metadata record in MongoDB after successful S3 upload
// @access  Admin
router.post('/finalize-upload', async (req, res) => {
    const { originalName, s3Key, category, version, fileType, size } = req.body;
    if (!originalName || !s3Key || !category) {
        return res.status(400).json({ message: 'Missing required fields to finalize upload.' });
    }

    console.log(`[Dataset Route] ==> Finalizing upload for S3 key: ${s3Key}`);
    try {
        const newDataset = new Dataset({
            originalName, s3Key, category, version, fileType, size
        });
        await newDataset.save();
        res.status(201).json(newDataset);
    } catch (error) {
        console.error('Error finalizing dataset upload:', error);
        res.status(500).json({ message: 'Failed to save dataset metadata.' });
    }
});

// @route   GET /api/admin/datasets
// @desc    Get a list of all uploaded datasets
// @access  Admin
router.get('/', async (req, res) => {
    console.log(`[Dataset Route] ==> Fetching all datasets.`);
    try {
        const datasets = await Dataset.find().sort({ createdAt: -1 });
        res.json(datasets);
    } catch (error) {
        console.error('Error fetching datasets:', error);
        res.status(500).json({ message: 'Failed to fetch datasets.' });
    }
});

// @route   GET /api/admin/datasets/:id/download-url
// @desc    Get a secure, pre-signed URL for downloading a dataset from S3
// @access  Admin
router.get('/:id/download-url', async (req, res) => {
    console.log(`[Dataset Route] ==> Generating download URL for dataset ID: ${req.params.id}`);
    try {
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found.' });
        }
        
        const downloadUrl = await getSignedDownloadUrl(dataset.s3Key);
        res.json({ downloadUrl });
    } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ message: 'Failed to generate download URL.' });
    }
});

// @route   DELETE /api/admin/datasets/:id
// @desc    Delete a dataset from S3 and MongoDB
// @access  Admin
router.delete('/:id', async (req, res) => {
    console.log(`[Dataset Route] ==> Deleting dataset with ID: ${req.params.id}`);
    try {
        // 1. Find the dataset metadata in MongoDB
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found.' });
        }

        // 2. *** NEW VALIDATION STEP ***
        // Check if there is an S3 key before attempting to delete from S3.
        if (dataset.s3Key) {
            console.log(`[Delete Dataset] Deleting object from S3 with key: ${dataset.s3Key}`);
            await deleteObjectFromS3(dataset.s3Key);
        } else {
            console.warn(`[Delete Dataset] s3Key not found for dataset ID ${dataset._id}. Skipping S3 deletion. This is a data cleanup operation.`);
        }

        // 3. If S3 deletion was successful (or skipped), delete the metadata from MongoDB
        await Dataset.findByIdAndDelete(req.params.id);

        res.json({ message: `Dataset '${dataset.originalName}' and its metadata were deleted successfully.` });
    } catch (error) {
        console.error('Error deleting dataset:', error);
        res.status(500).json({ message: 'Server error while deleting dataset.' });
    }
});

module.exports = router;