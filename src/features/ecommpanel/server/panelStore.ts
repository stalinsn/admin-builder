import 'server-only';

import type { PoolClient } from 'pg';
import type {
  PanelAuditEvent,
  PanelLoginToken,
  PanelPermission,
  PanelResetToken,
  PanelRoleId,
  PanelSession,
  PanelUser,
  PanelUserRecord,
} from '@/features/ecommpanel/types/auth';

import { PANEL_SECURITY } from '../config/security';
import { nowIso, randomToken, sha256 } from './crypto';
import { hashPassword } from './password';
import * as mockStore from './mockStore';
import { resolvePostgresRuntime, type PostgresRuntime, withPostgresClient } from './postgresRuntime';

type PanelUserRow = {
  id: string;
  email: string;
  name: string;
  role_ids: unknown;
  permissions_allow: unknown;
  permissions_deny: unknown;
  active: boolean;
  must_change_password: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  last_login_at: string | Date | null;
  password_hash: string;
  failed_attempts: number;
  lock_until: string | Date | null;
};

type PanelSessionRow = {
  id: string;
  user_id: string;
  csrf_token: string;
  created_at: string | Date;
  hard_expires_at: string | Date;
  expires_at: string | Date;
  last_seen_at: string | Date;
  user_agent_hash: string;
  ip_hash: string;
};

type PanelResetTokenRow = {
  token: string;
  user_id: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
};

type PanelAuditEventRow = {
  id: string;
  actor_user_id: string | null;
  event: string;
  outcome: 'success' | 'failure';
  ip_hash: string | null;
  user_agent_hash: string | null;
  target: string | null;
  details: unknown;
  created_at: string | Date;
};

type PanelLoginTokenRow = {
  id: string;
  user_id: string;
  code_hash: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
  channel: 'email';
};

declare global {
  var __ECOMMPANEL_DB_SEEDED_KEYS__: Set<string> | undefined;
  var __ECOMMPANEL_DB_SCHEMA_READY_KEYS__: Set<string> | undefined;
}

const PANEL_SEED_VERSION = 'panel-users-v2';

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function parsePermissionList(value: unknown): PanelPermission[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is PanelPermission => typeof entry === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((entry): entry is PanelPermission => typeof entry === 'string') : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseRoleList(value: unknown): PanelRoleId[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is PanelRoleId => typeof entry === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((entry): entry is PanelRoleId => typeof entry === 'string') : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseDetails(value: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string | number | boolean | null>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string | number | boolean | null>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function mapUserRow(row: PanelUserRow): PanelUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleIds: parseRoleList(row.role_ids),
    permissionsAllow: parsePermissionList(row.permissions_allow),
    permissionsDeny: parsePermissionList(row.permissions_deny),
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) || nowIso(),
    updatedAt: toIso(row.updated_at) || nowIso(),
    lastLoginAt: toIso(row.last_login_at),
    passwordHash: row.password_hash,
    failedAttempts: Number(row.failed_attempts || 0),
    lockUntil: toIso(row.lock_until),
  };
}

function mapSessionRow(row: PanelSessionRow): PanelSession {
  return {
    id: row.id,
    userId: row.user_id,
    csrfToken: row.csrf_token,
    createdAt: toIso(row.created_at) || nowIso(),
    hardExpiresAt: toIso(row.hard_expires_at) || nowIso(),
    expiresAt: toIso(row.expires_at) || nowIso(),
    lastSeenAt: toIso(row.last_seen_at) || nowIso(),
    userAgentHash: row.user_agent_hash,
    ipHash: row.ip_hash,
  };
}

function mapResetTokenRow(row: PanelResetTokenRow): PanelResetToken {
  return {
    token: row.token,
    userId: row.user_id,
    createdAt: toIso(row.created_at) || nowIso(),
    expiresAt: toIso(row.expires_at) || nowIso(),
    usedAt: toIso(row.used_at),
  };
}

function mapAuditRow(row: PanelAuditEventRow): PanelAuditEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id || undefined,
    event: row.event,
    outcome: row.outcome,
    ipHash: row.ip_hash || undefined,
    userAgentHash: row.user_agent_hash || undefined,
    target: row.target || undefined,
    details: parseDetails(row.details),
    createdAt: toIso(row.created_at) || nowIso(),
  };
}

function mapLoginTokenRow(row: PanelLoginTokenRow): PanelLoginToken {
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    createdAt: toIso(row.created_at) || nowIso(),
    expiresAt: toIso(row.expires_at) || nowIso(),
    usedAt: toIso(row.used_at),
    channel: row.channel || 'email',
  };
}

