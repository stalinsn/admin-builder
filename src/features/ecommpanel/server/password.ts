import 'server-only';
import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PANEL_SECURITY } from '../config/security';

const scrypt = promisify(scryptCallback);

const KEYLEN = 64;

type PasswordValidation = {
  ok: boolean;
  reasons: string[];
};

export function validatePasswordPolicy(password: string): PasswordValidation {
  const reasons: string[] = [];
  if (password.length < PANEL_SECURITY.passwordPolicy.minLength) {
    reasons.push(`Password must have at least ${PANEL_SECURITY.passwordPolicy.minLength} characters.`);
  }
  if (PANEL_SECURITY.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    reasons.push('Password must include at least one uppercase letter.');
  }
  if (PANEL_SECURITY.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    reasons.push('Password must include at least one lowercase letter.');
  }
  if (PANEL_SECURITY.passwordPolicy.requireNumber && !/[0-9]/.test(password)) {
    reasons.push('Password must include at least one number.');
  }
  if (PANEL_SECURITY.passwordPolicy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    reasons.push('Password must include at least one symbol.');
  }
  return { ok: reasons.length === 0, reasons };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algo, salt, hashHex] = storedHash.split(':');
  if (algo !== 'scrypt' || !salt || !hashHex) return false;

  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  const hashBuffer = Buffer.from(hashHex, 'hex');
  if (derived.length !== hashBuffer.length) return false;
  return timingSafeEqual(derived, hashBuffer);
}
