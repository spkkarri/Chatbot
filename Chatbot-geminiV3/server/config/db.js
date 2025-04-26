const mongoose = require('mongoose');
// const dotenv = require('dotenv'); // Removed dotenv

// dotenv.config(); // Removed dotenv

// Modified connectDB to accept the URI as an argument
const connectDB = async (mongoUri) => {
  if (!mongoUri) {
      console.error('MongoDB Connection Error: URI is missing.');
      process.exit(1);
  }
  try {
    // console.log(`Attempting MongoDB connection to: ${mongoUri}`); // Debug: Careful logging URI
    const conn = await mongoose.connect(mongoUri, {
      // Mongoose 6+ uses these defaults, so they are not needed
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // serverSelectionTimeoutMS: 5000 // Example: Optional: Timeout faster
    });

    console.log(`✓ MongoDB Connected Successfully`); // Simpler success message
    return conn; // Return connection object if needed elsewhere
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
