import { NextResponse } from 'next/server';

export function getVtexBaseUrl() {
  const account = process.env.VTEX_ACCOUNT;
  const env = process.env.VTEX_ENV || 'vtexcommercestable';
  if (!account) {
    throw new Error('VTEX_ACCOUNT not configured');
  }
  return `https://${account}.${env}.com.br`;
}

export function vtexHeaders() {
  const key = process.env.VTEX_APP_KEY;
  const token = process.env.VTEX_APP_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (key && token) {
    headers['X-VTEX-API-AppKey'] = key;
    headers['X-VTEX-API-AppToken'] = token;
  }
  return headers;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function toNumber(v: unknown, fallback: number) {
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
