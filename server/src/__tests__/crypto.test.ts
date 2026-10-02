import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/crypto';

describe('crypto (AES-256-GCM token encryption)', () => {
  it('round-trips a plaintext token exactly', () => {
    const original = 'gho_thisIsAFakeGithubAccessToken1234567890';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('never stores the plaintext token verbatim in the encrypted payload', () => {
    const original = 'gho_thisIsAFakeGithubAccessToken1234567890';
    const encrypted = encrypt(original);
    expect(encrypted).not.toContain(original);
  });

  it('produces a different ciphertext each time (random IV) even for the same input', () => {
    const original = 'gho_sameTokenTwice';
    const first = encrypt(original);
    const second = encrypt(original);
    expect(first).not.toBe(second);
    // but both still decrypt correctly
    expect(decrypt(first)).toBe(original);
    expect(decrypt(second)).toBe(original);
  });

  it('rejects a tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encrypt('gho_sensitiveToken');
    const [iv, authTag, data] = encrypted.split(':');
    // flip one hex character in the ciphertext body
    const tamperedData = data.slice(0, -1) + (data.slice(-1) === '0' ? '1' : '0');
    const tampered = `${iv}:${authTag}:${tamperedData}`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects a malformed payload missing parts', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow('Malformed encrypted payload');
  });
});
