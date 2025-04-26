// server/routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // For generating session IDs
const User = require('../models/User'); // Mongoose User model
require('dotenv').config();

const router = express.Router();

// --- @route   POST /api/auth/signup ---
// --- @desc    Register a new user ---
// --- @access  Public ---
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }
  if (password.length < 6) {
     return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new user (password hashing is handled by pre-save middleware in User model)
    const newUser = new User({ username, password });
    await newUser.save();

    // Generate a new session ID for the first login
    const sessionId = uuidv4();

    // Respond with user info (excluding password), and session ID
    // Note: Mongoose excludes 'select: false' fields by default after save() too
    res.status(201).json({
      _id: newUser._id, // Send user ID
      username: newUser.username,
      sessionId: sessionId, // Send session ID on successful signup/login
      message: 'User registered successfully',
    });

  } catch (error) {
    console.error('Signup Error:', error);
    // Handle potential duplicate key errors more gracefully if needed
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Username already exists.' });
    }
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// --- @route   POST /api/auth/signin ---
// --- @desc    Authenticate user (using custom static method) ---
// --- @access  Public ---
router.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }

  try {
    // *** CHANGE HERE: Use the static method from User model ***
    // This method finds the user AND selects the password field AND compares the password
    const user = await User.findByCredentials(username, password);

    // Check if the method returned a user (means credentials were valid)
    if (!user) {
      // findByCredentials returns null if user not found OR password doesn't match
      return res.status(401).json({ message: 'Invalid credentials' }); // Use generic message
    }

    // User authenticated successfully if we reached here

    // Generate a NEW session ID for this login session
    const sessionId = uuidv4();

    // Respond with user info (excluding password), and session ID
    // Even though 'user' has the password field selected from findByCredentials,
    // Mongoose's .toJSON() or spreading might still exclude it if schema default is select:false.
    // Explicitly create the response object.
    res.status(200).json({
      _id: user._id, // Send user ID
      username: user.username,
      sessionId: sessionId, // Send a *new* session ID on each successful login
      message: 'Login successful',
    });

  } catch (error) {
    // Log the specific error for debugging
    console.error('Signin Error:', error);
    // Check if the error came from the comparePassword method (e.g., bcrypt issue)
    if (error.message === "Password field not available for comparison.") {
        // This shouldn't happen if findByCredentials is used correctly, but good to check
        console.error("Developer Error: Password field was not selected before comparison attempt.");
        return res.status(500).json({ message: 'Internal server configuration error during signin.' });
    }
    res.status(500).json({ message: 'Server error during signin' });
  }
});


module.exports = router;
