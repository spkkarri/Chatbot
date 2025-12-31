// server/scripts/setupAdmin.js
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function createNewAdmin() {
    console.log('\x1b[33m[Admin Setup] Starting admin creation process...\x1b[0m');
    
    const email = await question('Enter new admin email: ');
    const password = await question('Enter new admin password (min 6 characters): ');
    const username = await question('Enter new admin username: ');

    if (!email || !password || !username || password.length < 6) {
        throw new Error('Invalid input. Email, username, and a password of at least 6 characters are required.');
    }

    const newAdmin = new User({
        email,
        password,
        username,
        isAdmin: true,
        hasCompletedOnboarding: true,
        apiKeyRequestStatus: 'approved',
    });

    await newAdmin.save();
    console.log(`\x1b[32m[Admin Setup] Admin user '${email}' created successfully!\x1b[0m`);
}

async function modifyExistingAdmin(adminUser) {
    console.log(`\x1b[33m[Admin Setup] Starting modification for admin: ${adminUser.email}\x1b[0m`);
    
    const newEmail = await question(`Enter new email (or press Enter to keep '${adminUser.email}'): `);
    if (newEmail.trim()) adminUser.email = newEmail.trim();

    const newUsername = await question(`Enter new username (or press Enter to keep '${adminUser.username}'): `);
    if (newUsername.trim()) adminUser.username = newUsername.trim();

    const newPassword = await question('Enter new password (or press Enter to keep unchanged): ');
    if (newPassword.trim()) {
        if (newPassword.trim().length < 6) {
            throw new Error('New password must be at least 6 characters long.');
        }
        adminUser.password = newPassword.trim();
    }
    
    await adminUser.save();
    console.log(`\x1b[32m[Admin Setup] Admin user '${adminUser.email}' updated successfully!\x1b[0m`);
}

async function setupAdmin(mongoUri) {
    if (!mongoUri) {
        console.error('\x1b[31m[Admin Setup] MONGO_URI is not defined. Cannot proceed.\x1b[0m');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('\x1b[32m[Admin Setup] MongoDB connected for admin check.\x1b[0m');

        const adminUser = await User.findOne({ isAdmin: true }).select('+password');

        if (!adminUser) {
            await createNewAdmin();
        } else {
            console.log(`\x1b[32m[Admin Setup] Admin user '${adminUser.email}' already exists.\x1b[0m`);
            const modify = await question('Do you want to modify the admin credentials? (y/N): ');
            
            if (modify.toLowerCase() === 'y') {
                await modifyExistingAdmin(adminUser);
            } else {
                console.log('\x1b[32m[Admin Setup] Skipping modification.\x1b[0m');
            }
        }

    } catch (error) {
        console.error('\x1b[31m[Admin Setup] An error occurred:', error.message, '\x1b[0m');
        process.exit(1);
    } finally {
        rl.close();
        await mongoose.disconnect();
        console.log('\x1b[32m[Admin Setup] MongoDB connection closed.\x1b[0m');
    }
}

module.exports = { setupAdmin };