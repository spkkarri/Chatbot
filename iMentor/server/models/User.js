// server/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { encrypt } = require("../utils/crypto");

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    college: { type: String, default: "", trim: true },
    universityNumber: { type: String, default: "", trim: true },
    degreeType: { type: String, default: "", trim: true },
    branch: { type: String, default: "", trim: true },
    year: { type: String, default: "", trim: true },
    learningStyle: {
      type: String,
      enum: ['Not Specified', 'Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'],
      default: 'Not Specified'
    },
    currentGoals: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    performanceMetrics: {
      type: Map,
      of: Number,
      default: () => new Map()
    }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email address",
    ],
  },
  username: {
    type: String,
    required: [true, "A unique username is required"],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 6,
    select: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  profile: {
    type: ProfileSchema,
    default: () => ({}),
  },
  hasCompletedOnboarding: {
      type: Boolean,
      default: false
  },
  apiKeyRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },
  encryptedApiKey: {
    type: String,
    select: false,
  },
  preferredLlmProvider: {
    type: String,
    enum: ["gemini", "ollama"],
    default: "gemini",
  },
  ollamaUrl: {
    type: String,
    trim: true,
    default: "",
  },
  ollamaModel: {
    type: String,
    default: process.env.OLLAMA_DEFAULT_MODEL || "qwen2.5:14b-instruct",
  },
  learningPaths: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LearningPath' 
  }],
  otp: {
    type: String,
    select: false,
  },
  otpExpires: {
    type: Date,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.pre("save", async function (next) {
  // Hash password if it's been modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Encrypt API key only if it's a new, non-empty value.
  // This prevents re-encrypting an already encrypted key on other user updates.
  if (this.isModified("encryptedApiKey")) {
    if (this.encryptedApiKey) {
        try {
            // We only encrypt if it's not already in the encrypted format (containing ':')
            if (!this.encryptedApiKey.includes(':')) {
                this.encryptedApiKey = encrypt(this.encryptedApiKey);
            }
        } catch (encError) {
            console.error("Error encrypting API key during user save:", encError);
            return next(new Error("Failed to encrypt API key."));
        }
    } else {
        // If the key is explicitly set to null/empty, ensure it's saved as null.
        this.encryptedApiKey = null;
    }
  }
  
  next();
});


UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email }).select("+password");
  if (!user) {
    return null;
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return null;
  }
  return user;
};

const User = mongoose.model("User", UserSchema);
module.exports = User;
