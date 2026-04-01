import type { DataStudioSnapshot } from '@/features/ecommpanel/types/dataStudio';

export const BUILDER_STATIC_API_INTEGRATION_SCOPES = [
  'system.health.read',
  'data.contracts.read',
  'data.records.read',
  'data.records.write',
] as const;

export type StaticApiIntegrationScope = (typeof BUILDER_STATIC_API_INTEGRATION_SCOPES)[number];
export type ApiIntegrationScope = string;

export type ApiExposure = 'public' | 'integration';
export type ApiReferenceDomain = 'system' | 'data' | 'entity';

export type ApiReferenceItem = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  route: string;
  exposure: ApiExposure;
  scope?: ApiIntegrationScope;
  domain: ApiReferenceDomain;
  description: string;
};

export type ApiIntegrationScopeOption = {
  scope: ApiIntegrationScope;
  label: string;
  description: string;
  availability: 'active' | 'reserved';
  group: 'system' | 'data' | 'entity';
  entitySlug?: string;
};

type ScopeEntityLike = {
  slug: string;
  label: string;
};

function normalizeScopeEntity(input: ScopeEntityLike) {
  return {
    slug: input.slug.trim(),
    label: input.label.trim() || input.slug.trim(),
  };
}

function extractEntities(snapshot?: Pick<DataStudioSnapshot, 'entities'> | null): ScopeEntityLike[] {
  if (!snapshot?.entities?.length) return [];
  return snapshot.entities
    .map((entity) => normalizeScopeEntity({ slug: entity.slug, label: entity.label }))
    .filter((entity) => entity.slug);
}

export function buildEntityReadScope(entitySlug: string): ApiIntegrationScope {
  return `entity.${entitySlug}.read`;
}

export function buildEntityWriteScope(entitySlug: string): ApiIntegrationScope {
  return `entity.${entitySlug}.write`;
}

export function getApiIntegrationScopes(snapshot?: Pick<DataStudioSnapshot, 'entities'> | null): ApiIntegrationScope[] {
  const scopes: ApiIntegrationScope[] = [...BUILDER_STATIC_API_INTEGRATION_SCOPES];
  for (const entity of extractEntities(snapshot)) {
    scopes.push(buildEntityReadScope(entity.slug));
    scopes.push(buildEntityWriteScope(entity.slug));
  }
  return scopes;
}

export function getApiIntegrationScopeOptions(
  snapshot?: Pick<DataStudioSnapshot, 'entities'> | null,
): ApiIntegrationScopeOption[] {
  const options: ApiIntegrationScopeOption[] = [
    {
      scope: 'system.health.read',
      label: 'Health do sistema',
      description: 'Permite consultar o estado operacional da instância para monitoramento e diagnóstico.',
      availability: 'active',
      group: 'system',
    },
    {
      scope: 'data.contracts.read',
      label: 'Contratos de dados',
      description: 'Expõe JSON Schema e OpenAPI gerados a partir das entidades modeladas no Data Studio.',
      availability: 'active',
      group: 'data',
    },
    {
      scope: 'data.records.read',
      label: 'Leitura global de registros',
      description: 'Permite leitura ampla das entidades modeladas, útil para integrações internas ou ETL.',
      availability: 'active',
      group: 'data',
    },
    {
      scope: 'data.records.write',
      label: 'Escrita global de registros',
      description: 'Permite criação, atualização e remoção em todas as entidades modeladas.',
      availability: 'active',
      group: 'data',
    },
  ];

  for (const entity of extractEntities(snapshot)) {
    options.push(
      {
        scope: buildEntityReadScope(entity.slug),
        label: `${entity.label}: leitura`,
        description: `Permite consultar registros da entidade ${entity.label}.`,
        availability: 'active',
        group: 'entity',
        entitySlug: entity.slug,
      },
      {
        scope: buildEntityWriteScope(entity.slug),
        label: `${entity.label}: escrita`,
        description: `Permite criar, editar e remover registros da entidade ${entity.label}.`,
        availability: 'active',
        group: 'entity',
        entitySlug: entity.slug,
      },
    );
  }

  return options;
}

export function isKnownApiIntegrationScope(
  value: unknown,
  snapshot?: Pick<DataStudioSnapshot, 'entities'> | null,
): value is ApiIntegrationScope {
  return typeof value === 'string' && getApiIntegrationScopes(snapshot).includes(value);
}

