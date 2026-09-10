import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ENCRYPTED_PREFIX = 'enc:v1:';
const MASKED_SECRET = '••••••••';

class CredentialVault {
  private masterKey: Buffer | null = null;
  private keyFilePath: string;

  constructor() {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    this.keyFilePath = path.join(dataDir, 'vault.key');
  }

  /**
   * Get or initialize the master encryption key (256-bit AES-GCM)
   */
  public getMasterKey(): Buffer {
    if (this.masterKey) {
      return this.masterKey;
    }

    // 1. Check environment variable first
    const envSecret = process.env.VAULT_SECRET || process.env.ENCRYPTION_KEY;
    if (envSecret && envSecret.trim().length >= 32) {
      this.masterKey = crypto.createHash('sha256').update(envSecret.trim()).digest();
      return this.masterKey;
    }

    // 2. Otherwise load or generate persistent key file in data directory
    const dir = path.dirname(this.keyFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.keyFilePath)) {
      try {
        const hex = fs.readFileSync(this.keyFilePath, 'utf-8').trim();
        if (hex.length === 64) {
          this.masterKey = Buffer.from(hex, 'hex');
          return this.masterKey;
        }
      } catch (err) {
        console.warn('Could not read existing vault.key, generating new one.');
      }
    }

    // Generate random 256-bit master key
    const newKey = crypto.randomBytes(32);
    try {
      fs.writeFileSync(this.keyFilePath, newKey.toString('hex'), {
        mode: 0o600, // Read/Write owner only
      });
      // Explicit chmod for POSIX safety
      try {
        fs.chmodSync(this.keyFilePath, 0o600);
      } catch {
        // Ignore on platforms where chmod fails
      }
    } catch (err) {
      console.error('Failed to write vault.key file:', err);
    }

    this.masterKey = newKey;
    return this.masterKey;
  }

  /**
   * Check if a string is already encrypted by the vault
   */
  public isEncrypted(value?: string): boolean {
    return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
  }

  /**
   * Encrypt a plaintext credential using AES-256-GCM
   */
  public encrypt(plaintext?: string): string {
    if (!plaintext || typeof plaintext !== 'string') {
      return plaintext || '';
    }

    // If already encrypted, do not re-encrypt
    if (this.isEncrypted(plaintext)) {
      return plaintext;
    }

    // If masked placeholder, do not encrypt
    if (plaintext === MASKED_SECRET || plaintext === '[CONFIGURED]') {
      return plaintext;
    }

    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 128-bit authentication tag

    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a vault-encrypted string back to plaintext
   */
  public decrypt(ciphertext?: string): string {
    if (!ciphertext || typeof ciphertext !== 'string') {
      return ciphertext || '';
    }

    if (!this.isEncrypted(ciphertext)) {
      return ciphertext; // Already plaintext
    }

    try {
      const payload = ciphertext.slice(ENCRYPTED_PREFIX.length);
      const parts = payload.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted vault payload format');
      }

      const [ivHex, tagHex, encryptedHex] = parts;
      const key = this.getMasterKey();
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf-8');
    } catch (err: any) {
      console.error('Failed to decrypt vault credential:', err.message);
      return ''; // Return empty string on authentication failure
    }
  }

  /**
   * Return masked representation of secret for safe display
   */
  public maskSecret(secret?: string): string {
    if (!secret) return '';
    return MASKED_SECRET;
  }
}

const vault = new CredentialVault();
export default vault;

export const encryptSecret = (secret?: string): string => vault.encrypt(secret);
export const decryptSecret = (encrypted?: string): string => vault.decrypt(encrypted);
export const isEncrypted = (value?: string): boolean => vault.isEncrypted(value);
export const maskSecret = (secret?: string): string => vault.maskSecret(secret);
