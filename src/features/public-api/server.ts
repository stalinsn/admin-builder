import { NextResponse } from 'next/server';

import { PUBLIC_API_VERSION, type PublicApiEnvelope } from '@/features/public-api/contracts';

export const PUBLIC_API_DEFAULT_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
export const PUBLIC_API_SHORT_CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120';

export function nowApiTimestamp(): string {
  return new Date().toISOString();
}

export function readLimitParam(value: string | null, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function readBooleanParam(value: string | null): boolean | null {
  if (!value) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function jsonPublic<TData, TMeta = Record<string, unknown>>(
  data: TData,
  init?: {
    status?: number;
    cacheControl?: string;
    generatedAt?: string;
    meta?: TMeta;
  },
) {
  const response = NextResponse.json({
    version: PUBLIC_API_VERSION,
    generatedAt: init?.generatedAt || nowApiTimestamp(),
    data,
    meta: init?.meta,
  } satisfies PublicApiEnvelope<TData, TMeta>, {
    status: init?.status || 200,
  });

  response.headers.set('Cache-Control', init?.cacheControl || PUBLIC_API_DEFAULT_CACHE);
  response.headers.set('X-App-Hub-Api-Version', PUBLIC_API_VERSION);
  return response;
}

export function errorPublic(status: number, message: string, cacheControl = PUBLIC_API_SHORT_CACHE) {
  return jsonPublic({ error: message }, { status, cacheControl });
}
