import 'server-only';

import type { RuntimeResolveResult } from '@/features/site-runtime/contracts';
import { isNativeStorefrontPath } from '@/features/site-runtime/routeRules';
import { normalizeRuntimePath, resolveDynamicRuntimePath } from '@/features/site-runtime/server/publishedStore';

export function resolveStorefrontPath(pathname: string): RuntimeResolveResult {
  const path = normalizeRuntimePath(pathname);
  const page = resolveDynamicRuntimePath(path);
  if (page) {
    return { source: 'dynamic', path, page };
  }

  if (isNativeStorefrontPath(path)) {
    return { source: 'native', path, page: null };
  }

  return { source: 'not_found', path, page: null };
}
