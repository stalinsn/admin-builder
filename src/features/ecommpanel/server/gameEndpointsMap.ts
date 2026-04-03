import 'server-only';

import type { DataEntityDefinition, DataFieldDefinition, DataStudioSnapshot } from '@/features/ecommpanel/types/dataStudio';
import { buildEntityReadScope, buildEntityWriteScope } from '@/features/public-api/integration';

export type GameEndpointsGroupId = 'content' | 'players' | 'world' | 'competitive';

export type GameEndpointRoute = {
  id: string;
  kind: 'collection' | 'item';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  route: string;
  scope: string;
};

export type GameEndpointField = {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  referenceTargetId?: string;
  referenceTargetLabel?: string;
  referenceTargetSlug?: string;
};

export type GameEndpointNode = {
  id: string;
  slug: string;
  label: string;
  description: string;
  group: GameEndpointsGroupId;
  tableName: string;
  status: DataEntityDefinition['status'];
  methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'>;
  routes: GameEndpointRoute[];
  fields: GameEndpointField[];
  x: number;
  y: number;
};

export type GameEndpointEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'>;
};
const METHOD_ORDER: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

export type GameEndpointsMapData = {
  generatedAt: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    totalFields: number;
    readableRoutes: number;
    writableRoutes: number;
  };
  groups: Array<{
    id: GameEndpointsGroupId;
    label: string;
    description: string;
  }>;
  nodes: GameEndpointNode[];
  edges: GameEndpointEdge[];
};

const GROUP_META: Record<
  GameEndpointsGroupId,
  { label: string; description: string; order: string[]; baseX: number }
> = {
  content: {
    label: 'Conteudo do Jogo',
    description: 'Catalogo, habilidades, decks base e regras canonicas.',
    order: [
      'cards',
      'character-cards',
      'accessory-cards',
      'skills',
      'skill-tags',
      'card-skill-pool',
      'card-skill-loadouts',
      'deck-templates',
      'deck-template-cards',
      'game-rulesets',
    ],
    baseX: 68,
  },
  players: {
    label: 'Camada do Jogador',
    description: 'Perfil, sessoes, inventario, decks do usuario e sinais de seguranca.',
    order: [
      'players',
      'player-settings',
      'player-login-events',
      'player-sessions',
      'player-inventory',
      'inventory-transactions',
      'player-decks',
      'player-deck-cards',
      'player-progression',
      'player-security-flags',
    ],
    baseX: 508,
  },
  world: {
    label: 'Mapa e Runtime',
    description: 'Ilhas, encontros, bosses, patches e configuracoes ao vivo.',
    order: [
      'world-islands',
      'island-stages',
      'encounter-templates',
      'boss-configs',
      'game-patches',
      'live-ops-configs',
    ],
    baseX: 948,
  },
  competitive: {
    label: 'Partidas e Ranking',
    description: 'Matches, participantes e temporadas competitivas.',
    order: ['matches', 'match-players', 'ranking-seasons', 'ranking-entries'],
    baseX: 1388,
  },
};

function resolveGroup(slug: string): GameEndpointsGroupId {
  if (GROUP_META.content.order.includes(slug)) return 'content';
  if (GROUP_META.players.order.includes(slug)) return 'players';
  if (GROUP_META.world.order.includes(slug)) return 'world';
  if (
    slug.startsWith('player-') ||
    slug === 'players' ||
    slug.startsWith('inventory-')
  ) {
    return 'players';
  }
  if (
    slug.startsWith('world-') ||
    slug.startsWith('island-') ||
    slug.startsWith('encounter-') ||
    slug.startsWith('boss-') ||
    slug.startsWith('game-patch') ||
    slug.startsWith('live-ops')
  ) {
    return 'world';
  }
  if (slug.startsWith('match') || slug.startsWith('ranking-')) {
    return 'competitive';
  }
  return 'content';
}

function resolveNodePosition(
  entity: DataEntityDefinition,
  snapshot: Pick<DataStudioSnapshot, 'entities'>,
): { x: number; y: number } {
  const group = resolveGroup(entity.slug);
  const order = GROUP_META[group].order;
  const knownIndex = order.indexOf(entity.slug);
  let index = knownIndex;

  if (knownIndex < 0) {
    const unknownGroupSlugs = snapshot.entities
      .filter((item) => resolveGroup(item.slug) === group && !order.includes(item.slug))
      .map((item) => item.slug)
      .sort((left, right) => left.localeCompare(right, 'pt-BR'));
    index = order.length + Math.max(unknownGroupSlugs.indexOf(entity.slug), 0);
  }

  return {
    x: GROUP_META[group].baseX,
    y: 96 + index * 292,
  };
}