async function withDbClient<T>(
  handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>,
): Promise<{ available: true; value: T } | { available: false }> {
  return withPostgresClient(handler);
}

function getSeedUsers(): Array<{
  id: string;
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  password: string;
}> {
  return [
    { id: 'usr-main-001', email: 'main@ecommpanel.local', name: 'Main Admin', roleIds: ['main_admin'], password: 'Admin@123456' },
    { id: 'usr-owner-001', email: 'stalinsn@hotmail.com', name: 'Dono da Loja', roleIds: ['store_owner'], password: 'Lojista@123456' },
    { id: 'usr-demo-001', email: 'demo@ecommpanel.local', name: 'Acesso Demo', roleIds: ['demo_operator'], password: 'Demo@123456' },
    { id: 'usr-author-001', email: 'author@ecommpanel.local', name: 'Autora Editorial', roleIds: ['content_author'], password: 'Conteudo@123456' },
    { id: 'usr-editor-001', email: 'editor@ecommpanel.local', name: 'Editor de Conteúdo', roleIds: ['content_editor'], password: 'Conteudo@123456' },
    { id: 'usr-publisher-001', email: 'publisher@ecommpanel.local', name: 'Publicador do Site', roleIds: ['content_publisher'], password: 'Conteudo@123456' },
    { id: 'usr-moderator-001', email: 'moderator@ecommpanel.local', name: 'Moderadora de Comentários', roleIds: ['comment_moderator'], password: 'Conteudo@123456' },
    { id: 'usr-catalog-manager-001', email: 'catalog@ecommpanel.local', name: 'Gestora de Catálogo', roleIds: ['catalog_manager'], password: 'Catalogo@123456' },
    { id: 'usr-data-manager-001', email: 'data.manager@ecommpanel.local', name: 'Gestor de Dados', roleIds: ['data_manager'], password: 'Dados@123456' },
    { id: 'usr-data-editor-001', email: 'data.editor@ecommpanel.local', name: 'Operador de Dados', roleIds: ['data_editor'], password: 'Dados@123456' },
    { id: 'usr-data-viewer-001', email: 'data.viewer@ecommpanel.local', name: 'Leitora de Dados', roleIds: ['data_viewer'], password: 'Dados@123456' },
  ];
}

async function ensureDbSchema(runtime: PostgresRuntime): Promise<void> {
  const readyKeys = global.__ECOMMPANEL_DB_SCHEMA_READY_KEYS__ || new Set<string>();
  global.__ECOMMPANEL_DB_SCHEMA_READY_KEYS__ = readyKeys;
  if (readyKeys.has(runtime.key)) return;

  await withPostgresClient(async (client) => {
    const existing = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'panel_login_tokens'`,
    );

    if (Number(existing.rows[0]?.count || 0) > 0) {
      return;
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS panel_login_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ NULL,
        channel TEXT NOT NULL DEFAULT 'email'
      )`,
    );
    await client.query('CREATE INDEX IF NOT EXISTS idx_panel_login_tokens_user_id ON panel_login_tokens (user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_panel_login_tokens_expires_at ON panel_login_tokens (expires_at DESC)');
  });

  readyKeys.add(runtime.key);
}

export async function ensurePanelAuthSchemaRuntime(): Promise<'database' | 'mock'> {
  const runtime = resolvePostgresRuntime();
  if (!runtime) {
    return 'mock';
  }

  await ensureDbSchema(runtime);
  return 'database';
}

export function sanitizeUser(record: PanelUserRecord): PanelUser {
  const { passwordHash: _passwordHash, failedAttempts: _failedAttempts, lockUntil: _lockUntil, ...safeUser } = record;
  void _passwordHash;
  void _failedAttempts;
  void _lockUntil;
  return safeUser;
}

