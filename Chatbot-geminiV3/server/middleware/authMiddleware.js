// server/middleware/authMiddleware.js
const User = require('../models/User');

// TEMPORARY Authentication Middleware (INSECURE - for debugging only)
// Checks for 'X-User-ID' header and attaches user to req.user
const tempAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id']; // Read custom header (lowercase)

    // console.log("TempAuth Middleware: Checking for X-User-ID:", userId); // Debug log

    if (!userId) {
        console.warn("TempAuth Middleware: Missing X-User-ID header.");
        // Send 401 immediately if header is missing
        return res.status(401).json({ message: 'Unauthorized: Missing User ID header' });
    }

    try {
        // Find user by the ID provided in the header
        // Ensure Mongoose is connected before this runs (handled by server.js)
        const user = await User.findById(userId).select('-password'); // Exclude password

        if (!user) {
            console.warn(`TempAuth Middleware: User not found for ID: ${userId}`);
            // Send 401 if user ID is provided but not found in DB
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        // Attach user object to the request
        req.user = user;
        // console.log("TempAuth Middleware: User attached:", req.user.username); // Debug log
        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        console.error('TempAuth Middleware: Error fetching user:', error);
        // Handle potential invalid ObjectId format errors
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Bad Request: Invalid User ID format' });
        }
        // Send 500 for other unexpected errors during auth check
        res.status(500).json({ message: 'Server error during temporary authentication' });
    }
};

// Export the temporary middleware
module.exports = { tempAuth };
