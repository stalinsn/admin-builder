import type { SiteBlockType, SiteLayoutPreset } from './types/siteBuilder';

export type SiteRouteNamespaceId =
  | 'root'
  | 'landing'
  | 'campaigns'
  | 'institutional'
  | 'editorial'
  | 'custom';

export type SiteRouteNamespace = {
  id: SiteRouteNamespaceId;
  label: string;
  description: string;
  prefix: string;
  examplePath: string;
  layoutPreset: SiteLayoutPreset;
  starterPlan: SiteBlockType[][];
};

export const SITE_ROUTE_NAMESPACES: SiteRouteNamespace[] = [
  {
    id: 'root',
    label: 'Raiz',
    description: 'Páginas diretas no primeiro nível da loja, sem pasta operacional.',
    prefix: '',
    examplePath: 'quem-somos',
    layoutPreset: 'three_vertical',
    starterPlan: [['hero'], ['rich_text'], ['cta']],
  },
  {
    id: 'landing',
    label: 'Landing',
    description: 'Campanhas de conversão, mídia paga e páginas promocionais de entrada.',
    prefix: 'landing',
    examplePath: 'landing/black-friday',
    layoutPreset: 'three_horizontal',
    starterPlan: [['hero'], ['banner'], ['cta']],
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    description: 'Páginas comerciais recorrentes conectadas a calendário promocional.',
    prefix: 'campanhas',
    examplePath: 'campanhas/dia-das-maes',
    layoutPreset: 'three_vertical',
    starterPlan: [['hero'], ['product_shelf'], ['cta']],
  },
  {
    id: 'institutional',
    label: 'Institucional',
    description: 'Conteúdo de marca, institucional, ajuda e páginas de confiança.',
    prefix: 'institucional',
    examplePath: 'institucional/quem-somos',
    layoutPreset: 'three_vertical',
    starterPlan: [['hero'], ['rich_text'], ['cta']],
  },
  {
    id: 'editorial',
    label: 'Conteúdo',
    description: 'Guias, editoriais e conteúdo leve de apoio orgânico.',
    prefix: 'conteudo',
    examplePath: 'conteudo/guia-do-cafe',
    layoutPreset: 'single_block',
    starterPlan: [['rich_text', 'cta']],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Namespace livre para estruturas futuras fora dos padrões operacionais do painel.',
    prefix: '',
    examplePath: 'especial/parceiros',
    layoutPreset: 'three_vertical',
    starterPlan: [['hero'], ['rich_text'], ['cta']],
  },
];

const NAMESPACE_MAP = new Map(SITE_ROUTE_NAMESPACES.map((namespace) => [namespace.id, namespace]));

export function getSiteRouteNamespace(namespaceId: SiteRouteNamespaceId): SiteRouteNamespace {
  return NAMESPACE_MAP.get(namespaceId) || SITE_ROUTE_NAMESPACES[0];
}

export function normalizeSiteRouteSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveSiteRouteNamespaceBySlug(slug: string): SiteRouteNamespace {
  const normalized = slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!normalized) return getSiteRouteNamespace('root');

  const [firstSegment] = normalized.split('/');
  for (const namespace of SITE_ROUTE_NAMESPACES) {
    if (!namespace.prefix) continue;
    if (firstSegment === namespace.prefix) return namespace;
  }

  return normalized.includes('/') ? getSiteRouteNamespace('custom') : getSiteRouteNamespace('root');
}

export function extractNamespaceLeafPath(slug: string): string {
  const normalized = slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!normalized) return '';

  const namespace = resolveSiteRouteNamespaceBySlug(normalized);
  if (namespace.id === 'custom') {
    const segments = normalized.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  }

  if (!namespace.prefix) return normalized;
  return normalized.replace(new RegExp(`^${namespace.prefix}/?`), '');
}

export function extractCustomNamespacePrefix(slug: string): string {
  const normalized = slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!normalized.includes('/')) return '';

  const namespace = resolveSiteRouteNamespaceBySlug(normalized);
  if (namespace.id !== 'custom') return '';

  const segments = normalized.split('/').filter(Boolean);
  return segments.slice(0, -1).join('/');
}

export function buildNamespacedRoutePath(input: {
  namespaceId: SiteRouteNamespaceId;
  leafPath: string;
  customPrefix?: string;
}): string {
  const namespace = getSiteRouteNamespace(input.namespaceId);
  const normalizedLeaf = input.leafPath
    .split('/')
    .map((segment) => normalizeSiteRouteSegment(segment))
    .filter(Boolean)
    .join('/');

  if (!normalizedLeaf) {
    return '';
  }

  if (namespace.id === 'root') {
    return normalizedLeaf;
  }

  if (namespace.id === 'custom') {
    const normalizedPrefix = input.customPrefix
      ? input.customPrefix
          .split('/')
          .map((segment) => normalizeSiteRouteSegment(segment))
          .filter(Boolean)
          .join('/')
      : '';

    return [normalizedPrefix, normalizedLeaf].filter(Boolean).join('/');
  }

  return [namespace.prefix, normalizedLeaf].filter(Boolean).join('/');
}

export function describeSiteRoutePath(slug: string): {
  namespace: SiteRouteNamespace;
  leafPath: string;
  customPrefix: string;
} {
  const namespace = resolveSiteRouteNamespaceBySlug(slug);
  return {
    namespace,
    leafPath: extractNamespaceLeafPath(slug),
    customPrefix: extractCustomNamespacePrefix(slug),
  };
}
