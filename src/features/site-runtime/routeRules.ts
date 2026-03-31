export const STOREFRONT_NATIVE_STATIC_PATHS = new Set<string>([
  '/',
  '/blog',
  '/plp',
  '/cart',
  '/checkout',
  '/checkout/confirmation',
]);

export const STOREFRONT_NATIVE_DYNAMIC_PATTERNS: RegExp[] = [
  /^\/blog\/[^/]+$/,
  /^\/[^/]+\/p$/,
  /^\/paginas\/[^/]+$/,
];

export const STOREFRONT_RESERVED_SINGLE_SEGMENT_SLUGS = new Set<string>([
  'blog',
  'plp',
  'cart',
  'checkout',
  'paginas',
]);

export function normalizeStorefrontRoutePathCandidate(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
  return withoutSlashes
    .split('/')
    .map((segment) =>
      segment
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('/');
}

export function isNativeStorefrontPath(pathname: string): boolean {
  if (STOREFRONT_NATIVE_STATIC_PATHS.has(pathname)) return true;
  return STOREFRONT_NATIVE_DYNAMIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isReservedStorefrontSlug(slug: string): boolean {
  const normalized = normalizeStorefrontRoutePathCandidate(slug);
  if (!normalized) return false;

  const firstSegment = normalized.split('/')[0];
  const asPath = `/${normalized}`;
  if (STOREFRONT_RESERVED_SINGLE_SEGMENT_SLUGS.has(firstSegment)) return true;
  return isNativeStorefrontPath(asPath);
}

export function getReservedStorefrontSlugError(slug: string): string | null {
  const normalized = normalizeStorefrontRoutePathCandidate(slug);
  if (!normalized) return null;
  if (!isReservedStorefrontSlug(normalized)) return null;
  return `O caminho "${normalized}" é reservado por uma rota nativa ou namespace interno do storefront.`;
}
