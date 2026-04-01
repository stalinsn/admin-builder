import { normalizeStorefrontRoutePathCandidate } from '@/features/site-runtime/routeRules';

export function normalizeBlogSlug(value: string): string {
  const raw = value.trim().replace(/^\/+/, '').replace(/^blog\//i, '');
  return normalizeStorefrontRoutePathCandidate(raw);
}

export function isValidBlogSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
