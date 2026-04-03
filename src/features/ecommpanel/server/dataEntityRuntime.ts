import 'server-only';

import type {
  DataEntityDefinition,
  DataEntityRuntimeStatus,
  DataFieldDefinition,
  DataStudioRuntimeSummary,
} from '@/features/ecommpanel/types/dataStudio';

import { nowIso, randomToken } from './crypto';
import { withPostgresClient } from './postgresRuntime';
import { buildEntityReadScope, buildEntityWriteScope } from '@/features/public-api/integration';

type DataEntityRecord = Record<string, unknown>;

function assertIdentifier(value: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Identificador inválido: ${value}`);
  }
}

export function quoteIdentifier(value: string): string {
  assertIdentifier(value);
  return `"${value.replace(/"/g, '""')}"`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y', 'sim', 's'].includes(normalized)) return true;
    if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  }

  throw new Error(`Campo ${fieldName} precisa ser booleano.`);
}

function toDateString(value: unknown, fieldName: string, withTime: boolean): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new Error(`Campo ${fieldName} precisa ser uma data válida.`);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Campo ${fieldName} precisa ser uma data válida.`);
  }

  return withTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

export function normalizeFieldValue(field: DataFieldDefinition, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || value === '') {
    if (field.required) throw new Error(`Campo ${field.label} é obrigatório.`);
    return null;
  }

  switch (field.type) {
    case 'integer': {
      const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error(`Campo ${field.label} precisa ser um inteiro.`);
      }
      return parsed;
    }
    case 'number':
    case 'currency': {
      const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(parsed)) {
        throw new Error(`Campo ${field.label} precisa ser numérico.`);
      }
      return parsed;
    }
    case 'boolean':
      return toBoolean(value, field.label);
    case 'date':
      return toDateString(value, field.label, false);
    case 'datetime':
      return toDateString(value, field.label, true);
    case 'json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Campo ${field.label} precisa conter JSON válido.`);
        }
      }
      return value;
    default: {
      const normalized = String(value).trim();
      if (!normalized && field.required) {
        throw new Error(`Campo ${field.label} é obrigatório.`);
      }
      return normalized || null;
    }
  }
}

export function normalizeInputRecord(entity: DataEntityDefinition, record: DataEntityRecord, mode: 'create' | 'update') {
  const allowedFields = new Set(entity.fields.map((field) => field.name));
  const payloadKeys = Object.keys(record);
  const unknownFields = payloadKeys.filter((key) => key !== 'id' && !allowedFields.has(key));

  if (unknownFields.length) {
    throw new Error(`Campos não definidos na entidade ${entity.label}: ${unknownFields.join(', ')}`);
  }

  const normalizedEntries = entity.fields.flatMap((field) => {
    const value = normalizeFieldValue(field, record[field.name]);
    if (value === undefined) {
      if (mode === 'create' && field.required && !field.defaultValue) {
        throw new Error(`Campo ${field.label} é obrigatório.`);
      }
      return [];
    }
    return [[field.name, value] as const];
  });

  return Object.fromEntries(normalizedEntries);
}

function getPostgresColumnType(field: DataFieldDefinition): string {
  switch (field.type) {
    case 'integer':
      return 'integer';
    case 'number':
      return 'numeric';
    case 'currency':
      return 'numeric(14,2)';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'timestamptz';
    case 'json':
      return 'jsonb';
    default:
      return 'text';
  }
}

function getColumnDefaultSql(field: DataFieldDefinition): string | null {
  if (!field.defaultValue) return null;

  switch (field.type) {
    case 'integer': {
      const parsed = Number.parseInt(field.defaultValue, 10);
      return Number.isFinite(parsed) ? String(parsed) : null;
    }
    case 'number':
    case 'currency': {
      const parsed = Number.parseFloat(field.defaultValue);
      return Number.isFinite(parsed) ? String(parsed) : null;
    }
    case 'boolean': {
      try {
        return toBoolean(field.defaultValue, field.label) ? 'true' : 'false';
      } catch {
        return null;
      }
    }
    case 'json':
      return `${sqlString(field.defaultValue)}::jsonb`;
    case 'date':
    case 'datetime':
    case 'email':
    case 'url':
    case 'slug':
    case 'rich_text':
    case 'reference':
    case 'text':
    default:
      return sqlString(field.defaultValue);
  }
}

