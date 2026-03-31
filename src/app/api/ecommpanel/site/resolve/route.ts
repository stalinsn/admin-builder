import type { NextRequest } from 'next/server';
import { jsonNoStore } from '@/features/ecommpanel/server/http';
import { normalizeRuntimePath, resolveDynamicRuntimePath } from '@/features/site-runtime/server/publishedStore';

export const dynamic = 'force-dynamic';

const NATIVE_STATIC_PATHS = new Set<string>(['/', '/plp', '/cart', '/checkout', '/checkout/confirmation']);
const NATIVE_DYNAMIC_PATTERNS: RegExp[] = [/^\/[^/]+\/p$/];

function isNativePath(pathname: string): boolean {
  if (NATIVE_STATIC_PATHS.has(pathname)) return true;
  return NATIVE_DYNAMIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function GET(req: NextRequest) {
  const inputPath = req.nextUrl.searchParams.get('path') || '/';
  const path = normalizeRuntimePath(inputPath);
  const page = resolveDynamicRuntimePath(path);
  const resolved = page
    ? { source: 'dynamic' as const, path, page }
    : isNativePath(path)
      ? { source: 'native' as const, path, page: null }
      : { source: 'not_found' as const, path, page: null };
  return jsonNoStore(resolved);
}
