import 'server-only';

import type { PoolClient } from 'pg';

import { randomToken, sha256 } from '@/features/ecommpanel/server/crypto';
import { verifyPassword, hashPassword } from '@/features/ecommpanel/server/password';
import { withPostgresClient, type PostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import type { ApiIntegrationScope } from '@/features/public-api/integration';

type ApiClientRow = {
  id: string;
  key_id: string;
  name: string;
  description: string | null;
  scopes_json: unknown;
  allowed_ips_json: unknown;
  active: boolean;
  expires_at: string | Date | null;
  last_used_at: string | Date | null;
  last_used_ip_hash: string | null;
  secret_hash: string;
  secret_hint: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ApiTokenRow = {
  id: string;
  client_id: string;
  token_hash: string;
  scopes_json: unknown;
  issued_at: string | Date;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  last_used_at: string | Date | null;
};

type ApiRequestLogRow = {
  id: string;
  client_id: string | null;
  key_id: string | null;
  route: string;
  method: string;
  status_code: number;
  scope: string | null;
  auth_mode: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  created_at: string | Date;
};

export type ApiClientSummary = {
  id: string;
  keyId: string;
  name: string;
  description?: string;
  scopes: ApiIntegrationScope[];
  allowedIps: string[];
  active: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  secretHint?: string;
};

export type ApiClientRecord = ApiClientSummary & {
  lastUsedIpHash?: string;
};

export type ApiClientUpsertInput = {
  clientId?: string;
  name: string;
  description?: string;
  scopes: ApiIntegrationScope[];
  allowedIps?: string[];
  active: boolean;
  expiresAt?: string;
};

export type ApiClientSecretPayload = {
  client: ApiClientRecord;
  keyId: string;
  secret: string;
};

export type ApiAccessTokenPayload = {
  accessToken: string;
  expiresAt: string;
  client: ApiClientRecord;
  scopes: ApiIntegrationScope[];
};

export type ApiRequestLogItem = {
  id: string;
  clientId?: string;
  keyId?: string;
  route: string;
  method: string;
  statusCode: number;
  scope?: string;
  authMode: string;
  createdAt: string;
};

declare global {
  var __ECOM_API_INTEGRATION_SCHEMA_READY_KEYS__: Set<string> | undefined;
}

const API_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseScopes(value: unknown): ApiIntegrationScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ApiIntegrationScope => typeof entry === 'string') as ApiIntegrationScope[];
}

function parseLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeIpRule(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 128);
}

function mapClient(row: ApiClientRow): ApiClientRecord {
  return {
    id: row.id,
    keyId: row.key_id,
    name: row.name,
    description: row.description || undefined,
    scopes: parseScopes(row.scopes_json),
    allowedIps: parseLines(row.allowed_ips_json),
    active: Boolean(row.active),
    expiresAt: toIso(row.expires_at),
    lastUsedAt: toIso(row.last_used_at),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    secretHint: row.secret_hint || undefined,
    lastUsedIpHash: row.last_used_ip_hash || undefined,
  };
}

function mapLog(row: ApiRequestLogRow): ApiRequestLogItem {
  return {
    id: row.id,
    clientId: row.client_id || undefined,
    keyId: row.key_id || undefined,
    route: row.route,
    method: row.method,
    statusCode: Number(row.status_code || 0),
    scope: row.scope || undefined,
    authMode: row.auth_mode,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
  };
}

