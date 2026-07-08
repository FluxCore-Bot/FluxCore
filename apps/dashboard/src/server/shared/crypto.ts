import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { config } from "@fluxcore/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  return createHash("sha256")
    .update(config.dashboardSessionSecret)
    .digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getKey();
  const data = Buffer.from(encoded, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

const MIN_ENCRYPTED_BYTES = IV_LENGTH + AUTH_TAG_LENGTH + 1;

/**
 * Best-effort check whether a stored string was produced by `encrypt()`.
 * Used to detect legacy plaintext rows during the encryption backfill.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  // Base64 alphabet check (allow padding)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  let buf: Buffer;
  try {
    buf = Buffer.from(value, "base64");
  } catch {
    return false;
  }
  if (buf.length < MIN_ENCRYPTED_BYTES) return false;
  // Verify by attempting decryption with the active key
  try {
    decrypt(value);
    return true;
  } catch {
    return false;
  }
}
