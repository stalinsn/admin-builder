import 'server-only';

import { getInternalDataDictionary } from '@/features/ecommpanel/server/dataDictionary';
import type {
  DataDatabaseTable,
  DataDatabaseTableColumn,
  DataTableCsvExport,
  DataTableCsvImportMode,
  DataTableCsvImportResult,
} from '@/features/ecommpanel/types/dataStudio';

import { withPostgresClient } from './postgresRuntime';

type TableMetadataRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  ordinal_position: number;
  is_primary_key: boolean;
};

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Identificador inválido: ${value}`);
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function sanitizeTableName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, '');
}

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

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim', 's'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  throw new Error(`Valor booleano inválido: ${value}`);
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

function coerceValue(rawValue: string, column: DataDatabaseTableColumn): unknown {
  if (rawValue === '') return null;

  const normalizedType = column.dataType.toLowerCase();

  if (
    normalizedType === 'smallint' ||
    normalizedType === 'integer' ||
    normalizedType === 'bigint'
  ) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) throw new Error(`Valor inteiro inválido em ${column.name}: ${rawValue}`);
    return parsed;
  }

  if (
    normalizedType === 'numeric' ||
    normalizedType === 'decimal' ||
    normalizedType === 'real' ||
    normalizedType === 'double precision'
  ) {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) throw new Error(`Valor numérico inválido em ${column.name}: ${rawValue}`);
    return parsed;
  }

  if (normalizedType === 'boolean') {
    return parseBoolean(rawValue);
  }

  if (
    normalizedType === 'json' ||
    normalizedType === 'jsonb' ||
    normalizedType === 'array'
  ) {
    try {
      return JSON.parse(rawValue);
    } catch {
      throw new Error(`JSON inválido em ${column.name}.`);
    }
  }

  if (
    normalizedType.includes('timestamp') ||
    normalizedType === 'date' ||
    normalizedType === 'time without time zone' ||
    normalizedType === 'time with time zone'
  ) {
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) throw new Error(`Data inválida em ${column.name}: ${rawValue}`);
    return date;
  }

  return rawValue;
}

function mapDictionaryTables() {
  const dictionary = getInternalDataDictionary();
  const systemMap = new Map(
    dictionary.systemTables.map((table) => [
      table.tableName,
      { label: table.label, description: table.description, source: 'system' as const },
    ]),
  );

  const modeledMap = new Map(
    dictionary.modeledEntities.map((entity) => [
      entity.tableName,
      { label: entity.label, description: entity.description, source: 'modeled' as const },
    ]),
  );

  return { systemMap, modeledMap };
}

async function queryDatabaseTables(): Promise<{ available: boolean; tables: DataDatabaseTable[] }> {
  const result = await withPostgresClient(async (client) => {
    const query = `
      WITH primary_keys AS (
        SELECT
          kcu.table_schema,
          kcu.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        INNER JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      )
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.ordinal_position,
        (pk.column_name IS NOT NULL) AS is_primary_key
      FROM information_schema.columns c
      INNER JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
      LEFT JOIN primary_keys pk
        ON pk.table_schema = c.table_schema
       AND pk.table_name = c.table_name
       AND pk.column_name = c.column_name
      WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position
    `;

    const { rows } = await client.query<TableMetadataRow>(query);
    const { systemMap, modeledMap } = mapDictionaryTables();
    const grouped = new Map<string, DataDatabaseTable>();

    for (const row of rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const dictionaryEntry = systemMap.get(row.table_name) || modeledMap.get(row.table_name);
      const dataType = row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type;

      if (!grouped.has(key)) {
        grouped.set(key, {
          schema: row.table_schema,
          tableName: row.table_name,
          label: dictionaryEntry?.label || row.table_name,
          description:
            dictionaryEntry?.description || 'Tabela operacional disponível na base PostgreSQL conectada.',
          source: dictionaryEntry?.source || 'database',
          primaryKey: [],
          columns: [],
        });
      }

      const table = grouped.get(key)!;
      const column: DataDatabaseTableColumn = {
        name: row.column_name,
        dataType,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default || undefined,
        ordinalPosition: row.ordinal_position,
        primaryKey: row.is_primary_key,
      };

      if (row.is_primary_key) {
        table.primaryKey.push(row.column_name);
      }

      table.columns.push(column);
    }

    return Array.from(grouped.values()).sort((left, right) => left.tableName.localeCompare(right.tableName));
  });

  if (!result.available) {
    return {
      available: false,
      tables: [],
    };
  }

  return {
    available: true,
    tables: result.value,
  };
}

export async function listDatabaseTables(): Promise<{ available: boolean; tables: DataDatabaseTable[] }> {
  return queryDatabaseTables();
}

export async function exportDatabaseTableCsv(tableName: string): Promise<DataTableCsvExport> {
  const sanitizedTableName = sanitizeTableName(tableName);
  if (!sanitizedTableName) {
    throw new Error('Tabela inválida para exportação.');
  }

  const { available, tables } = await queryDatabaseTables();
  if (!available) {
    throw new Error('Banco indisponível para exportação CSV.');
  }

  const target = tables.find((table) => table.tableName === sanitizedTableName);
  if (!target) {
    throw new Error('Tabela não encontrada na base conectada.');
  }

  const orderClause = target.primaryKey.length
    ? ` ORDER BY ${target.primaryKey.map(quoteIdentifier).join(', ')}`
    : '';

  const result = await withPostgresClient(async (client) => {
    const sql = `SELECT * FROM ${quoteIdentifier(target.schema)}.${quoteIdentifier(target.tableName)}${orderClause}`;
    const queryResult = await client.query<Record<string, unknown>>(sql);
    return queryResult.rows;
  });

  if (!result.available) {
    throw new Error('Banco indisponível para exportação CSV.');
  }

  const headers = target.columns.map((column) => column.name);
  const lines = [
    headers.map(csvEscape).join(','),
    ...result.value.map((row) =>
      headers
        .map((header) => csvEscape(normalizeCell(row[header])))
        .join(','),
    ),
  ];

  const generatedAt = new Date().toISOString();

  return {
    tableName: target.tableName,
    fileName: `${target.tableName}-${generatedAt.slice(0, 10)}.csv`,
    rowCount: result.value.length,
    generatedAt,
    csv: lines.join('\n'),
  };
}

export async function importDatabaseTableCsv(input: {
  tableName: string;
  csvContent: string;
  mode: DataTableCsvImportMode;
}): Promise<DataTableCsvImportResult> {
  const sanitizedTableName = sanitizeTableName(input.tableName);
  if (!sanitizedTableName) {
    throw new Error('Tabela inválida para importação.');
  }

  const { available, tables } = await queryDatabaseTables();
  if (!available) {
    throw new Error('Banco indisponível para importação CSV.');
  }

  const target = tables.find((table) => table.tableName === sanitizedTableName);
  if (!target) {
    throw new Error('Tabela não encontrada na base conectada.');
  }

  const rows = parseCsv(input.csvContent.trim());
  if (rows.length < 2) {
    throw new Error('O CSV precisa conter cabeçalho e pelo menos uma linha de dados.');
  }

  const headers = rows[0].map((header) => sanitizeTableName(header));
  if (headers.some((header) => !header)) {
    throw new Error('Cabeçalho CSV inválido.');
  }

  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    throw new Error(`Colunas duplicadas no CSV: ${duplicateHeaders.join(', ')}`);
  }

  const columnsByName = new Map(target.columns.map((column) => [column.name, column]));
  const invalidHeaders = headers.filter((header) => !columnsByName.has(header));
  if (invalidHeaders.length) {
    throw new Error(`Colunas não encontradas na tabela ${target.tableName}: ${invalidHeaders.join(', ')}`);
  }

  if (input.mode === 'upsert' && target.primaryKey.length === 0) {
    throw new Error('A tabela selecionada não possui chave primária; use o modo append.');
  }

  const result = await withPostgresClient(async (client) => {
    await client.query('BEGIN');

    try {
      let insertedRows = 0;
      let updatedRows = 0;

      for (const row of rows.slice(1)) {
        if (row.length === 1 && row[0] === '') continue;
        if (row.length !== headers.length) {
          throw new Error(`Linha CSV com ${row.length} colunas; esperado ${headers.length}.`);
        }

        const values = headers.map((header, index) => coerceValue(row[index] || '', columnsByName.get(header)!));
        const identifiers = headers.map(quoteIdentifier).join(', ');
        const placeholders = headers.map((_, index) => `$${index + 1}`).join(', ');

        if (input.mode === 'upsert') {
          const primaryKeys = target.primaryKey.map(quoteIdentifier).join(', ');
          const updateColumns = headers.filter((header) => !target.primaryKey.includes(header));

          const sql = updateColumns.length
            ? `
              INSERT INTO ${quoteIdentifier(target.schema)}.${quoteIdentifier(target.tableName)} (${identifiers})
              VALUES (${placeholders})
              ON CONFLICT (${primaryKeys}) DO UPDATE
              SET ${updateColumns.map((header) => `${quoteIdentifier(header)} = EXCLUDED.${quoteIdentifier(header)}`).join(', ')}
              RETURNING (xmax = 0) AS inserted
            `
            : `
              INSERT INTO ${quoteIdentifier(target.schema)}.${quoteIdentifier(target.tableName)} (${identifiers})
              VALUES (${placeholders})
              ON CONFLICT (${primaryKeys}) DO NOTHING
              RETURNING true AS inserted
            `;

          const queryResult = await client.query<{ inserted: boolean }>(sql, values);

          if (queryResult.rowCount === 0) continue;
          if (queryResult.rows[0]?.inserted) {
            insertedRows += 1;
          } else {
            updatedRows += 1;
          }
          continue;
        }

        await client.query(
          `INSERT INTO ${quoteIdentifier(target.schema)}.${quoteIdentifier(target.tableName)} (${identifiers}) VALUES (${placeholders})`,
          values,
        );
        insertedRows += 1;
      }

      await client.query('COMMIT');

      return {
        insertedRows,
        updatedRows,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (!result.available) {
    throw new Error('Banco indisponível para importação CSV.');
  }

  return {
    tableName: target.tableName,
    mode: input.mode,
    processedRows: rows.length - 1,
    insertedRows: result.value.insertedRows,
    updatedRows: result.value.updatedRows,
    importedAt: new Date().toISOString(),
  };
}
