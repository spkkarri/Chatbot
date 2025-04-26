const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false, // Explicitly prevent password from being returned by default
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Password hashing middleware before saving
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare entered password with hashed password
// Ensure we fetch the password field when needed for comparison
UserSchema.methods.comparePassword = async function (candidatePassword) {
  // 'this.password' might be undefined due to 'select: false'
  // Fetch the user again including the password if needed, or ensure the calling context selects it
  // However, bcrypt.compare handles the comparison securely.
  // We assume 'this.password' is available in the context where comparePassword is called.
  if (!this.password) {
      // This scenario should be handled by the calling code (e.g., findOne().select('+password'))
      // Or by using a static method like findByCredentials
      console.error("Attempted to compare password, but password field was not loaded on the User object."); // Added more specific log
      throw new Error("Password field not available for comparison.");
  }
  // Use bcryptjs's compare function
  return await bcrypt.compare(candidatePassword, this.password);
};

// Ensure password is selected when finding user for login comparison
UserSchema.statics.findByCredentials = async function(username, password) {
    // Find user by username AND explicitly select the password field
    const user = await this.findOne({ username }).select('+password');
    if (!user) {
        console.log(`findByCredentials: User not found for username: ${username}`); // Debug log
        return null; // User not found
    }
    // Now 'user' object has the password field, safe to call comparePassword
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        console.log(`findByCredentials: Password mismatch for username: ${username}`); // Debug log
        return null; // Password doesn't match
    }
    console.log(`findByCredentials: Credentials match for username: ${username}`); // Debug log
    // Return user object (password will still be selected here, but won't be sent in JSON response usually)
    return user;
};


const User = mongoose.model('User', UserSchema);

module.exports = User;
