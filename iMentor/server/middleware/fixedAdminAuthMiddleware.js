// server/middleware/fixedAdminAuthMiddleware.js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') }); // Ensure .env from server directory is loaded
const { auditLog } = require('../utils/logger');

const ADMIN_USERNAME = process.env.FIXED_ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.FIXED_ADMIN_PASSWORD

const fixedAdminAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        console.error("FATAL: FIXED_ADMIN_USERNAME or FIXED_ADMIN_PASSWORD not set in environment for admin auth.");
        // Do not send WWW-Authenticate here as it's a server config issue
        return res.status(500).json({ message: "Admin authentication system not configured properly." });
    }

    if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) {
        // Prompt for Basic Authentication
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Document Area"');
        return res.status(401).json({ message: 'Admin authentication required (Basic Auth).' });
    }

    const encodedCreds = authHeader.substring(6); // Length of "Basic "
    let decodedCreds;
    try {
        decodedCreds = Buffer.from(encodedCreds, 'base64').toString('utf8');
    } catch (e) {
        console.warn("Admin Auth: Invalid Base64 encoding in Basic Auth header.");
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Document Area"'); // Re-prompt
        return res.status(400).json({ message: 'Invalid Basic Auth encoding format.' });
    }

    const [username, password] = decodedCreds.split(':', 2); // Split into max 2 parts

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.adminUser = { 
            username: ADMIN_USERNAME, 
            id: "fixed_admin_id_marker"
        }; 
        return next(); // Authentication successful, proceed.
    }

    // Authentication failed
    console.warn(`Admin Auth Failed: Incorrect credentials received. Username: ${username}`);
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Document Area"'); // Re-prompt
    return res.status(401).json({ message: 'Invalid admin credentials.' });
};

module.exports = { fixedAdminAuthMiddleware };