import crypto from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(env.tokenEncryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
  }
  return key;
}

/**
 * Encrypts a plaintext string (the GitHub access token) into a single
 * storable string: iv:authTag:ciphertext, all hex-encoded.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV, standard for GCM
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }

  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
