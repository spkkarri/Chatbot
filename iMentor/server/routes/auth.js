// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { auditLog } = require('../utils/logger');
require('dotenv').config();
const otpGenerator = require('otp-generator');
const { sendOtpEmail, isEmailServiceConfigured } = require('../services/emailService');
const bcrypt = require('bcryptjs');

const router = express.Router();
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

router.post('/signup', async (req, res) => {
    const {
        email, otp,
        name, college, universityNumber, degreeType, branch, year,
        learningStyle, currentGoals,
        apiKey, ollamaUrl, preferredLlmProvider, requestKeyFromAdmin
    } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required to complete signup.' });
    }
    if (!name || !college || !universityNumber || !degreeType || !branch || !year || !learningStyle) {
        return res.status(400).json({ message: 'All profile fields must be completed.' });
    }

    try {
        const user = await User.findOne({ email }).select('+otp +otpExpires');
        if (!user) {
            return res.status(404).json({ message: 'Signup process not started for this email. Please try again.' });
        }
        if (user.otp !== otp || user.otpExpires < new Date()) {
            auditLog(req, 'USER_SIGNUP_FAILURE', { email, reason: 'Invalid or expired OTP' });
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        user.profile = { name, college, universityNumber, degreeType, branch, year, learningStyle, currentGoals: currentGoals || '' };
        user.preferredLlmProvider = preferredLlmProvider || 'gemini';
        user.apiKeyRequestStatus = requestKeyFromAdmin ? 'pending' : 'none';
        user.encryptedApiKey = requestKeyFromAdmin ? null : (preferredLlmProvider === 'gemini' ? apiKey : null);
        user.ollamaUrl = (preferredLlmProvider === 'ollama') ? (ollamaUrl || '').trim() : '';
        user.hasCompletedOnboarding = false;
        user.otp = undefined;
        user.otpExpires = undefined;

        await user.save();
        auditLog(req, 'USER_SIGNUP_SUCCESS', { email: user.email, userId: user._id.toString() });

        const payload = { userId: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        res.status(201).json({
            token,
            _id: user._id,
            email: user.email,
            username: user.username,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            message: "User registered successfully",
        });

    } catch (error) {
        console.error('Finalize Signup Error:', error);
        res.status(500).json({ message: 'Server error during signup finalization.' });
    }
});

router.post('/send-otp', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email) || !password || password.length < 6) {
        return res.status(400).json({ message: 'A valid email and a password of at least 6 characters are required.' });
    }

    try {
        // <<< THIS IS THE FIX >>>
        // Perform a single, definitive check for an existing user at the very beginning.
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        // <<< END OF FIX >>>

        // If the code reaches here, the user is guaranteed to be new.
        // Now, we can safely proceed with the conditional OTP logic.

        if (isEmailServiceConfigured()) {
            // BEHAVIOR 1: Email is configured correctly -> Send OTP
            console.log(`[Auth Route] Email service is configured. Sending OTP to ${email}.`);
            const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
            const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await User.findOneAndUpdate(
                { email },
                {
                    email,
                    password: hashedPassword,
                    username: email.split('@')[0] + uuidv4().substring(0, 4),
                    otp,
                    otpExpires,
                    hasCompletedOnboarding: false,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            await sendOtpEmail(email, otp);
            auditLog(req, 'USER_OTP_SENT', { email });
            res.status(200).json({ message: 'Verification OTP sent to your email.' });
        } else {
            // BEHAVIOR 2: Email is NOT configured -> Create user directly and log them in
            console.warn(`[Auth Route] Bypassing OTP for ${email} because email service is not configured correctly.`);
            
            const newUser = new User({
                email,
                password, // The pre-save hook in User.js model will hash this
                username: email.split('@')[0] + uuidv4().substring(0, 4),
                hasCompletedOnboarding: false,
                apiKeyRequestStatus: 'none',
            });

            await newUser.save();
            auditLog(req, 'USER_SIGNUP_DIRECT_SUCCESS', { email: newUser.email, userId: newUser._id.toString() });

            // Immediately create a token and log the user in
            const payload = { userId: newUser._id, email: newUser.email, username: newUser.username, isAdmin: false };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

            res.status(201).json({
                token,
                _id: newUser._id,
                email: newUser.email,
                username: newUser.username,
                hasCompletedOnboarding: newUser.hasCompletedOnboarding,
                message: "Account created successfully. OTP step was skipped due to server configuration.",
            });
        }
    } catch (error) {
        console.error('Send OTP / Direct Signup Error:', error);
        res.status(500).json({ message: error.message || 'Server error during the initial signup step.' });
    }
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            auditLog(req, 'LOGIN_FAILURE', { email: email, reason: 'User not found' });
            return res.status(401).json({ message: 'Invalid email address or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            auditLog(req, 'LOGIN_FAILURE', { email: email, reason: 'Invalid password' });
            return res.status(401).json({ message: 'Invalid email address or password.' });
        }

        if (user.isAdmin) {
            auditLog(req, 'ADMIN_LOGIN_SUCCESS', { email: user.email });
            const payload = { userId: user._id, email: user.email, isAdmin: true };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });
            return res.status(200).json({ isAdminLogin: true, token: token, message: 'Admin login successful' });
        }
        
        auditLog(req, 'USER_LOGIN_SUCCESS', { email: user.email });
        const payload = { userId: user._id, email: user.email, isAdmin: false };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        res.status(200).json({
            token,
            _id: user._id,
            email: user.email,
            username: user.username,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            message: "Login successful",
        });
    } catch (error) {
        console.error('Signin Error:', error);
        res.status(500).json({ message: 'Server error during signin.' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized.' });
    }
    res.status(200).json({
        _id: req.user._id,
        email: req.user.email,
        username: req.user.username,
        hasCompletedOnboarding: req.user.hasCompletedOnboarding
    });
});

router.post('/complete-onboarding', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        user.hasCompletedOnboarding = true;
        await user.save();
        res.status(200).json({ message: 'Onboarding marked as complete.' });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;