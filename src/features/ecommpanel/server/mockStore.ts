import 'server-only';

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  type PanelAuditEvent,
  type PanelLoginToken,
  type PanelPermission,
  type PanelResetToken,
  type PanelRoleId,
  type PanelSession,
  type PanelUser,
  type PanelUserRecord,
} from '../types/auth';
import { PANEL_SECURITY } from '../config/security';
import { nowIso, randomToken, sha256 } from './crypto';
import { hashPassword } from './password';

type MockDb = {
  users: Map<string, PanelUserRecord>;
  sessions: Map<string, PanelSession>;
  resetTokens: Map<string, PanelResetToken>;
  loginTokens: Map<string, PanelLoginToken>;
  auditLogs: PanelAuditEvent[];
  seeded: boolean;
};

type SerializedMockDb = {
  users: PanelUserRecord[];
  sessions: PanelSession[];
  resetTokens: PanelResetToken[];
  loginTokens: PanelLoginToken[];
  auditLogs: PanelAuditEvent[];
  seeded: boolean;
};

const MOCK_DB_PATH = join(process.cwd(), 'tmp', 'ecommpanel', 'panel-auth-store.json');

function createEmptyDb(): MockDb {
  return {
    users: new Map(),
    sessions: new Map(),
    resetTokens: new Map(),
    loginTokens: new Map(),
    auditLogs: [],
    seeded: false,
  };
}

function serializeDb(db: MockDb): SerializedMockDb {
  return {
    users: Array.from(db.users.values()),
    sessions: Array.from(db.sessions.values()),
    resetTokens: Array.from(db.resetTokens.values()),
    loginTokens: Array.from(db.loginTokens.values()),
    auditLogs: db.auditLogs,
    seeded: db.seeded,
  };
}

function hydrateDb(input?: Partial<SerializedMockDb> | null): MockDb {
  const db = createEmptyDb();

  for (const user of input?.users || []) {
    db.users.set(user.id, user);
  }

  for (const session of input?.sessions || []) {
    db.sessions.set(session.id, session);
  }

  for (const token of input?.resetTokens || []) {
    db.resetTokens.set(token.token, token);
  }

  for (const token of input?.loginTokens || []) {
    db.loginTokens.set(token.id, token);
  }

  db.auditLogs = Array.isArray(input?.auditLogs) ? input!.auditLogs! : [];
  db.seeded = Boolean(input?.seeded);
  return db;
}

function ensureMockDbDir(): void {
  mkdirSync(dirname(MOCK_DB_PATH), { recursive: true });
}

function cleanupDb(db: MockDb): boolean {
  let changed = false;
  const now = Date.now();

  for (const [id, session] of db.sessions.entries()) {
    const effectiveExpiry = new Date(session.hardExpiresAt || session.expiresAt).getTime();
    if (!Number.isFinite(effectiveExpiry) || effectiveExpiry > now) continue;
    db.sessions.delete(id);
    changed = true;
  }

  for (const [token, record] of db.resetTokens.entries()) {
    const expiry = new Date(record.expiresAt).getTime();
    if ((!record.usedAt && Number.isFinite(expiry) && expiry > now)) continue;
    db.resetTokens.delete(token);
    changed = true;
  }

  for (const [id, record] of db.loginTokens.entries()) {
    const expiry = new Date(record.expiresAt).getTime();
    if (!record.usedAt && Number.isFinite(expiry) && expiry > now) continue;
    db.loginTokens.delete(id);
    changed = true;
  }

  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
    changed = true;
  }

  return changed;
}