async function insertAuditEvent(client: PoolClient, event: Omit<PanelAuditEvent, 'id' | 'createdAt'>): Promise<void> {
  await client.query(
    `INSERT INTO panel_audit_events (
      id, actor_user_id, event, outcome, ip_hash, user_agent_hash, target, details, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
    [
      randomToken(8),
      event.actorUserId || null,
      event.event,
      event.outcome,
      event.ipHash || null,
      event.userAgentHash || null,
      event.target || null,
      JSON.stringify(event.details || null),
    ],
  );
}

export async function ensureSeededUsers(): Promise<void> {
  const runtime = resolvePostgresRuntime();
  if (!runtime) {
    await mockStore.ensureSeededUsers();
    return;
  }

  await ensureDbSchema(runtime);

  const seededKeys = global.__ECOMMPANEL_DB_SEEDED_KEYS__ || new Set<string>();
  global.__ECOMMPANEL_DB_SEEDED_KEYS__ = seededKeys;
  const seededKey = `${runtime.key}:${PANEL_SEED_VERSION}`;
  if (seededKeys.has(seededKey)) return;

  const result = await withDbClient(async (client) => {
    const existing = await client.query<{ id: string; email: string }>('SELECT id, email FROM panel_users');
    const existingIds = new Set(existing.rows.map((row) => row.id));
    const existingEmails = new Set(existing.rows.map((row) => row.email.trim().toLowerCase()));
    const missingSeeds = getSeedUsers().filter((seed) => !existingIds.has(seed.id) && !existingEmails.has(seed.email));

    if (missingSeeds.length === 0) {
      seededKeys.add(seededKey);
      return;
    }

    await client.query('BEGIN');
    try {
      let insertedCount = 0;
      for (const seed of missingSeeds) {
        const passwordHash = await hashPassword(seed.password);
        const insertResult = await client.query(
          `INSERT INTO panel_users (
            id, email, name, role_ids, permissions_allow, permissions_deny,
            active, must_change_password, password_hash, failed_attempts, created_at, updated_at
          ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, TRUE, FALSE, $7, 0, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
          RETURNING id`,
          [seed.id, seed.email, seed.name, JSON.stringify(seed.roleIds), '[]', '[]', passwordHash],
        );
        insertedCount += insertResult.rowCount || 0;
      }

      await insertAuditEvent(client, {
        actorUserId: 'usr-main-001',
        event: 'seed.panel-users-synced',
        outcome: 'success',
        target: 'panel_users',
        details: {
          inserted: insertedCount,
        },
      });

      await client.query('COMMIT');
      seededKeys.add(seededKey);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    return true;
  });

  if (!result.available) {
    await mockStore.ensureSeededUsers();
  }
}

export async function getUserByEmail(email: string): Promise<PanelUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelUserRow>('SELECT * FROM panel_users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    return query.rows[0] ? mapUserRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.getUserByEmail(normalizedEmail);
}

export async function getUserById(userId: string): Promise<PanelUserRecord | null> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelUserRow>('SELECT * FROM panel_users WHERE id = $1 LIMIT 1', [userId]);
    return query.rows[0] ? mapUserRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.getUserById(userId);
}

export async function listUsers(): Promise<PanelUser[]> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelUserRow>('SELECT * FROM panel_users ORDER BY created_at DESC');
    return query.rows.map((row) => sanitizeUser(mapUserRow(row)));
  });

  return result.available ? result.value : mockStore.listUsers();
}

export async function createUser(input: {
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  active?: boolean;
  mustChangePassword?: boolean;
  permissionsAllow?: PanelPermission[];
  permissionsDeny?: PanelPermission[];
  passwordHash: string;
  actorUserId?: string;
}): Promise<PanelUser> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelUserRow>(
      `INSERT INTO panel_users (
        id, email, name, role_ids, permissions_allow, permissions_deny,
        active, must_change_password, password_hash, failed_attempts, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, 0, NOW(), NOW())
      RETURNING *`,
      [
        `usr-${randomToken(6)}`,
        input.email.trim().toLowerCase(),
        input.name.trim(),
        JSON.stringify(input.roleIds),
        JSON.stringify(input.permissionsAllow || []),
        JSON.stringify(input.permissionsDeny || []),
        input.active !== undefined ? input.active : true,
        input.mustChangePassword !== undefined ? input.mustChangePassword : true,
        input.passwordHash,
      ],
    );

    await insertAuditEvent(client, {
      actorUserId: input.actorUserId,
      event: 'user.created',
      outcome: 'success',
      target: input.email.trim().toLowerCase(),
      details: {
        roles: input.roleIds.join(','),
        active: input.active !== undefined ? input.active : true,
        permissionsAllow: (input.permissionsAllow || []).length,
        permissionsDeny: (input.permissionsDeny || []).length,
      },
    });

    return sanitizeUser(mapUserRow(query.rows[0]));
  });

  return result.available ? result.value : mockStore.createUser(input);
}

export async function updateUser(input: {
  userId: string;
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  active: boolean;
  permissionsAllow?: PanelPermission[];
  permissionsDeny?: PanelPermission[];
  passwordHash?: string;
  actorUserId?: string;
}): Promise<PanelUser | null> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelUserRow>(
      `UPDATE panel_users
       SET email = $2,
           name = $3,
           role_ids = $4::jsonb,
           active = $5,
           permissions_allow = $6::jsonb,
           permissions_deny = $7::jsonb,
           password_hash = COALESCE($8, password_hash),
           must_change_password = CASE WHEN $8 IS NULL THEN must_change_password ELSE TRUE END,
           failed_attempts = CASE WHEN $8 IS NULL THEN failed_attempts ELSE 0 END,
           lock_until = CASE WHEN $8 IS NULL THEN lock_until ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.userId,
        input.email.trim().toLowerCase(),
        input.name.trim(),
        JSON.stringify(input.roleIds),
        input.active,
        JSON.stringify(input.permissionsAllow || []),
        JSON.stringify(input.permissionsDeny || []),
        input.passwordHash || null,
      ],
    );

    if (!query.rows[0]) return null;

    await insertAuditEvent(client, {
      actorUserId: input.actorUserId,
      event: 'user.updated',
      outcome: 'success',
      target: input.email.trim().toLowerCase(),
      details: {
        roles: input.roleIds.join(','),
        active: input.active,
        permissionsAllow: (input.permissionsAllow || []).length,
        permissionsDeny: (input.permissionsDeny || []).length,
        passwordReset: Boolean(input.passwordHash),
      },
    });

    return sanitizeUser(mapUserRow(query.rows[0]));
  });

  return result.available ? result.value : mockStore.updateUser(input);
}

