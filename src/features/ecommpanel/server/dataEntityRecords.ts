import 'server-only';

import type { DataEntityDefinition, DataFieldDefinition } from '@/features/ecommpanel/types/dataStudio';

import { nowIso, randomToken } from './crypto';
import { getModeledEntityBySlug } from './dataEntityContracts';
import {
  ensureEntityTableExists,
  normalizeInputRecord,
  normalizeFieldValue,
  quoteIdentifier,
} from './dataEntityRuntime';
import { getDataStudioSnapshotResolved } from './dataStudioStore';
import { withPostgresClient } from './postgresRuntime';

type DataEntityRecord = Record<string, unknown>;
type CsvImportMode = 'append' | 'upsert';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

async function assertEntity(entitySlug: string): Promise<DataEntityDefinition> {
  const entity = getModeledEntityBySlug(entitySlug, await getDataStudioSnapshotResolved());
  if (!entity) {
    throw new Error('Entidade não encontrada no Data Studio.');
  }

  return entity;
}

export async function listEntityRecords(entitySlug: string, options?: { limit?: number; offset?: number }) {
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

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
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

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
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

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
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

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
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

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

export async function exportEntityRecordsCsv(entitySlug: string) {
  const entity = await assertEntity(entitySlug);
  const listing = await listEntityRecords(entitySlug, { limit: 2000, offset: 0 });
  const headers = ['id', ...entity.fields.map((field) => field.name), 'created_at', 'updated_at'];
  const csv = [
    headers.map(csvEscape).join(','),
    ...listing.records.map((record) =>
      headers.map((header) => csvEscape(normalizeCell(record[header]))).join(','),
    ),
  ].join('\n');

  return {
    entitySlug,
    entityLabel: entity.label,
    fileName: `${entity.slug}-records.csv`,
    rowCount: listing.records.length,
    generatedAt: nowIso(),
    csv,
  };
}

export async function importEntityRecordsCsv(
  entitySlug: string,
  input: { csvContent: string; mode: CsvImportMode },
) {
  const entity = await assertEntity(entitySlug);
  await ensureEntityTableExists(entity);

  const rows = parseCsv(input.csvContent.trim());
  if (rows.length < 2) {
    throw new Error('O CSV precisa conter cabeçalho e ao menos uma linha.');
  }

  const [headers, ...dataRows] = rows;
  const processedHeaders = headers.map((header) => header.trim());
  if (!processedHeaders.length) {
    throw new Error('Cabeçalho CSV inválido.');
  }

  let insertedRows = 0;
  let updatedRows = 0;

  for (const row of dataRows) {
    const record = Object.fromEntries(
      processedHeaders.map((header, index) => [header, row[index] ?? '']),
    );
    const recordId =
      typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
    const payload = Object.fromEntries(
      entity.fields
        .filter((field) => processedHeaders.includes(field.name))
        .map((field) => [field.name, record[field.name]]),
    );

    if (input.mode === 'upsert' && recordId) {
      try {
        await getEntityRecord(entitySlug, recordId);
        await updateEntityRecord(entitySlug, recordId, payload);
        updatedRows += 1;
        continue;
      } catch {
        // segue para criação quando o id não existir
      }
    }

    await createEntityRecord(entitySlug, recordId ? { id: recordId, ...payload } : payload);
    insertedRows += 1;
  }

  return {
    entitySlug,
    entityLabel: entity.label,
    mode: input.mode,
    processedRows: dataRows.length,
    insertedRows,
    updatedRows,
    importedAt: nowIso(),
  };
}
