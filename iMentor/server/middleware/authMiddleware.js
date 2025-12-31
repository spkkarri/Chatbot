// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        logger.warn("Auth Middleware: No Authorization header found.", { url: req.originalUrl });
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        logger.warn("Auth Middleware: Token format is invalid", { authHeader: authHeader });
        return res.status(401).json({ message: 'Token format is invalid' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            logger.warn(`Auth Middleware: User not found for ID from token.`, { userId: decoded.userId });
            return res.status(401).json({ message: 'User not found, token invalid' });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.warn("Auth Middleware: Token verification failed.", {
            errorMessage: error.message,
            errorName: error.name
        });
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        res.status(401).json({ message: 'Not authorized, token verification failed' });
    }
};

module.exports = { authMiddleware }; // ONLY export this