export async function deleteUser(input: { userId: string; actorUserId?: string }): Promise<boolean> {
  const result = await withDbClient(async (client) => {
    const existing = await client.query<PanelUserRow>('SELECT * FROM panel_users WHERE id = $1 LIMIT 1', [input.userId]);
    const target = existing.rows[0];
    if (!target) return false;

    await client.query('DELETE FROM panel_users WHERE id = $1', [input.userId]);

    await insertAuditEvent(client, {
      actorUserId: input.actorUserId,
      event: 'user.deleted',
      outcome: 'success',
      target: target.email,
      details: {
        userId: input.userId,
      },
    });

    return true;
  });

  return result.available ? result.value : mockStore.deleteUser(input);
}

export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
  const result = await withDbClient(async (client) => {
    await client.query(
      `UPDATE panel_users
       SET password_hash = $2,
           must_change_password = FALSE,
           failed_attempts = 0,
           lock_until = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, passwordHash],
    );
  });

  if (!result.available) {
    mockStore.setUserPassword(userId, passwordHash);
  }
}

export async function recordFailedLogin(userId: string): Promise<{ locked: boolean; lockUntil?: string }> {
  const user = await getUserById(userId);
  if (!user) return { locked: false };

  const nextAttempts = user.failedAttempts + 1;
  const lockUntil = nextAttempts >= PANEL_SECURITY.loginMaxAttempts ? new Date(Date.now() + PANEL_SECURITY.loginLockMs).toISOString() : undefined;

  const result = await withDbClient(async (client) => {
    await client.query(
      `UPDATE panel_users
       SET failed_attempts = $2,
           lock_until = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, nextAttempts, lockUntil || null],
    );

    return { locked: Boolean(lockUntil), lockUntil };
  });

  return result.available ? result.value : mockStore.recordFailedLogin(userId);
}

export async function resetFailedLogin(userId: string): Promise<void> {
  const result = await withDbClient(async (client) => {
    await client.query(
      `UPDATE panel_users
       SET failed_attempts = 0,
           lock_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  });

  if (!result.available) {
    mockStore.resetFailedLogin(userId);
  }
}

export function isUserLocked(user: PanelUserRecord): boolean {
  if (!user.lockUntil) return false;
  return Date.now() < new Date(user.lockUntil).getTime();
}

export async function createSession(input: {
  userId: string;
  userAgent: string;
  ip: string;
  hardTtlMs?: number;
}): Promise<{ session: PanelSession; rawSessionId: string }> {
  const result = await withDbClient(async (client) => {
    const rawSessionId = randomToken(24);
    const id = sha256(rawSessionId);
    const now = Date.now();
    const hardExpiresAt = new Date(now + (input.hardTtlMs || PANEL_SECURITY.sessionTtlMs)).toISOString();
    const session: PanelSession = {
      id,
      userId: input.userId,
      csrfToken: randomToken(16),
      createdAt: new Date(now).toISOString(),
      hardExpiresAt,
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: hardExpiresAt,
      userAgentHash: sha256(input.userAgent || 'unknown-ua'),
      ipHash: sha256(input.ip || 'unknown-ip'),
    };

    await client.query(
      `INSERT INTO panel_sessions (
        id, user_id, csrf_token, created_at, hard_expires_at, expires_at, last_seen_at, user_agent_hash, ip_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        session.id,
        session.userId,
        session.csrfToken,
        session.createdAt,
        session.hardExpiresAt,
        session.expiresAt,
        session.lastSeenAt,
        session.userAgentHash,
        session.ipHash,
      ],
    );

    return { session, rawSessionId };
  });

  return result.available ? result.value : mockStore.createSession(input);
}

