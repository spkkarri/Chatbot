// server/utils/crypto.js
const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

let ENCRYPTION_KEY_BUFFER;
try {
  if (
    !process.env.ENCRYPTION_SECRET ||
    process.env.ENCRYPTION_SECRET.length !== 64
  ) {
    throw new Error(
      "ENCRYPTION_SECRET must be a 64-character hexadecimal string."
    );
  }
  ENCRYPTION_KEY_BUFFER = Buffer.from(process.env.ENCRYPTION_SECRET, "hex");
  if (ENCRYPTION_KEY_BUFFER.length !== 32) {
    throw new Error(
      "Derived encryption key is not 32 bytes long. Check ENCRYPTION_SECRET format."
    );
  }
} catch (e) {
  console.error(`FATAL CRYPTO CONFIG ERROR: ${e.message}`);
  ENCRYPTION_KEY_BUFFER = null;
}

function encrypt(text) {
  if (!text) return null;
  if (!ENCRYPTION_KEY_BUFFER) {
    console.error(
      "FATAL: Encryption service is not properly configured. Cannot encrypt."
    );
    throw new Error("Encryption service is not properly configured.");
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  if (!ENCRYPTION_KEY_BUFFER) {
    console.error(
      "FATAL: Decryption service is not properly configured. Cannot decrypt."
    );
    throw new Error("Decryption service is not properly configured.");
  }
  try {
    const textParts = text.split(":");
    if (textParts.length !== 2) {
      console.error("Decryption failed: Invalid encrypted text format.");
      return null;
    }
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY_BUFFER,
      iv
    );
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed for text:", text, "Error:", error.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
