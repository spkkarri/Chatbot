// server/utils/logger.js
const winston = require('winston');
const path = require('path');

const logFilePath = path.join(__dirname, '..', 'logs', 'nodejs-backend.log');

const unifiedLogFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
        const logObject = {
            '@timestamp': timestamp,
            'log.level': level,
            'service.name': 'ai-tutor-nodejs-backend',
            message,
        };

        if (stack) {
            logObject.error = { stack_trace: stack };
        }
        
        if (Object.keys(metadata).length > 0) {
            delete metadata.service; 
            logObject.payload = JSON.stringify(metadata);
        }

        return JSON.stringify(logObject);
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: unifiedLogFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: logFilePath,
            maxsize: 5242880,
            maxFiles: 5,
        })
    ],
    exitOnError: false
});


/**
 * Creates a standardized audit log for a user-initiated event.
 * @param {object} req - The Express request object, used to get user info and IP.
 * @param {string} eventType - A standardized, uppercase_snake_case string for the event (e.g., 'USER_LOGIN_SUCCESS').
 * @param {object} payload - A JSON object with specific details about the event.
 */
function auditLog(req, eventType, payload) {
  // Gracefully handle system events where req.user might not exist
  console.log(`--- AUDIT LOG CALLED: ${eventType} ---`);
  const userId = req.user?._id?.toString() || 'SYSTEM';
  const username = req.user?.email || 'N/A';
  
  // Use the existing Winston logger to ensure consistent format
  logger.info(`User Event: ${eventType}`, {
    eventType,
    userId,
    username,
    ip: req.ip, // Capture the user's IP address for security auditing
    payload
  });
}

module.exports = { logger, auditLog };