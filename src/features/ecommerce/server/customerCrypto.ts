import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getSecret(): string {
  const configured =
    process.env.APP_CUSTOMER_DATA_SECRET?.trim() ||
    process.env.CUSTOMER_DATA_SECRET?.trim() ||
    process.env.PANEL_AUTH_SECRET?.trim() ||
    '';

  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'dev-customer-data-secret-only-local';
  throw new Error('APP_CUSTOMER_DATA_SECRET não configurado para criptografia de dados do cliente.');
}

function getKey(): Buffer {
  return createHash('sha256').update(getSecret()).digest();
}

export function encryptCustomerData(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptCustomerData(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const [ivPart, tagPart, payloadPart] = value.split('.');
  if (!ivPart || !tagPart || !payloadPart) return undefined;

  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payloadPart, 'base64url')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return undefined;
  }
}

export function hashLookupValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}
