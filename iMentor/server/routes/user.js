// server/routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { redisClient } = require('../config/redisClient');
const { auditLog } = require('../utils/logger');

router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('profile hasCompletedOnboarding');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        const profileData = user.profile ? user.profile.toObject() : {};
        profileData.hasCompletedOnboarding = user.hasCompletedOnboarding;
        
        res.json(profileData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

router.put('/profile', async (req, res) => {
    const { name, college, universityNumber, degreeType, branch, year, learningStyle, currentGoals } = req.body;

    if (!name || !college || !universityNumber || !degreeType || !branch || !year || !learningStyle) {
        return res.status(400).json({ message: 'All profile fields except goals are required.' });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.profile = {
            name,
            college,
            universityNumber,
            degreeType,
            branch,
            year,
            learningStyle,
            currentGoals: currentGoals || ''
        };

        await user.save();
        
        auditLog(req, 'USER_PROFILE_UPDATE_SUCCESS', {
            updatedFields: Object.keys(req.body) // Log which fields were included in the update
        });
        
        if (redisClient && redisClient.isOpen) {
            const cacheKey = `user:${req.user._id}`;
            await redisClient.del(cacheKey);
            console.log(`[Cache Invalidation] Deleted cache for user ${req.user._id} due to profile update.`);
        }
        res.json({
            message: 'Profile updated successfully!',
            profile: user.profile
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

module.exports = router;