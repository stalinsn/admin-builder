import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { Pool, type PoolClient } from 'pg';

import type { DataConnectionProfile } from '@/features/ecommpanel/types/dataStudio';

import { nowIso } from './crypto';

type PersistedBootstrap = {
  activeConnectionId?: string;
  databaseProvisioned?: boolean;
  boilerplateProvisioned?: boolean;
};

type PersistedDataStudioSnapshot = {
  connections?: DataConnectionProfile[];
  bootstrap?: PersistedBootstrap;
};

export type PostgresRuntime = {
  key: string;
  connection: DataConnectionProfile;
  password: string;
};

type RuntimeMode = 'auto' | 'snapshot' | 'env';

const DATA_STUDIO_SNAPSHOT = path.join(process.cwd(), 'src/data/ecommpanel/data-studio/schema.json');

declare global {
  var __ECOMM_POSTGRES_POOLS__: Map<string, Pool> | undefined;
}

function parseRuntimeMode(value: string | undefined): RuntimeMode {
  if (value === 'snapshot') return 'snapshot';
  if (value === 'env') return 'env';
  return 'auto';
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveEnvRuntime(fallbackConnection?: DataConnectionProfile | null): PostgresRuntime | null {
  const password = process.env.APP_DB_PASSWORD?.trim();
  if (!password) return null;

  const host = process.env.APP_DB_HOST?.trim() || fallbackConnection?.host?.trim() || '';
  const database = process.env.APP_DB_NAME?.trim() || fallbackConnection?.database?.trim() || '';
  const username = process.env.APP_DB_USER?.trim() || fallbackConnection?.username?.trim() || '';

  if (!host || !database || !username) return null;

  const connection: DataConnectionProfile = {
    id: fallbackConnection?.id || 'env-runtime',
    label: process.env.APP_DB_LABEL?.trim() || fallbackConnection?.label || 'Runtime via ambiente',
    engine: 'postgresql',
    host,
    port: parsePort(process.env.APP_DB_PORT, fallbackConnection?.port || 5432),
    database,
    username,
    passwordReference: process.env.APP_DB_PASSWORD_REFERENCE?.trim() || fallbackConnection?.passwordReference || 'APP_DB_PASSWORD',
    appHostPattern: fallbackConnection?.appHostPattern || 'localhost',
    sslMode:
      process.env.APP_DB_SSL_MODE === 'require' || process.env.APP_DB_SSL_MODE === 'prefer' || process.env.APP_DB_SSL_MODE === 'disable'
        ? process.env.APP_DB_SSL_MODE
        : fallbackConnection?.sslMode || 'disable',
    provisioningMethod: fallbackConnection?.provisioningMethod || 'manual',
    sshHost: fallbackConnection?.sshHost || host,
    sshPort: fallbackConnection?.sshPort || 22,
    sshUsername: fallbackConnection?.sshUsername || 'root',
    adminDatabase: fallbackConnection?.adminDatabase || 'postgres',
    adminUsername: fallbackConnection?.adminUsername || 'postgres',
    adminPasswordReference: fallbackConnection?.adminPasswordReference || 'APP_DB_ADMIN_PASSWORD',
    notes: fallbackConnection?.notes || 'Conexao carregada diretamente de variaveis de ambiente.',
    active: true,
    reachability: fallbackConnection?.reachability || 'unknown',
    credentialStatus: fallbackConnection?.credentialStatus || 'unknown',
    createdAt: fallbackConnection?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  return {
    key: `${connection.host}:${connection.port}/${connection.database}:${connection.username}:${connection.sslMode}`,
    connection,
    password,
  };
}

export function resolvePostgresRuntime(): PostgresRuntime | null {
  const runtimeMode = parseRuntimeMode(process.env.ECOMMPANEL_DB_RUNTIME_MODE?.trim().toLowerCase());

  if (runtimeMode === 'env') {
    return resolveEnvRuntime();
  }

  if (!fs.existsSync(DATA_STUDIO_SNAPSHOT)) {
    return runtimeMode === 'auto' ? resolveEnvRuntime() : null;
  }

  try {
    const snapshot = JSON.parse(fs.readFileSync(DATA_STUDIO_SNAPSHOT, 'utf-8')) as PersistedDataStudioSnapshot;
    const connections = Array.isArray(snapshot.connections) ? snapshot.connections : [];
    const bootstrap = snapshot.bootstrap || {};
    const target =
      connections.find((connection) => connection.id === bootstrap.activeConnectionId) ||
      connections.find((connection) => connection.active) ||
      connections[0];

    if (!target || target.engine !== 'postgresql') {
      return runtimeMode === 'auto' ? resolveEnvRuntime() : null;
    }

    if (!bootstrap.databaseProvisioned || !bootstrap.boilerplateProvisioned) {
      return runtimeMode === 'auto' ? resolveEnvRuntime(target) : null;
    }

    const passwordReference = target.passwordReference?.trim();
    const password = passwordReference ? process.env[passwordReference]?.trim() : undefined;
    if (!password) {
      return runtimeMode === 'auto' ? resolveEnvRuntime(target) : null;
    }

    const envRuntime = resolveEnvRuntime(target);
    if (envRuntime) return envRuntime;

    return {
      key: `${target.host}:${target.port}/${target.database}:${target.username}:${target.sslMode}`,
      connection: target,
      password,
    };
  } catch {
    return runtimeMode === 'auto' ? resolveEnvRuntime() : null;
  }
}

function getPools(): Map<string, Pool> {
  if (!global.__ECOMM_POSTGRES_POOLS__) {
    global.__ECOMM_POSTGRES_POOLS__ = new Map();
  }

  return global.__ECOMM_POSTGRES_POOLS__;
}

function resetPool(key: string): void {
  const pool = getPools().get(key);
  if (!pool) return;
  void pool.end().catch(() => undefined);
  getPools().delete(key);
}

function getPool(runtime: PostgresRuntime): Pool {
  const pools = getPools();
  const existing = pools.get(runtime.key);
  if (existing) return existing;

  const pool = new Pool({
    host: runtime.connection.host,
    port: runtime.connection.port,
    database: runtime.connection.database,
    user: runtime.connection.username,
    password: runtime.password,
    max: 10,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
    ssl:
      runtime.connection.sslMode === 'require' || runtime.connection.sslMode === 'prefer'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  pools.set(runtime.key, pool);
  return pool;
}

export async function withPostgresClient<T>(
  handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>,
): Promise<{ available: true; value: T } | { available: false }> {
  const runtime = resolvePostgresRuntime();
  if (!runtime) return { available: false };

  const pool = getPool(runtime);

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    resetPool(runtime.key);
    return { available: false };
  }

  try {
    return {
      available: true,
      value: await handler(client, runtime),
    };
  } finally {
    client.release();
  }
}
