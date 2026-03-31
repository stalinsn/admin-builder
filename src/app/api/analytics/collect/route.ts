import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { collectAnalyticsEvents } from '@/features/analytics/server/eventStore';

export const dynamic = 'force-dynamic';

function jsonNoStore(payload: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(payload, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function isSameOriginOrMissing(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginOrMissing(req)) {
    return jsonNoStore({ error: 'Origem não permitida.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonNoStore({ error: 'Payload inválido.' }, { status: 400 });
  }

  const result = await collectAnalyticsEvents(req, body);
  return jsonNoStore({ ok: true, ...result }, { status: 202 });
}
