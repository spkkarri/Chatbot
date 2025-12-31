// server/services/s3Service.js
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const S3_BUCKET = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Configure the AWS SDK
AWS.config.update({
    region: AWS_REGION,
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3({
    signatureVersion: 'v4',
});

async function getSignedUploadUrl(fileName, fileType) {
    const key = `datasets/${uuidv4()}-${fileName}`;

    const params = {
        Bucket: S3_BUCKET,
        Key: key,
        Expires: 120, // URL expires in 2 minutes
        ContentType: fileType,
    };

    const url = await s3.getSignedUrlPromise('putObject', params);
    return { url, key };
}

async function getSignedDownloadUrl(key, originalName) {
    const params = {
        Bucket: S3_BUCKET,
        Key: key,
        Expires: 120, // URL expires in 2 minutes
        ResponseContentDisposition: `attachment; filename="${originalName}"`, // Prompts download with original filename
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
}

// <<< NEW FUNCTION START >>>
async function deleteObjectFromS3(key) {
    const params = {
        Bucket: S3_BUCKET,
        Key: key,
    };

    try {
        await s3.deleteObject(params).promise();
        console.log(`[S3 Service] Successfully deleted object with key: ${key}`);
        return { success: true };
    } catch (error) {
        console.error(`[S3 Service] Error deleting object with key ${key}:`, error);
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
}
// <<< NEW FUNCTION END >>>

module.exports = {
    getSignedUploadUrl,
    getSignedDownloadUrl,
    deleteObjectFromS3, // <<< EXPORT THE NEW FUNCTION
};