export async function getSession(rawSessionId: string): Promise<PanelSession | null> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelSessionRow>('SELECT * FROM panel_sessions WHERE id = $1 LIMIT 1', [sha256(rawSessionId)]);
    return query.rows[0] ? mapSessionRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.getSession(rawSessionId);
}

export async function touchSession(rawSessionId: string): Promise<PanelSession | null> {
  const existing = await getSession(rawSessionId);
  if (!existing) return null;

  const now = Date.now();
  const hardExpiresAt = new Date(existing.hardExpiresAt || existing.expiresAt).getTime();
  if (hardExpiresAt <= now) {
    await deleteSession(rawSessionId);
    return null;
  }

  const nextExpiry = new Date(Math.min(hardExpiresAt, now + PANEL_SECURITY.sessionIdleTtlMs)).toISOString();
  const lastSeenAt = new Date(now).toISOString();

  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelSessionRow>(
      `UPDATE panel_sessions
       SET expires_at = $2, last_seen_at = $3
       WHERE id = $1
       RETURNING *`,
      [sha256(rawSessionId), nextExpiry, lastSeenAt],
    );
    return query.rows[0] ? mapSessionRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.touchSession(rawSessionId);
}

export async function deleteSession(rawSessionId: string): Promise<void> {
  const result = await withDbClient(async (client) => {
    await client.query('DELETE FROM panel_sessions WHERE id = $1', [sha256(rawSessionId)]);
  });

  if (!result.available) {
    mockStore.deleteSession(rawSessionId);
  }
}

export async function deleteSessionsByUser(userId: string): Promise<number> {
  const result = await withDbClient(async (client) => {
    const query = await client.query('DELETE FROM panel_sessions WHERE user_id = $1', [userId]);
    return query.rowCount || 0;
  });

  return result.available ? result.value : mockStore.deleteSessionsByUser(userId);
}