function buildRoutes(entity: DataEntityDefinition): GameEndpointRoute[] {
  const readScope = buildEntityReadScope(entity.slug);
  const writeScope = buildEntityWriteScope(entity.slug);

  return [
    {
      id: `${entity.slug}-collection-read`,
      kind: 'collection',
      method: 'GET',
      route: `/api/integration/v1/data/entities/${entity.slug}/records`,
      scope: readScope,
    },
    {
      id: `${entity.slug}-collection-write`,
      kind: 'collection',
      method: 'POST',
      route: `/api/integration/v1/data/entities/${entity.slug}/records`,
      scope: writeScope,
    },
    {
      id: `${entity.slug}-item-read`,
      kind: 'item',
      method: 'GET',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      scope: readScope,
    },
    {
      id: `${entity.slug}-item-write`,
      kind: 'item',
      method: 'PUT',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      scope: writeScope,
    },
    {
      id: `${entity.slug}-item-delete`,
      kind: 'item',
      method: 'DELETE',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      scope: writeScope,
    },
  ];
}

function buildFieldDescriptor(
  field: DataFieldDefinition,
  entityById: Map<string, DataEntityDefinition>,
): GameEndpointField {
  const target = field.referenceEntityId ? entityById.get(field.referenceEntityId) : null;
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    referenceTargetId: target?.id,
    referenceTargetLabel: target?.label,
    referenceTargetSlug: target?.slug,
  };
}

function buildEdgeLabel(entity: DataEntityDefinition, field: DataFieldDefinition, target: DataEntityDefinition): string {
  return `${entity.slug}.${field.name} -> ${target.slug}`;
}

function buildEntityMethods(entity: DataEntityDefinition): Array<'GET' | 'POST' | 'PUT' | 'DELETE'> {
  const routes = buildRoutes(entity);
  return METHOD_ORDER.filter((method) => routes.some((route) => route.method === method));
}

export function buildGameEndpointsMap(snapshot: Pick<DataStudioSnapshot, 'entities'>): GameEndpointsMapData {
  const entityById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const nodes = snapshot.entities.map((entity) => {
    const routes = buildRoutes(entity);
    const methods = Array.from(new Set(routes.map((route) => route.method))) as Array<'GET' | 'POST' | 'PUT' | 'DELETE'>;
    const { x, y } = resolveNodePosition(entity, snapshot);

    return {
      id: entity.id,
      slug: entity.slug,
      label: entity.label,
      description: entity.description || `Mapa fisico da entidade ${entity.label}.`,
      group: resolveGroup(entity.slug),
      tableName: entity.tableName,
      status: entity.status,
      methods,
      routes,
      fields: entity.fields.map((field) => buildFieldDescriptor(field, entityById)),
      x,
      y,
    } satisfies GameEndpointNode;
  });

  const edges: GameEndpointEdge[] = snapshot.entities.flatMap((entity) =>
    entity.fields.flatMap((field) => {
      if (!field.referenceEntityId) return [];
      const target = entityById.get(field.referenceEntityId);
      if (!target) return [];

      return [
        {
          id: `${entity.id}-${field.id}-${target.id}`,
          from: entity.id,
          to: target.id,
          label: buildEdgeLabel(entity, field, target),
          methods: buildEntityMethods(entity),
        },
      ];
    }),
  );

  const allRoutes = nodes.flatMap((node) => node.routes);

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalFields: nodes.reduce((sum, node) => sum + node.fields.length, 0),
      readableRoutes: allRoutes.filter((route) => route.method === 'GET').length,
      writableRoutes: allRoutes.filter((route) => route.method !== 'GET').length,
    },
    groups: (Object.entries(GROUP_META) as Array<[GameEndpointsGroupId, (typeof GROUP_META)[GameEndpointsGroupId]]>).map(
      ([id, meta]) => ({
        id,
        label: meta.label,
        description: meta.description,
      }),
    ),
    nodes,
    edges,
  };
}