function buildEntityReferenceItems(
  snapshot?: Pick<DataStudioSnapshot, 'entities'> | null,
): ApiReferenceItem[] {
  return extractEntities(snapshot).flatMap((entity) => [
    {
      id: `integration-entity-${entity.slug}-records`,
      method: 'GET',
      route: `/api/integration/v1/data/entities/${entity.slug}/records`,
      exposure: 'integration',
      scope: buildEntityReadScope(entity.slug),
      domain: 'entity',
      description: `Lista paginada de registros da entidade ${entity.label}.`,
    },
    {
      id: `integration-entity-${entity.slug}-records-create`,
      method: 'POST',
      route: `/api/integration/v1/data/entities/${entity.slug}/records`,
      exposure: 'integration',
      scope: buildEntityWriteScope(entity.slug),
      domain: 'entity',
      description: `Cria um registro na entidade ${entity.label}.`,
    },
    {
      id: `integration-entity-${entity.slug}-record`,
      method: 'GET',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      exposure: 'integration',
      scope: buildEntityReadScope(entity.slug),
      domain: 'entity',
      description: `Lê um registro específico da entidade ${entity.label}.`,
    },
    {
      id: `integration-entity-${entity.slug}-record-update`,
      method: 'PUT',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      exposure: 'integration',
      scope: buildEntityWriteScope(entity.slug),
      domain: 'entity',
      description: `Atualiza um registro específico da entidade ${entity.label}.`,
    },
    {
      id: `integration-entity-${entity.slug}-record-delete`,
      method: 'DELETE',
      route: `/api/integration/v1/data/entities/${entity.slug}/records/[recordId]`,
      exposure: 'integration',
      scope: buildEntityWriteScope(entity.slug),
      domain: 'entity',
      description: `Remove um registro específico da entidade ${entity.label}.`,
    },
  ]);
}

const BASE_API_REFERENCE_ITEMS: ApiReferenceItem[] = [
  {
    id: 'public-index',
    method: 'GET',
    route: '/api/v1',
    exposure: 'public',
    domain: 'system',
    description: 'Índice público resumido da API da instância.',
  },
  {
    id: 'public-health',
    method: 'GET',
    route: '/api/v1/system/health',
    exposure: 'public',
    domain: 'system',
    description: 'Healthcheck público resumido.',
  },
  {
    id: 'integration-index',
    method: 'GET',
    route: '/api/integration/v1',
    exposure: 'integration',
    domain: 'system',
    description: 'Índice autenticado da API de integrações.',
  },
  {
    id: 'integration-auth-token',
    method: 'POST',
    route: '/api/integration/v1/auth/token',
    exposure: 'integration',
    domain: 'system',
    description: 'Troca key id + secret por bearer token temporário.',
  },
  {
    id: 'integration-health',
    method: 'GET',
    route: '/api/integration/v1/system/health',
    exposure: 'integration',
    scope: 'system.health.read',
    domain: 'system',
    description: 'Healthcheck autenticado para monitoramento e observabilidade.',
  },
  {
    id: 'integration-data-contracts',
    method: 'GET',
    route: '/api/integration/v1/data/contracts',
    exposure: 'integration',
    scope: 'data.contracts.read',
    domain: 'data',
    description: 'Bundle de JSON Schema e OpenAPI gerado pelo Data Studio.',
  },
  {
    id: 'integration-data-records',
    method: 'GET',
    route: '/api/integration/v1/data/entities/[entitySlug]/records',
    exposure: 'integration',
    scope: 'data.records.read',
    domain: 'data',
    description: 'Leitura ampla de registros de qualquer entidade modelada.',
  },
  {
    id: 'integration-data-records-create',
    method: 'POST',
    route: '/api/integration/v1/data/entities/[entitySlug]/records',
    exposure: 'integration',
    scope: 'data.records.write',
    domain: 'data',
    description: 'Criação ampla de registros em entidades modeladas.',
  },
  {
    id: 'integration-data-record',
    method: 'GET',
    route: '/api/integration/v1/data/entities/[entitySlug]/records/[recordId]',
    exposure: 'integration',
    scope: 'data.records.read',
    domain: 'data',
    description: 'Consulta ampla de um registro modelado.',
  },
  {
    id: 'integration-data-record-update',
    method: 'PUT',
    route: '/api/integration/v1/data/entities/[entitySlug]/records/[recordId]',
    exposure: 'integration',
    scope: 'data.records.write',
    domain: 'data',
    description: 'Atualização ampla de um registro modelado.',
  },
  {
    id: 'integration-data-record-delete',
    method: 'DELETE',
    route: '/api/integration/v1/data/entities/[entitySlug]/records/[recordId]',
    exposure: 'integration',
    scope: 'data.records.write',
    domain: 'data',
    description: 'Remoção ampla de um registro modelado.',
  },
];

export function listReferenceByExposure(
  exposure: ApiExposure,
  snapshot?: Pick<DataStudioSnapshot, 'entities'> | null,
) {
  return [...BASE_API_REFERENCE_ITEMS, ...buildEntityReferenceItems(snapshot)].filter(
    (item) => item.exposure === exposure,
  );
}