async function issueResetTokenRaw(userId: string): Promise<string> {
  const result = await withDbClient(async (client) => {
    const raw = randomToken(24);
    const token = sha256(raw);
    const now = Date.now();
    await client.query(
      `INSERT INTO panel_reset_tokens (token, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, userId, new Date(now).toISOString(), new Date(now + PANEL_SECURITY.resetPasswordTtlMs).toISOString()],
    );
    return raw;
  });

  if (result.available) return result.value;

  const user = mockStore.getUserById(userId);
  if (!user) return '';
  return mockStore.mockResetTokenForUser(user.email) || '';
}

export async function findResetTokenByRaw(rawToken: string): Promise<PanelResetToken | null> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelResetTokenRow>(
      `SELECT * FROM panel_reset_tokens
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [sha256(rawToken)],
    );
    return query.rows[0] ? mapResetTokenRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.findResetTokenByRaw(rawToken);
}

export async function consumeResetToken(rawToken: string): Promise<PanelResetToken | null> {
  const result = await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const query = await client.query<PanelResetTokenRow>(
        `SELECT * FROM panel_reset_tokens
         WHERE token = $1
         FOR UPDATE`,
        [sha256(rawToken)],
      );

      const token = query.rows[0] ? mapResetTokenRow(query.rows[0]) : null;
      if (!token || token.usedAt || Date.now() > new Date(token.expiresAt).getTime()) {
        await client.query('ROLLBACK');
        return null;
      }

      const update = await client.query<PanelResetTokenRow>(
        `UPDATE panel_reset_tokens
         SET used_at = NOW()
         WHERE token = $1
         RETURNING *`,
        [sha256(rawToken)],
      );

      await client.query('COMMIT');
      return update.rows[0] ? mapResetTokenRow(update.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : mockStore.consumeResetToken(rawToken);
}

function generateSixDigitCode(): string {
  return String(Number.parseInt(randomToken(3), 16) % 1000000).padStart(6, '0');
}

export async function getActiveLoginTokenByUserId(userId: string): Promise<PanelLoginToken | null> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelLoginTokenRow>(
      `SELECT *
       FROM panel_login_tokens
       WHERE user_id = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return query.rows[0] ? mapLoginTokenRow(query.rows[0]) : null;
  });

  return result.available ? result.value : mockStore.getActiveLoginTokenByUserId(userId);
}

export async function issueLoginTokenForUser(email: string): Promise<
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: 'user-not-found' | 'cooldown-active'; retryAfterSeconds?: number; expiresAt?: string }
> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) {
    return { ok: false, reason: 'user-not-found' };
  }

  const result = await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existingQuery = await client.query<PanelLoginTokenRow>(
        `SELECT *
         FROM panel_login_tokens
         WHERE user_id = $1
           AND used_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         FOR UPDATE`,
        [user.id],
      );

      const existingTokens = existingQuery.rows.map(mapLoginTokenRow);
      const newestToken = existingTokens[0] || null;
      const newestTokenAgeMs = newestToken ? Date.now() - new Date(newestToken.createdAt).getTime() : null;

      if (newestToken && newestTokenAgeMs !== null && newestTokenAgeMs < PANEL_SECURITY.loginTokenRequestCooldownMs) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((PANEL_SECURITY.loginTokenRequestCooldownMs - newestTokenAgeMs) / 1000),
        );

        await client.query('ROLLBACK');
        return {
          ok: false as const,
          reason: 'cooldown-active' as const,
          retryAfterSeconds,
          expiresAt: newestToken.expiresAt,
        };
      }

      if (existingTokens.length) {
        await client.query(
          `UPDATE panel_login_tokens
           SET used_at = NOW()
           WHERE user_id = $1
             AND used_at IS NULL
             AND expires_at > NOW()`,
          [user.id],
        );
      }

      const code = generateSixDigitCode();
      const expiresAt = new Date(Date.now() + PANEL_SECURITY.loginTokenTtlMs).toISOString();

      await client.query(
        `INSERT INTO panel_login_tokens (id, user_id, code_hash, created_at, expires_at, channel)
         VALUES ($1, $2, $3, NOW(), $4, 'email')`,
        [randomToken(8), user.id, sha256(code), expiresAt],
      );

      await client.query('COMMIT');
      return { ok: true as const, code, expiresAt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : mockStore.issueLoginTokenForUser(email);
}

export async function consumeLoginToken(email: string, code: string): Promise<PanelUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  const result = await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const userQuery = await client.query<PanelUserRow>('SELECT * FROM panel_users WHERE email = $1 AND active = TRUE LIMIT 1', [normalizedEmail]);
      const user = userQuery.rows[0] ? mapUserRow(userQuery.rows[0]) : null;
      if (!user) {
        await client.query('ROLLBACK');
        return null;
      }

      const tokenQuery = await client.query<PanelLoginTokenRow>(
        `SELECT *
         FROM panel_login_tokens
         WHERE user_id = $1
           AND used_at IS NULL
           AND expires_at > NOW()
           AND code_hash = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [user.id, sha256(normalizedCode)],
      );

      const token = tokenQuery.rows[0] ? mapLoginTokenRow(tokenQuery.rows[0]) : null;
      if (!token) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('UPDATE panel_login_tokens SET used_at = NOW() WHERE id = $1', [token.id]);
      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : mockStore.consumeLoginToken(normalizedEmail, normalizedCode);
}

async function addAuditEventAsync(event: Omit<PanelAuditEvent, 'id' | 'createdAt'>): Promise<void> {
  const result = await withDbClient(async (client) => {
    await insertAuditEvent(client, event);
  });

  if (!result.available) {
    mockStore.addAuditEvent(event);
  }
}

export function addAuditEvent(event: Omit<PanelAuditEvent, 'id' | 'createdAt'>): void {
  void addAuditEventAsync(event).catch(() => undefined);
}

export async function listAuditEvents(limit = 50): Promise<PanelAuditEvent[]> {
  const result = await withDbClient(async (client) => {
    const query = await client.query<PanelAuditEventRow>(
      `SELECT * FROM panel_audit_events ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return query.rows.map(mapAuditRow);
  });

  return result.available ? result.value : mockStore.listAuditEvents(limit);
}

export async function issueResetTokenForUser(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const raw = await issueResetTokenRaw(user.id);
  return raw || null;
}

export async function mockResetTokenForUser(email: string): Promise<string | null> {
  return issueResetTokenForUser(email);
}
