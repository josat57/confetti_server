import crypto from "crypto";
import { logger } from "./logger.js";

/**
 * Encryption Utilities
 * Provides encryption/decryption for sensitive data
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment
 */
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logger.warn("ENCRYPTION_KEY not set in environment variables");
    // In development, use a default key (NOT for production!)
    return crypto.scryptSync("default-dev-key", "salt", KEY_LENGTH);
  }

  // Derive key from environment variable
  return crypto.scryptSync(key, "salt", KEY_LENGTH);
};

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV and auth tag
 */
export const encrypt = (text) => {
  try {
    if (!text) return text;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    logger.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} - Decrypted text
 */
export const decrypt = (encryptedText) => {
  try {
    if (!encryptedText) return encryptedText;

    const key = getEncryptionKey();
    const parts = encryptedText.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
};

/**
 * Hash sensitive data (one-way)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
export const hash = (text) => {
  try {
    if (!text) return text;

    return crypto.createHash("sha256").update(text).digest("hex");
  } catch (error) {
    logger.error("Hashing error:", error);
    throw new Error("Failed to hash data");
  }
};

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} - Random token
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Generate secure random password
 * @param {number} length - Password length
 * @returns {string} - Random password
 */
export const generatePassword = (length = 16) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
};

/**
 * Encrypt object fields
 * @param {Object} obj - Object with fields to encrypt
 * @param {Array} fields - Fields to encrypt
 * @returns {Object} - Object with encrypted fields
 */
export const encryptFields = (obj, fields = []) => {
  const encrypted = { ...obj };

  fields.forEach((field) => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });

  return encrypted;
};

/**
 * Decrypt object fields
 * @param {Object} obj - Object with encrypted fields
 * @param {Array} fields - Fields to decrypt
 * @returns {Object} - Object with decrypted fields
 */
export const decryptFields = (obj, fields = []) => {
  const decrypted = { ...obj };

  fields.forEach((field) => {
    if (decrypted[field]) {
      try {
        decrypted[field] = decrypt(decrypted[field]);
      } catch (error) {
        logger.error(`Failed to decrypt field ${field}:`, error);
        // Keep encrypted value if decryption fails
      }
    }
  });

  return decrypted;
};

/**
 * Compare hash with plain text
 * @param {string} plainText - Plain text
 * @param {string} hashedText - Hashed text
 * @returns {boolean} - Match result
 */
export const compareHash = (plainText, hashedText) => {
  try {
    const hash = crypto.createHash("sha256").update(plainText).digest("hex");
    return hash === hashedText;
  } catch (error) {
    logger.error("Hash comparison error:", error);
    return false;
  }
};

/**
 * Generate HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature
 */
export const generateHMAC = (data, secret) => {
  try {
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
  } catch (error) {
    logger.error("HMAC generation error:", error);
    throw new Error("Failed to generate HMAC");
  }
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - HMAC signature
 * @param {string} secret - Secret key
 * @returns {boolean} - Verification result
 */
export const verifyHMAC = (data, signature, secret) => {
  try {
    const expectedSignature = generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error("HMAC verification error:", error);
    return false;
  }
};

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters
 * @returns {string} - Masked data
 */
export const maskData = (data, visibleChars = 4) => {
  if (!data || data.length <= visibleChars) {
    return "***";
  }

  const visible = data.slice(-visibleChars);
  const masked = "*".repeat(data.length - visibleChars);
  return masked + visible;
};

/**
 * Encrypt credit card number
 * @param {string} cardNumber - Credit card number
 * @returns {Object} - Encrypted card and last 4 digits
 */
export const encryptCardNumber = (cardNumber) => {
  const cleaned = cardNumber.replace(/\s/g, "");
  const last4 = cleaned.slice(-4);
  const encrypted = encrypt(cleaned);

  return {
    encrypted,
    last4,
    masked: maskData(cleaned, 4),
  };
};

/**
 * Generate encryption key pair
 * @returns {Object} - Public and private keys
 */
export const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return { publicKey, privateKey };
};

export default {
  encrypt,
  decrypt,
  hash,
  generateToken,
  generatePassword,
  encryptFields,
  decryptFields,
  compareHash,
  generateHMAC,
  verifyHMAC,
  maskData,
  encryptCardNumber,
  generateKeyPair,
};
