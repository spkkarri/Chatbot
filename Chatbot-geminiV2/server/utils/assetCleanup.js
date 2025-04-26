const fs = require('fs').promises; // Use fs.promises for async operations
const path = require('path');

// Define constants relative to this file's location (server/utils)
const ASSETS_DIR = path.join(__dirname, '..', 'assets'); // Go up one level to server/assets
const BACKUP_DIR = path.join(__dirname, '..', 'backup_assets'); // Go up one level to server/backup_assets
const FOLDER_TYPES = ['docs', 'images', 'code', 'others']; // Folders within each user's asset dir

/**
 * Moves existing user asset folders (docs, images, code, others) to a timestamped
 * backup location and recreates empty asset folders for each user on server startup.
 */
async function performAssetCleanup() {
    console.log("\n--- Starting Asset Cleanup ---");
    try {
        // Ensure backup base directory exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // List potential user directories in assets
        let userDirs = [];
        try {
            userDirs = await fs.readdir(ASSETS_DIR);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log("Assets directory doesn't exist yet, creating it and skipping cleanup.");
                await fs.mkdir(ASSETS_DIR, { recursive: true }); // Ensure assets dir exists
                console.log("--- Finished Asset Cleanup (No existing assets found) ---");
                return; // Nothing to clean up
            }
            throw err; // Re-throw other errors accessing assets dir
        }

        if (userDirs.length === 0) {
             console.log("Assets directory is empty. Skipping backup/move operations.");
             console.log("--- Finished Asset Cleanup (No user assets found) ---");
             return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Create a safe timestamp string

        for (const userName of userDirs) {
            const userAssetPath = path.join(ASSETS_DIR, userName);
            const userBackupPathBase = path.join(BACKUP_DIR, userName);
            const userTimestampBackupPath = path.join(userBackupPathBase, `backup_${timestamp}`);

            try {
                // Check if the item in assets is actually a directory
                const stats = await fs.stat(userAssetPath);
                if (!stats.isDirectory()) {
                    console.log(`  Skipping non-directory item in assets: ${userName}`);
                    continue;
                }

                console.log(`  Processing assets for user: [${userName}]`);
                let backupDirCreated = false; // Track if backup dir was created for this user/run
                let movedSomething = false; // Track if anything was actually moved

                // Process each defined folder type (docs, images, etc.)
                for (const type of FOLDER_TYPES) {
                    const sourceTypePath = path.join(userAssetPath, type);
                    try {
                        // Check if the source type directory exists before trying to move
                        await fs.access(sourceTypePath);

                        // If source exists, ensure the timestamped backup directory is ready
                        if (!backupDirCreated) {
                            await fs.mkdir(userTimestampBackupPath, { recursive: true });
                            backupDirCreated = true;
                            // console.log(`    Created backup directory: ${userTimestampBackupPath}`);
                        }

                        // Define the destination path in the backup folder
                        const backupTypePath = path.join(userTimestampBackupPath, type);
                        // console.log(`    Moving ${sourceTypePath} to ${backupTypePath}`);
                        // Move the existing type folder to the backup location
                        await fs.rename(sourceTypePath, backupTypePath);
                        movedSomething = true;

                    } catch (accessErr) {
                        // Ignore error if the source directory doesn't exist (ENOENT)
                        if (accessErr.code !== 'ENOENT') {
                            console.error(`    Error accessing source folder ${sourceTypePath}:`, accessErr.message);
                        }
                        // If ENOENT, the folder doesn't exist, nothing to move.
                    }

                    // Always ensure the empty type directory exists in the main assets folder
                    try {
                        // console.log(`    Ensuring empty directory: ${sourceTypePath}`);
                        await fs.mkdir(sourceTypePath, { recursive: true });
                    } catch (mkdirErr) {
                         console.error(`    Failed to recreate directory ${sourceTypePath}:`, mkdirErr.message);
                    }
                } // End loop through FOLDER_TYPES

                 if (movedSomething) {
                     console.log(`  Finished backup for user [${userName}] to backup_${timestamp}`);
                 } else {
                     console.log(`  No existing asset types found to backup for user [${userName}]`);
                 }


            } catch (userDirStatErr) {
                 // Error checking if the item in assets is a directory
                 console.error(`Error processing potential user asset directory ${userAssetPath}:`, userDirStatErr.message);
            }
        } // End loop through userDirs

        console.log("--- Finished Asset Cleanup ---");

    } catch (error) {
        // Catch errors related to backup dir creation or reading the main assets dir
        console.error("!!! Critical Error during Asset Cleanup process:", error);
    }
}

// Export the function to be used elsewhere
module.exports = { performAssetCleanup };