export async function ensureEntityTableExists(entity: DataEntityDefinition): Promise<void> {
  const result = await withPostgresClient(async (client) => {
    const response = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists
      `,
      [entity.tableName],
    );
    return response.rows[0]?.exists === true;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para operar registros da entidade.');
  }

  if (!result.value) {
    throw new Error(`A tabela ${entity.tableName} ainda não existe na base conectada.`);
  }
}

export async function syncEntityPhysicalTable(entity: DataEntityDefinition): Promise<{ available: boolean; createdColumns: string[] }> {
  const result = await withPostgresClient(async (client) => {
    const createdColumns: string[] = [];

    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.${quoteIdentifier(entity.tableName)} (
          id text PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const columnsResponse = await client.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
        `,
        [entity.tableName],
      );

      const existingColumns = new Set(columnsResponse.rows.map((row) => row.column_name));

      for (const field of entity.fields) {
        if (!existingColumns.has(field.name)) {
          const typeSql = getPostgresColumnType(field);
          const defaultSql = getColumnDefaultSql(field);
          await client.query(
            `
              ALTER TABLE public.${quoteIdentifier(entity.tableName)}
              ADD COLUMN ${quoteIdentifier(field.name)} ${typeSql}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}
            `,
          );
          createdColumns.push(field.name);
        }

        if (field.unique) {
          await client.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(`ux_${entity.tableName}_${field.name}`)} ON public.${quoteIdentifier(entity.tableName)} (${quoteIdentifier(field.name)})`,
          );
        } else if (field.indexed) {
          await client.query(
            `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`ix_${entity.tableName}_${field.name}`)} ON public.${quoteIdentifier(entity.tableName)} (${quoteIdentifier(field.name)})`,
          );
        }
      }

      await client.query('COMMIT');
      return { createdColumns };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (!result.available) {
    return { available: false, createdColumns: [] };
  }

  return { available: true, createdColumns: result.value.createdColumns };
}

export async function upsertEntityRecords(entity: DataEntityDefinition, rows: DataEntityRecord[]) {
  await ensureEntityTableExists(entity);

  const result = await withPostgresClient(async (client) => {
    let insertedRows = 0;
    let updatedRows = 0;

    await client.query('BEGIN');
    try {
      for (const rawRecord of rows) {
        const recordId =
          typeof rawRecord.id === 'string' && rawRecord.id.trim() ? rawRecord.id.trim() : `${entity.slug}_${randomToken(6)}`;

        const existsResponse = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM public.${quoteIdentifier(entity.tableName)} WHERE id = $1) AS exists`,
          [recordId],
        );
        const exists = existsResponse.rows[0]?.exists === true;

        if (exists) {
          const payload = {
            ...normalizeInputRecord(entity, rawRecord, 'update'),
            updated_at: nowIso(),
          };

          const columns = Object.keys(payload);
          if (columns.length) {
            const values = Object.values(payload);
            const setClause = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ');
            await client.query(
              `
                UPDATE public.${quoteIdentifier(entity.tableName)}
                SET ${setClause}
                WHERE id = $${columns.length + 1}
              `,
              [...values, recordId],
            );
          }
          updatedRows += 1;
          continue;
        }

        const timestamp = nowIso();
        const payload = {
          id: recordId,
          ...normalizeInputRecord(entity, rawRecord, 'create'),
          created_at: timestamp,
          updated_at: timestamp,
        };
        const columns = Object.keys(payload);
        const values = Object.values(payload);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

        await client.query(
          `
            INSERT INTO public.${quoteIdentifier(entity.tableName)} (${columns.map(quoteIdentifier).join(', ')})
            VALUES (${placeholders})
          `,
          values,
        );
        insertedRows += 1;
      }

      await client.query('COMMIT');
      return { insertedRows, updatedRows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (!result.available) {
    throw new Error('Banco indisponível para importar os registros da entidade.');
  }

  return result.value;
}

