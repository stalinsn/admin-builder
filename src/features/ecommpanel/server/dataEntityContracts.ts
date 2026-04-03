import 'server-only';

import type { DataEntityDefinition, DataFieldDefinition, DataStudioSnapshot } from '@/features/ecommpanel/types/dataStudio';

type JsonSchema = Record<string, unknown>;

function toSchemaType(field: DataFieldDefinition): JsonSchema {
  switch (field.type) {
    case 'email':
      return { type: 'string', format: 'email' };
    case 'url':
      return { type: 'string', format: 'uri' };
    case 'integer':
      return { type: 'integer' };
    case 'number':
    case 'currency':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'json':
      return {};
    default:
      return { type: 'string' };
  }
}

function toComponentName(entity: DataEntityDefinition): string {
  return entity.slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join('');
}

export function getModeledEntityBySlug(entitySlug: string, snapshot: DataStudioSnapshot): DataEntityDefinition | null {
  return snapshot.entities.find((entity) => entity.slug === entitySlug) || null;
}

export function buildEntityJsonSchema(entity: DataEntityDefinition): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    id: {
      type: 'string',
      description: 'Identificador técnico do registro.',
      readOnly: true,
    },
  };

  const required = entity.fields.filter((field) => field.required).map((field) => field.name);

  for (const field of entity.fields) {
    properties[field.name] = {
      ...toSchemaType(field),
      title: field.label,
      description: field.description || undefined,
      default: field.defaultValue,
      'x-apphub-field-type': field.type,
      'x-apphub-list-visible': field.listVisible,
      'x-apphub-unique': field.unique,
      'x-apphub-indexed': field.indexed,
      'x-apphub-reference-entity-id': field.referenceEntityId,
    };
  }

  properties.created_at = {
    type: 'string',
    format: 'date-time',
    description: 'Data de criação do registro.',
    readOnly: true,
  };

  properties.updated_at = {
    type: 'string',
    format: 'date-time',
    description: 'Data da última atualização do registro.',
    readOnly: true,
  };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `/contracts/entities/${entity.slug}.schema.json`,
    title: entity.label,
    description: entity.description || `Contrato gerado para a entidade ${entity.label}.`,
    type: 'object',
    additionalProperties: false,
    properties,
    required,
    'x-apphub-table-name': entity.tableName,
    'x-apphub-entity-id': entity.id,
    'x-apphub-entity-status': entity.status,
  };
}

export function generateDataStudioContracts(snapshot: DataStudioSnapshot) {
  const entities = snapshot.entities.map((entity) => ({
    entity,
    schema: buildEntityJsonSchema(entity),
  }));

  const componentsSchemas = Object.fromEntries(
    entities.flatMap(({ entity, schema }) => {
      const baseName = toComponentName(entity);
      const createSchema = {
        ...schema,
        properties: Object.fromEntries(
          Object.entries((schema.properties as Record<string, JsonSchema>) || {}).filter(
            ([key]) => !['id', 'created_at', 'updated_at'].includes(key),
          ),
        ),
      };

      return [
        [baseName, schema],
        [`${baseName}Input`, createSchema],
      ];
    }),
  );

  const paths = Object.fromEntries(
    entities.flatMap(({ entity }) => {
      const baseName = toComponentName(entity);
      const collectionPath = `/api/ecommpanel/data-studio/entities/${entity.slug}/records`;
      const itemPath = `/api/ecommpanel/data-studio/entities/${entity.slug}/records/{recordId}`;
      const integrationCollectionPath = `/api/integration/v1/data/entities/${entity.slug}/records`;
      const integrationItemPath = `/api/integration/v1/data/entities/${entity.slug}/records/{recordId}`;

      return [
        [
          collectionPath,
          {
            get: {
              tags: ['Data Studio Entities'],
              summary: `Listar registros de ${entity.label}`,
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                },
                {
                  name: 'offset',
                  in: 'query',
                  schema: { type: 'integer', minimum: 0, default: 0 },
                },
              ],
              responses: {
                200: {
                  description: 'Lista paginada de registros.',
                },
              },
            },
            post: {
              tags: ['Data Studio Entities'],
              summary: `Criar registro em ${entity.label}`,
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['record'],
                      properties: {
                        record: { $ref: `#/components/schemas/${baseName}Input` },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Registro criado.',
                },
              },
            },
          },
        ],
        [
          itemPath,
          {
            get: {
              tags: ['Data Studio Entities'],
              summary: `Ler registro de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                200: {
                  description: 'Registro retornado com sucesso.',
                },
              },
            },
            put: {
              tags: ['Data Studio Entities'],
              summary: `Atualizar registro de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['record'],
                      properties: {
                        record: { $ref: `#/components/schemas/${baseName}Input` },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Registro atualizado.',
                },
              },
            },
            delete: {
              tags: ['Data Studio Entities'],
              summary: `Remover registro de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                200: {
                  description: 'Registro removido.',
                },
              },
            },
          },
        ],
        [
          integrationCollectionPath,
          {
            get: {
              tags: ['Integration Data API'],
              summary: `Listar registros externos de ${entity.label}`,
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                },
                {
                  name: 'offset',
                  in: 'query',
                  schema: { type: 'integer', minimum: 0, default: 0 },
                },
              ],
              responses: {
                200: {
                  description: 'Lista paginada de registros via API autenticada.',
                },
              },
            },
            post: {
              tags: ['Integration Data API'],
              summary: `Criar registro externo em ${entity.label}`,
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['record'],
                      properties: {
                        record: { $ref: `#/components/schemas/${baseName}Input` },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Registro criado pela API autenticada.',
                },
              },
            },
          },
        ],
        [
          integrationItemPath,
          {
            get: {
              tags: ['Integration Data API'],
              summary: `Ler registro externo de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                200: {
                  description: 'Registro retornado com sucesso pela API autenticada.',
                },
              },
            },
            put: {
              tags: ['Integration Data API'],
              summary: `Atualizar registro externo de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['record'],
                      properties: {
                        record: { $ref: `#/components/schemas/${baseName}Input` },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Registro atualizado pela API autenticada.',
                },
              },
            },
            delete: {
              tags: ['Integration Data API'],
              summary: `Remover registro externo de ${entity.label}`,
              parameters: [
                {
                  name: 'recordId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                200: {
                  description: 'Registro removido pela API autenticada.',
                },
              },
            },
          },
        ],
      ];
    }),
  );

  return {
    entities,
    openApi: {
      openapi: '3.1.0',
      info: {
        title: 'App Hub Data Studio Generated Contracts',
        version: String(snapshot.schemaVersion || 1),
        description: 'Contratos gerados a partir das entidades modeladas no Data Studio.',
      },
      servers: [{ url: '/' }],
      tags: [{ name: 'Data Studio Entities', description: 'CRUD interno protegido por sessão do painel.' }],
      paths,
      components: {
        schemas: componentsSchemas,
      },
    },
  };
}