function readDb(): MockDb {
  if (!existsSync(MOCK_DB_PATH)) {
    return createEmptyDb();
  }

  try {
    const raw = readFileSync(MOCK_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as SerializedMockDb;
    const db = hydrateDb(parsed);
    if (cleanupDb(db)) {
      persistDb(db);
    }
    return db;
  } catch {
    return createEmptyDb();
  }
}

function persistDb(db: MockDb): void {
  cleanupDb(db);
  ensureMockDbDir();
  const tempPath = `${MOCK_DB_PATH}.tmp`;
  writeFileSync(tempPath, JSON.stringify(serializeDb(db), null, 2), 'utf-8');
  renameSync(tempPath, MOCK_DB_PATH);
}

function getDb(): MockDb {
  return readDb();
}

export function sanitizeUser(record: PanelUserRecord): PanelUser {
  const { passwordHash: _passwordHash, failedAttempts: _failedAttempts, lockUntil: _lockUntil, ...safeUser } = record;
  void _passwordHash;
  void _failedAttempts;
  void _lockUntil;
  return safeUser;
}

function pushAudit(db: MockDb, event: Omit<PanelAuditEvent, 'id' | 'createdAt'>): void {
  db.auditLogs.unshift({
    id: randomToken(8),
    createdAt: nowIso(),
    ...event,
  });
  if (db.auditLogs.length > 500) {
    db.auditLogs.length = 500;
  }
}

export async function ensureSeededUsers(): Promise<void> {
  const db = getDb();
  if (db.seeded && db.users.has('usr-demo-001')) return;

  const now = nowIso();
  const mainPasswordHash = await hashPassword('Admin@123456');
  const ownerPasswordHash = await hashPassword('Lojista@123456');
  const demoPasswordHash = await hashPassword('Demo@123456');
  const editorialPasswordHash = await hashPassword('Conteudo@123456');
  const dataPasswordHash = await hashPassword('Dados@123456');

  const seedUsers: PanelUserRecord[] = [
    {
      id: 'usr-main-001',
      email: 'main@ecommpanel.local',
      name: 'Main Admin',
      roleIds: ['main_admin'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: mainPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-owner-001',
      email: 'stalinsn@hotmail.com',
      name: 'Dono da Loja',
      roleIds: ['store_owner'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: ownerPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-demo-001',
      email: 'demo@ecommpanel.local',
      name: 'Acesso Demo',
      roleIds: ['demo_operator'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: demoPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-author-001',
      email: 'author@ecommpanel.local',
      name: 'Autora Editorial',
      roleIds: ['content_author'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: editorialPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-editor-001',
      email: 'editor@ecommpanel.local',
      name: 'Editor de Conteúdo',
      roleIds: ['content_editor'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: editorialPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-publisher-001',
      email: 'publisher@ecommpanel.local',
      name: 'Publicador do Site',
      roleIds: ['content_publisher'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: editorialPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-moderator-001',
      email: 'moderator@ecommpanel.local',
      name: 'Moderadora de Comentários',
      roleIds: ['comment_moderator'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: editorialPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-catalog-manager-001',
      email: 'catalog@ecommpanel.local',
      name: 'Gestora de Catálogo',
      roleIds: ['catalog_manager'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: await hashPassword('Catalogo@123456'),
      failedAttempts: 0,
    },
    {
      id: 'usr-data-manager-001',
      email: 'data.manager@ecommpanel.local',
      name: 'Gestor de Dados',
      roleIds: ['data_manager'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: dataPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-data-editor-001',
      email: 'data.editor@ecommpanel.local',
      name: 'Operador de Dados',
      roleIds: ['data_editor'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: dataPasswordHash,
      failedAttempts: 0,
    },
    {
      id: 'usr-data-viewer-001',
      email: 'data.viewer@ecommpanel.local',
      name: 'Leitora de Dados',
      roleIds: ['data_viewer'],
      permissionsAllow: [],
      permissionsDeny: [],
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: dataPasswordHash,
      failedAttempts: 0,
    },
  ];

  for (const user of seedUsers) {
    db.users.set(user.id, db.users.get(user.id) || user);
  }
  db.seeded = true;

  if (db.auditLogs.length === 0) {
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.main-user-created',
      outcome: 'success',
      target: 'main@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.store-owner-created',
      outcome: 'success',
      target: 'stalinsn@hotmail.com',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.demo-user-created',
      outcome: 'success',
      target: 'demo@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.editorial-author-created',
      outcome: 'success',
      target: 'author@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.editorial-editor-created',
      outcome: 'success',
      target: 'editor@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.editorial-publisher-created',
      outcome: 'success',
      target: 'publisher@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.editorial-moderator-created',
      outcome: 'success',
      target: 'moderator@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.catalog-manager-created',
      outcome: 'success',
      target: 'catalog@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.data-manager-created',
      outcome: 'success',
      target: 'data.manager@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.data-editor-created',
      outcome: 'success',
      target: 'data.editor@ecommpanel.local',
    });
    pushAudit(db, {
      actorUserId: 'usr-main-001',
      event: 'seed.data-viewer-created',
      outcome: 'success',
      target: 'data.viewer@ecommpanel.local',
    });
  }

  persistDb(db);
}

export function getUserByEmail(email: string): PanelUserRecord | null {
  const db = getDb();
  const target = email.trim().toLowerCase();
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === target) return user;
  }
  return null;
}

export function getUserById(userId: string): PanelUserRecord | null {
  const db = getDb();
  return db.users.get(userId) || null;
}

export function listUsers(): PanelUser[] {
  const db = getDb();
  return Array.from(db.users.values())
    .map(sanitizeUser)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createUser(input: {
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  active?: boolean;
  mustChangePassword?: boolean;
  permissionsAllow?: PanelPermission[];
  permissionsDeny?: PanelPermission[];
  passwordHash: string;
  actorUserId?: string;
}): PanelUser {
  const db = getDb();
  const now = nowIso();
  const id = `usr-${randomToken(6)}`;
  const user: PanelUserRecord = {
    id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    roleIds: input.roleIds,
    permissionsAllow: input.permissionsAllow || [],
    permissionsDeny: input.permissionsDeny || [],
    active: input.active !== undefined ? input.active : true,
    mustChangePassword: input.mustChangePassword !== undefined ? input.mustChangePassword : true,
    createdAt: now,
    updatedAt: now,
    passwordHash: input.passwordHash,
    failedAttempts: 0,
  };

  db.users.set(id, user);
  pushAudit(db, {
    actorUserId: input.actorUserId,
    event: 'user.created',
    outcome: 'success',
    target: user.email,
    details: {
      roles: user.roleIds.join(','),
      active: user.active,
      permissionsAllow: user.permissionsAllow.length,
      permissionsDeny: user.permissionsDeny.length,
    },
  });
  persistDb(db);
  return sanitizeUser(user);
}

export function updateUser(input: {
  userId: string;
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  active: boolean;
  permissionsAllow?: PanelPermission[];
  permissionsDeny?: PanelPermission[];
  passwordHash?: string;
  actorUserId?: string;
}): PanelUser | null {
  const db = getDb();
  const found = db.users.get(input.userId);
  if (!found) return null;

  found.email = input.email.trim().toLowerCase();
  found.name = input.name.trim();
  found.roleIds = input.roleIds;
  found.active = input.active;
  found.permissionsAllow = input.permissionsAllow || [];
  found.permissionsDeny = input.permissionsDeny || [];
  found.updatedAt = nowIso();

  if (input.passwordHash) {
    found.passwordHash = input.passwordHash;
    found.mustChangePassword = true;
    found.failedAttempts = 0;
    found.lockUntil = undefined;
  }

  db.users.set(found.id, found);
  pushAudit(db, {
    actorUserId: input.actorUserId,
    event: 'user.updated',
    outcome: 'success',
    target: found.email,
    details: {
      roles: found.roleIds.join(','),
      active: found.active,
      permissionsAllow: found.permissionsAllow.length,
      permissionsDeny: found.permissionsDeny.length,
      passwordReset: Boolean(input.passwordHash),
    },
  });
  persistDb(db);
  return sanitizeUser(found);
}

export function deleteUser(input: { userId: string; actorUserId?: string }): boolean {
  const db = getDb();
  const found = db.users.get(input.userId);
  if (!found) return false;

  db.users.delete(input.userId);

  for (const [sessionId, session] of db.sessions.entries()) {
    if (session.userId === input.userId) db.sessions.delete(sessionId);
  }
  for (const [tokenId, token] of db.resetTokens.entries()) {
    if (token.userId === input.userId) db.resetTokens.delete(tokenId);
  }
  for (const [tokenId, token] of db.loginTokens.entries()) {
    if (token.userId === input.userId) db.loginTokens.delete(tokenId);
  }

  pushAudit(db, {
    actorUserId: input.actorUserId,
    event: 'user.deleted',
    outcome: 'success',
    target: found.email,
    details: {
      userId: input.userId,
    },
  });

  persistDb(db);
  return true;
}

export function setUserPassword(userId: string, passwordHash: string): void {
  const db = getDb();
  const found = db.users.get(userId);
  if (!found) return;
  found.passwordHash = passwordHash;
  found.mustChangePassword = false;
  found.updatedAt = nowIso();
  found.failedAttempts = 0;
  found.lockUntil = undefined;
  db.users.set(found.id, found);
  persistDb(db);
}

export function recordFailedLogin(userId: string): { locked: boolean; lockUntil?: string } {
  const db = getDb();
  const found = db.users.get(userId);
  if (!found) return { locked: false };

  found.failedAttempts += 1;
  found.updatedAt = nowIso();

  if (found.failedAttempts >= PANEL_SECURITY.loginMaxAttempts) {
    found.lockUntil = new Date(Date.now() + PANEL_SECURITY.loginLockMs).toISOString();
    db.users.set(found.id, found);
    persistDb(db);
    return { locked: true, lockUntil: found.lockUntil };
  }

  db.users.set(found.id, found);
  persistDb(db);
  return { locked: false };
}

export function resetFailedLogin(userId: string): void {
  const db = getDb();
  const found = db.users.get(userId);
  if (!found) return;
  found.failedAttempts = 0;
  found.lockUntil = undefined;
  found.lastLoginAt = nowIso();
  found.updatedAt = nowIso();
  db.users.set(found.id, found);
  persistDb(db);
}

export function isUserLocked(user: PanelUserRecord): boolean {
  if (!user.lockUntil) return false;
  return Date.now() < new Date(user.lockUntil).getTime();
}

export function createSession(input: {
  userId: string;
  userAgent: string;
  ip: string;
  hardTtlMs?: number;
}): { session: PanelSession; rawSessionId: string } {
  const db = getDb();
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

  db.sessions.set(id, session);
  persistDb(db);
  return { session, rawSessionId };
}

export function getSession(rawSessionId: string): PanelSession | null {
  const db = getDb();
  const session = db.sessions.get(sha256(rawSessionId)) || null;
  if (!session) return null;
  const expiry = new Date(session.hardExpiresAt || session.expiresAt).getTime();
  if (Number.isFinite(expiry) && expiry > Date.now()) return session;
  db.sessions.delete(session.id);
  persistDb(db);
  return null;
}

export function touchSession(rawSessionId: string): PanelSession | null {
  const db = getDb();
  const id = sha256(rawSessionId);
  const found = db.sessions.get(id);
  if (!found) return null;

  const now = Date.now();
  const hardExpiresAt = new Date(found.hardExpiresAt || found.expiresAt).getTime();
  if (hardExpiresAt <= now) {
    db.sessions.delete(id);
    persistDb(db);
    return null;
  }

  const newIdleExpiry = new Date(now + PANEL_SECURITY.sessionIdleTtlMs).getTime();
  found.lastSeenAt = new Date(now).toISOString();
  found.expiresAt = new Date(Math.min(hardExpiresAt, newIdleExpiry)).toISOString();
  db.sessions.set(id, found);
  persistDb(db);
  return found;
}

export function deleteSession(rawSessionId: string): void {
  const db = getDb();
  db.sessions.delete(sha256(rawSessionId));
  persistDb(db);
}

export function deleteSessionsByUser(userId: string): number {
  const db = getDb();
  let deleted = 0;
  for (const [id, session] of db.sessions.entries()) {
    if (session.userId !== userId) continue;
    db.sessions.delete(id);
    deleted += 1;
  }
  if (deleted > 0) {
    persistDb(db);
  }
  return deleted;
}

export function issueResetToken(userId: string): PanelResetToken {
  const db = getDb();
  const raw = randomToken(24);
  const token = sha256(raw);
  const now = Date.now();
  const record: PanelResetToken = {
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PANEL_SECURITY.resetPasswordTtlMs).toISOString(),
  };

  db.resetTokens.set(token, record);
  persistDb(db);
  return record;
}

export function findResetTokenByRaw(rawToken: string): PanelResetToken | null {
  const db = getDb();
  const hashed = sha256(rawToken);
  const token = db.resetTokens.get(hashed);
  if (!token) return null;
  if (token.usedAt) return null;
  if (Date.now() > new Date(token.expiresAt).getTime()) return null;
  return token;
}

export function consumeResetToken(rawToken: string): PanelResetToken | null {
  const db = getDb();
  const hashed = sha256(rawToken);
  const token = db.resetTokens.get(hashed);
  if (!token) return null;
  if (token.usedAt) return null;
  if (Date.now() > new Date(token.expiresAt).getTime()) return null;
  token.usedAt = nowIso();
  db.resetTokens.set(token.token, token);
  persistDb(db);
  return token;
}

export function getActiveLoginTokenByUserId(userId: string): PanelLoginToken | null {
  const db = getDb();
  const active = Array.from(db.loginTokens.values())
    .filter((token) => token.userId === userId && !token.usedAt && Date.now() <= new Date(token.expiresAt).getTime())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return active[0] || null;
}

export function issueLoginTokenForUser(email: string):
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: 'user-not-found' | 'cooldown-active'; retryAfterSeconds?: number; expiresAt?: string } {
  const db = getDb();
  const target = email.trim().toLowerCase();
  const user = Array.from(db.users.values()).find((entry) => entry.email.toLowerCase() === target);
  if (!user) {
    return { ok: false, reason: 'user-not-found' };
  }

  const existingTokens = Array.from(db.loginTokens.values())
    .filter((token) => token.userId === user.id && !token.usedAt && Date.now() <= new Date(token.expiresAt).getTime())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const newestToken = existingTokens[0];
  const newestTokenAgeMs = newestToken ? Date.now() - new Date(newestToken.createdAt).getTime() : null;

  if (newestToken && newestTokenAgeMs !== null && newestTokenAgeMs < PANEL_SECURITY.loginTokenRequestCooldownMs) {
    return {
      ok: false,
      reason: 'cooldown-active',
      retryAfterSeconds: Math.max(1, Math.ceil((PANEL_SECURITY.loginTokenRequestCooldownMs - newestTokenAgeMs) / 1000)),
      expiresAt: newestToken.expiresAt,
    };
  }

  for (const token of existingTokens) {
    token.usedAt = nowIso();
    db.loginTokens.set(token.id, token);
  }

  const rawCode = String(Number.parseInt(randomToken(3), 16) % 1000000).padStart(6, '0');
  const record: PanelLoginToken = {
    id: `login-${randomToken(6)}`,
    userId: user.id,
    codeHash: sha256(rawCode),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + PANEL_SECURITY.loginTokenTtlMs).toISOString(),
    channel: 'email',
  };

  db.loginTokens.set(record.id, record);
  persistDb(db);
  return { ok: true, code: rawCode, expiresAt: record.expiresAt };
}

export function consumeLoginToken(email: string, code: string): PanelUserRecord | null {
  const db = getDb();
  const target = email.trim().toLowerCase();
  const user = Array.from(db.users.values()).find((entry) => entry.email.toLowerCase() === target);
  if (!user) return null;

  const token = Array.from(db.loginTokens.values())
    .filter((entry) => entry.userId === user.id && !entry.usedAt && Date.now() <= new Date(entry.expiresAt).getTime())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .find((entry) => entry.codeHash === sha256(code.trim()));

  if (!token) return null;

  token.usedAt = nowIso();
  db.loginTokens.set(token.id, token);
  persistDb(db);
  return user;
}

export function addAuditEvent(event: Omit<PanelAuditEvent, 'id' | 'createdAt'>): void {
  const db = getDb();
  pushAudit(db, event);
  persistDb(db);
}

export function listAuditEvents(limit = 50): PanelAuditEvent[] {
  const db = getDb();
  return db.auditLogs.slice(0, limit);
}

export function mockResetTokenForUser(email: string): string | null {
  const db = getDb();
  const target = email.trim().toLowerCase();
  const user = Array.from(db.users.values()).find((entry) => entry.email.toLowerCase() === target);
  if (!user) return null;

  const raw = randomToken(24);
  const record: PanelResetToken = {
    token: sha256(raw),
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + PANEL_SECURITY.resetPasswordTtlMs).toISOString(),
  };

  db.resetTokens.set(record.token, record);
  persistDb(db);
  return raw;
}
