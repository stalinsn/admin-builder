import 'server-only';

import type { DataEntityDefinition, DataFieldDefinition } from '@/features/ecommpanel/types/dataStudio';

import { nowIso, randomToken } from './crypto';
import { getModeledEntityBySlug } from './dataEntityContracts';
import { getDataStudioSnapshot } from './dataStudioStore';
import { withPostgresClient } from './postgresRuntime';

type DataEntityRecord = Record<string, unknown>;

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Identificador inválido: ${value}`);
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function assertEntity(entitySlug: string): DataEntityDefinition {
  const entity = getModeledEntityBySlug(entitySlug, getDataStudioSnapshot());
  if (!entity) {
    throw new Error('Entidade não encontrada no Data Studio.');
  }

  return entity;
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

function normalizeFieldValue(field: DataFieldDefinition, value: unknown): unknown {
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

function normalizeInputRecord(entity: DataEntityDefinition, record: DataEntityRecord, mode: 'create' | 'update') {
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

async function ensureTableExists(entity: DataEntityDefinition): Promise<void> {
  const result = await withPostgresClient(async (client) => {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `;
    const response = await client.query<{ exists: boolean }>(query, [entity.tableName]);
    return response.rows[0]?.exists === true;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para operar registros da entidade.');
  }

  if (!result.value) {
    throw new Error(`A tabela ${entity.tableName} ainda não existe na base conectada.`);
  }
}

export async function listEntityRecords(entitySlug: string, options?: { limit?: number; offset?: number }) {
  const entity = assertEntity(entitySlug);
  await ensureTableExists(entity);

  const limit = Math.min(Math.max(options?.limit || 50, 1), 200);
  const offset = Math.max(options?.offset || 0, 0);

  const result = await withPostgresClient(async (client) => {
    const query = `
      SELECT *, COUNT(*) OVER() AS __total
      FROM public.${quoteIdentifier(entity.tableName)}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const response = await client.query<Record<string, unknown> & { __total: string | number }>(query, [limit, offset]);
    const total = Number(response.rows[0]?.__total || 0);
    return {
      rows: response.rows.map((row) => {
        const { __total, ...record } = row;
        return record;
      }),
      total,
    };
  });

  if (!result.available) {
    throw new Error('Banco indisponível para listar registros.');
  }

  return {
    entity,
    total: result.value.total,
    limit,
    offset,
    records: result.value.rows,
  };
}

export async function getEntityRecord(entitySlug: string, recordId: string) {
  const entity = assertEntity(entitySlug);
  await ensureTableExists(entity);

  const result = await withPostgresClient(async (client) => {
    const query = `SELECT * FROM public.${quoteIdentifier(entity.tableName)} WHERE id = $1 LIMIT 1`;
    const response = await client.query<Record<string, unknown>>(query, [recordId]);
    return response.rows[0] || null;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para ler o registro.');
  }

  if (!result.value) {
    throw new Error('Registro não encontrado.');
  }

  return {
    entity,
    record: result.value,
  };
}

export async function createEntityRecord(entitySlug: string, record: DataEntityRecord) {
  const entity = assertEntity(entitySlug);
  await ensureTableExists(entity);

  const normalized = normalizeInputRecord(entity, record, 'create');
  const recordId = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `${entity.slug}_${randomToken(6)}`;
  const createdAt = nowIso();

  const payload = {
    id: recordId,
    ...normalized,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  const result = await withPostgresClient(async (client) => {
    const query = `
      INSERT INTO public.${quoteIdentifier(entity.tableName)} (${columns.map(quoteIdentifier).join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const response = await client.query<Record<string, unknown>>(query, values);
    return response.rows[0];
  });

  if (!result.available) {
    throw new Error('Banco indisponível para criar o registro.');
  }

  return {
    entity,
    record: result.value,
  };
}

export async function updateEntityRecord(entitySlug: string, recordId: string, record: DataEntityRecord) {
  const entity = assertEntity(entitySlug);
  await ensureTableExists(entity);

  const normalized = normalizeInputRecord(entity, record, 'update');
  const assignments = Object.keys(normalized);

  if (!assignments.length) {
    return getEntityRecord(entitySlug, recordId);
  }

  const payload = {
    ...normalized,
    updated_at: nowIso(),
  };

  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const setClause = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ');

  const result = await withPostgresClient(async (client) => {
    const query = `
      UPDATE public.${quoteIdentifier(entity.tableName)}
      SET ${setClause}
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;
    const response = await client.query<Record<string, unknown>>(query, [...values, recordId]);
    return response.rows[0] || null;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para atualizar o registro.');
  }

  if (!result.value) {
    throw new Error('Registro não encontrado.');
  }

  return {
    entity,
    record: result.value,
  };
}

export async function deleteEntityRecord(entitySlug: string, recordId: string) {
  const entity = assertEntity(entitySlug);
  await ensureTableExists(entity);

  const result = await withPostgresClient(async (client) => {
    const query = `DELETE FROM public.${quoteIdentifier(entity.tableName)} WHERE id = $1 RETURNING id`;
    const response = await client.query<{ id: string }>(query, [recordId]);
    return response.rows[0] || null;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para remover o registro.');
  }

  if (!result.value) {
    throw new Error('Registro não encontrado.');
  }

  return {
    entity,
    deletedId: result.value.id,
  };
}