export async function replaceEntityRecords(entity: DataEntityDefinition, rows: DataEntityRecord[]) {
  await ensureEntityTableExists(entity);

  const result = await withPostgresClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`DELETE FROM public.${quoteIdentifier(entity.tableName)}`);

      if (rows.length) {
        await client.query('COMMIT');
      } else {
        await client.query('COMMIT');
      }

      return { cleared: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (!result.available) {
    throw new Error('Banco indisponível para substituir os registros da entidade.');
  }

  if (rows.length) {
    await upsertEntityRecords(entity, rows);
  }

  return { replacedRows: rows.length };
}

function buildEntityRuntimePaths(entity: DataEntityDefinition) {
  return {
    schemaPath: `/contracts/entities/${entity.slug}.schema.json`,
    internalCollectionPath: `/api/ecommpanel/data-studio/entities/${entity.slug}/records`,
    internalItemPath: `/api/ecommpanel/data-studio/entities/${entity.slug}/records/{recordId}`,
    integrationCollectionPath: `/api/integration/v1/data/entities/${entity.slug}/records`,
    integrationItemPath: `/api/integration/v1/data/entities/${entity.slug}/records/{recordId}`,
    readScope: buildEntityReadScope(entity.slug),
    writeScope: buildEntityWriteScope(entity.slug),
  };
}

function buildUnavailableRuntime(entity: DataEntityDefinition, inspectedAt: string): DataEntityRuntimeStatus {
  return {
    entityId: entity.id,
    entitySlug: entity.slug,
    entityLabel: entity.label,
    tableName: entity.tableName,
    databaseAvailable: false,
    tableExists: false,
    modeledFieldCount: entity.fields.length,
    databaseColumnCount: 0,
    rowCount: 0,
    missingColumns: entity.fields.map((field) => field.name),
    extraColumns: [],
    inspectedAt,
    ...buildEntityRuntimePaths(entity),
  };
}

export async function inspectDataStudioRuntime(entities: DataEntityDefinition[]): Promise<DataStudioRuntimeSummary> {
  const inspectedAt = nowIso();

  const result = await withPostgresClient(async (client) => {
    const statuses: DataEntityRuntimeStatus[] = [];

    for (const entity of entities) {
      const columnsResponse = await client.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position ASC
        `,
        [entity.tableName],
      );

      const columnNames = columnsResponse.rows.map((row) => row.column_name);
      const userColumns = columnNames.filter((name) => !['id', 'created_at', 'updated_at'].includes(name));
      const modeledColumns = entity.fields.map((field) => field.name);
      const tableExists = columnNames.length > 0;
      const missingColumns = modeledColumns.filter((name) => !userColumns.includes(name));
      const extraColumns = userColumns.filter((name) => !modeledColumns.includes(name));

      let rowCount = 0;
      if (tableExists) {
        const rowCountResponse = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM public.${quoteIdentifier(entity.tableName)}`,
        );
        rowCount = Number.parseInt(rowCountResponse.rows[0]?.count || '0', 10);
      }

      statuses.push({
        entityId: entity.id,
        entitySlug: entity.slug,
        entityLabel: entity.label,
        tableName: entity.tableName,
        databaseAvailable: true,
        tableExists,
        modeledFieldCount: entity.fields.length,
        databaseColumnCount: userColumns.length,
        rowCount,
        missingColumns,
        extraColumns,
        inspectedAt,
        ...buildEntityRuntimePaths(entity),
      });
    }

    return statuses;
  });

  if (!result.available) {
    return {
      databaseAvailable: false,
      inspectedAt,
      entities: entities.map((entity) => buildUnavailableRuntime(entity, inspectedAt)),
    };
  }

  return {
    databaseAvailable: true,
    inspectedAt,
    entities: result.value,
  };
}
