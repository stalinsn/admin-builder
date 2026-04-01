import type { UIProduct } from '../types/product';

export type RegionalizationContext = {
  postalCode?: string;
  mode?: 'delivery' | 'pickup';
};

type Cluster = 'capital' | 'metropolitana' | 'interior' | 'fallback';

const CLUSTER_PREFERENCES: Record<Cluster, string[]> = {
  capital: ['Hortifruti', 'Padaria', 'Frios e Laticínios'],
  metropolitana: ['Mercearia', 'Açougue', 'Limpeza'],
  interior: ['Bebidas', 'Pet Shop', 'Higiene e Beleza'],
  fallback: [],
};

function normalizePostalCode(postalCode?: string) {
  return (postalCode || '').replace(/\D/g, '');
}

function resolveCluster(postalCode?: string): Cluster {
  const digits = normalizePostalCode(postalCode);
  if (!digits) return 'fallback';
  const prefix = Number(digits.slice(0, 2));
  if (Number.isNaN(prefix)) return 'fallback';
  if (prefix <= 19) return 'capital';
  if (prefix <= 39) return 'metropolitana';
  return 'interior';
}

function getRegionalScore(product: UIProduct, context?: RegionalizationContext) {
  if (!context?.postalCode) return 0;
  const cluster = resolveCluster(context.postalCode);
  const preferredCategories = CLUSTER_PREFERENCES[cluster];
  const categoryBoost = (product.categories || []).some((category) => preferredCategories.includes(category)) ? 2 : 0;
  const localBrandBoost = (product.brand || '').toLowerCase().includes('local') ? 1 : 0;
  const pickupBoost = context.mode === 'pickup' && product.unit === 'un' ? 1 : 0;
  return categoryBoost + localBrandBoost + pickupBoost;
}

export function applyRegionalization(products: UIProduct[], context?: RegionalizationContext) {
  if (!context?.postalCode) return products;
  const cloned = [...products];
  cloned.sort((left, right) => {
    const scoreDiff = getRegionalScore(right, context) - getRegionalScore(left, context);
    if (scoreDiff !== 0) return scoreDiff;
    return left.name.localeCompare(right.name);
  });
  return cloned;
}