async function ensureSchema(runtime: PostgresRuntime): Promise<void> {
  const readyKeys = global.__ECOM_API_INTEGRATION_SCHEMA_READY_KEYS__ || new Set<string>();
  global.__ECOM_API_INTEGRATION_SCHEMA_READY_KEYS__ = readyKeys;
  if (readyKeys.has(runtime.key)) return;

  await withPostgresClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_integration_clients (
        id TEXT PRIMARY KEY,
        key_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NULL,
        scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        allowed_ips_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMPTZ NULL,
        last_used_at TIMESTAMPTZ NULL,
        last_used_ip_hash TEXT NULL,
        secret_hash TEXT NOT NULL,
        secret_hint TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_integration_tokens (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES api_integration_clients(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ NULL,
        last_used_at TIMESTAMPTZ NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_integration_request_logs (
        id TEXT PRIMARY KEY,
        client_id TEXT NULL REFERENCES api_integration_clients(id) ON DELETE SET NULL,
        key_id TEXT NULL,
        route TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        scope TEXT NULL,
        auth_mode TEXT NOT NULL,
        ip_hash TEXT NULL,
        user_agent_hash TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_integration_clients_active ON api_integration_clients (active, updated_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_integration_tokens_client ON api_integration_tokens (client_id, expires_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_api_integration_logs_client ON api_integration_request_logs (client_id, created_at DESC)');
  });

  readyKeys.add(runtime.key);
}

async function withIntegrationDb<T>(handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>) {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureSchema(runtime);
    return handler(client, runtime);
  });
  return result;
}

export async function listApiClients(): Promise<ApiClientSummary[]> {
  const result = await withIntegrationDb(async (client) => {
    const query = await client.query<ApiClientRow>(
      `SELECT *
       FROM api_integration_clients
       ORDER BY updated_at DESC, created_at DESC`,
    );
    return query.rows.map(mapClient);
  });
  return result.available ? result.value : [];
}

export async function getApiClientById(clientId: string): Promise<ApiClientRecord | null> {
  const result = await withIntegrationDb(async (client) => {
    const query = await client.query<ApiClientRow>('SELECT * FROM api_integration_clients WHERE id = $1 LIMIT 1', [clientId]);
    return query.rows[0] ? mapClient(query.rows[0]) : null;
  });
  return result.available ? result.value : null;
}

async function saveClientSecret(client: PoolClient, row: ApiClientRow, secret: string): Promise<ApiClientSecretPayload> {
  return {
    client: mapClient(row),
    keyId: row.key_id,
    secret,
  };
}

export async function createApiClient(input: ApiClientUpsertInput): Promise<ApiClientSecretPayload | null> {
  const name = input.name.trim();
  if (!name || !input.scopes.length) return null;
  const secret = randomToken(24);
  const keyId = `ak_${randomToken(8)}`;
  const clientId = `api_${randomToken(6)}`;
  const secretHash = await hashPassword(secret);
  const secretHint = secret.slice(-6);
  const allowedIps = (input.allowedIps || []).map(normalizeIpRule).filter((entry): entry is string => Boolean(entry));

  const result = await withIntegrationDb(async (client) => {
    const query = await client.query<ApiClientRow>(
      `INSERT INTO api_integration_clients (
        id, key_id, name, description, scopes_json, allowed_ips_json, active, expires_at, secret_hash, secret_hint, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        clientId,
        keyId,
        name,
        input.description?.trim() || null,
        JSON.stringify(input.scopes),
        JSON.stringify(allowedIps),
        Boolean(input.active),
        input.expiresAt || null,
        secretHash,
        secretHint,
      ],
    );
    return saveClientSecret(client, query.rows[0], secret);
  });
  return result.available ? result.value : null;
}

export async function updateApiClient(input: ApiClientUpsertInput): Promise<ApiClientRecord | null> {
  if (!input.clientId) return null;
  const name = input.name.trim();
  if (!name || !input.scopes.length) return null;
  const allowedIps = (input.allowedIps || []).map(normalizeIpRule).filter((entry): entry is string => Boolean(entry));
  const result = await withIntegrationDb(async (client) => {
    const query = await client.query<ApiClientRow>(
      `UPDATE api_integration_clients
       SET name = $2,
           description = $3,
           scopes_json = $4::jsonb,
           allowed_ips_json = $5::jsonb,
           active = $6,
           expires_at = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.clientId,
        name,
        input.description?.trim() || null,
        JSON.stringify(input.scopes),
        JSON.stringify(allowedIps),
        Boolean(input.active),
        input.expiresAt || null,
      ],
    );
    return query.rows[0] ? mapClient(query.rows[0]) : null;
  });
  return result.available ? result.value : null;
}

export async function rotateApiClientSecret(clientId: string): Promise<ApiClientSecretPayload | null> {
  const secret = randomToken(24);
  const secretHash = await hashPassword(secret);
  const secretHint = secret.slice(-6);

  const result = await withIntegrationDb(async (client) => {
    await client.query(
      `UPDATE api_integration_tokens
       SET revoked_at = NOW()
       WHERE client_id = $1
         AND revoked_at IS NULL`,
      [clientId],
    );
    const query = await client.query<ApiClientRow>(
      `UPDATE api_integration_clients
       SET secret_hash = $2,
           secret_hint = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [clientId, secretHash, secretHint],
    );
    return query.rows[0] ? saveClientSecret(client, query.rows[0], secret) : null;
  });
  return result.available ? result.value : null;
}

export async function listApiLogs(limit = 80, clientId?: string): Promise<ApiRequestLogItem[]> {
  const result = await withIntegrationDb(async (client) => {
    const params: unknown[] = [];
    const where: string[] = [];
    if (clientId) {
      params.push(clientId);
      where.push(`client_id = $${params.length}`);
    }
    params.push(Math.max(1, Math.min(limit, 200)));
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = await client.query<ApiRequestLogRow>(
      `SELECT *
       FROM api_integration_request_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return query.rows.map(mapLog);
  });
  return result.available ? result.value : [];
}

export async function logApiIntegrationRequest(input: {
  clientId?: string | null;
  keyId?: string | null;
  route: string;
  method: string;
  statusCode: number;
  scope?: string | null;
  authMode: 'anonymous' | 'key' | 'token';
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<void> {
  await withIntegrationDb(async (client) => {
    await client.query(
      `INSERT INTO api_integration_request_logs (
        id, client_id, key_id, route, method, status_code, scope, auth_mode, ip_hash, user_agent_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        `ail_${randomToken(6)}`,
        input.clientId || null,
        input.keyId || null,
        input.route,
        input.method,
        input.statusCode,
        input.scope || null,
        input.authMode,
        input.ipHash ? sha256(input.ipHash) : null,
        input.userAgentHash ? sha256(input.userAgentHash) : null,
      ],
    );
  });
}

export async function issueApiAccessToken(input: {
  keyId: string;
  secret: string;
  ip?: string;
  userAgent?: string;
}): Promise<ApiAccessTokenPayload | null> {
  const result = await withIntegrationDb(async (client) => {
    const query = await client.query<ApiClientRow>(
      `SELECT *
       FROM api_integration_clients
       WHERE key_id = $1
       LIMIT 1`,
      [input.keyId.trim()],
    );
    const row = query.rows[0];
    if (!row || !row.active) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
    const allowedIps = parseLines(row.allowed_ips_json);
    if (allowedIps.length && input.ip && !allowedIps.includes(input.ip)) return null;
    const secretMatches = await verifyPassword(input.secret, row.secret_hash);
    if (!secretMatches) return null;

    const token = `itk_${randomToken(32)}`;
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + API_ACCESS_TOKEN_TTL_MS).toISOString();
    const scopes = parseScopes(row.scopes_json);
    await client.query(
      `INSERT INTO api_integration_tokens (
        id, client_id, token_hash, scopes_json, issued_at, expires_at
      ) VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)`,
      [`iat_${randomToken(6)}`, row.id, tokenHash, JSON.stringify(scopes), expiresAt],
    );
    await client.query(
      `UPDATE api_integration_clients
       SET last_used_at = NOW(),
           last_used_ip_hash = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, input.ip ? sha256(input.ip) : null],
    );

    return {
      accessToken: token,
      expiresAt,
      client: mapClient({
        ...row,
        last_used_at: new Date(),
        last_used_ip_hash: input.ip ? sha256(input.ip) : row.last_used_ip_hash,
      }),
      scopes,
    } satisfies ApiAccessTokenPayload;
  });
  return result.available ? result.value : null;
}

export async function resolveApiAccessToken(token: string): Promise<{
  client: ApiClientRecord;
  scopes: ApiIntegrationScope[];
} | null> {
  const result = await withIntegrationDb(async (client) => {
    const tokenHash = sha256(token.trim());
    const tokenQuery = await client.query<ApiTokenRow>(
      `SELECT *
       FROM api_integration_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    const tokenRow = tokenQuery.rows[0];
    if (!tokenRow) return null;

    const clientQuery = await client.query<ApiClientRow>(
      `SELECT *
       FROM api_integration_clients
       WHERE id = $1
       LIMIT 1`,
      [tokenRow.client_id],
    );
    const clientRow = clientQuery.rows[0];
    if (!clientRow || !clientRow.active) return null;
    if (clientRow.expires_at && new Date(clientRow.expires_at).getTime() <= Date.now()) return null;

    await client.query(`UPDATE api_integration_tokens SET last_used_at = NOW() WHERE id = $1`, [tokenRow.id]);
    await client.query(`UPDATE api_integration_clients SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1`, [clientRow.id]);

    return {
      client: mapClient({
        ...clientRow,
        last_used_at: new Date(),
      }),
      scopes: parseScopes(tokenRow.scopes_json),
    };
  });
  return result.available ? result.value : null;
}
