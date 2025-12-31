// server/middleware/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuthMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token or invalid format.' });
    }

    const token = authHeader.substring(7); // "Bearer ".length

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // --- THIS IS THE CORE CHANGE ---
        // Check for the isAdmin flag directly from the JWT payload first for efficiency.
        if (decoded.isAdmin !== true) {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
        
        // As a secondary security measure, verify the user still exists and is an admin in the DB.
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Admin user not found or privileges revoked.' });
        }

        req.user = user; // Attach the full user object for potential use in routes
        next();
    } catch (error) {
        console.error('Admin Auth Middleware Error:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        res.status(401).json({ message: 'Not authorized, token failed verification.' });
    }
};

module.exports = { adminAuthMiddleware };