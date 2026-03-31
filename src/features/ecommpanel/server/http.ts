import 'server-only';

import { NextResponse } from 'next/server';

export function jsonNoStore(payload: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(payload, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export function errorNoStore(status: number, error: string, details?: unknown): NextResponse {
  return jsonNoStore(
    {
      error,
      ...(details ? { details } : {}),
    },
    { status },
  );
}
