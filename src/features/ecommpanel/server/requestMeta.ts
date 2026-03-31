import 'server-only';
import type { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

export function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') || 'unknown';
}

export function getRequestFingerprint(req: NextRequest): string {
  return `${getClientIp(req)}::${getUserAgent(req).slice(0, 120)}`;
}
