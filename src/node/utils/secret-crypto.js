import crypto from "crypto";

/**
 * AES-256-GCM encryption for secrets stored in the database (e.g. SSO client
 * secrets). Key: SECRETS_ENCRYPTION_KEY (64 hex chars or base64 of 32 bytes);
 * falls back to a key derived from JWT_ACCESS_SECRET so it works out of the box.
 * Format: "enc:v1:<iv b64>:<tag b64>:<ciphertext b64>".
 */
const PREFIX = "enc:v1:";

const getKey = () => {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (key.length === 32) return key;
    throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
  }
  const fallback = process.env.JWT_ACCESS_SECRET;
  if (!fallback) throw new Error("No encryption key available (set SECRETS_ENCRYPTION_KEY)");
  return crypto.hkdfSync("sha256", fallback, "confetti-secret-crypto", "stored-secrets-v1", 32);
};

export const isEncrypted = (value) => typeof value === "string" && value.startsWith(PREFIX);

export const encryptSecret = (plaintext) => {
  if (plaintext === undefined || plaintext === null || plaintext === "") return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(getKey()), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
};

export const decryptSecret = (value) => {
  if (!isEncrypted(value)) return value; // legacy plaintext
  const [iv, tag, data] = value.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(getKey()), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
};
