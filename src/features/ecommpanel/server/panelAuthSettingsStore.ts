import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import {
  PANEL_AUTH_SETTINGS_SCHEMA_VERSION,
  type PanelAuthSettings,
  type PanelAuthSettingsDiagnostics,
} from '@/features/ecommpanel/types/panelAuthSettings';
import {
  getPanelSettingFromDatabase,
  upsertPanelSettingInDatabase,
} from '@/features/ecommpanel/server/panelSettingsDatabaseStore';

type PanelAuthSettingsCache = {
  loaded: boolean;
  settings: PanelAuthSettings;
};

type PanelSettingsPersistenceMode = 'files' | 'hybrid' | 'database';

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/panel-settings');
const SETTINGS_FILE = path.join(ROOT_DIR, 'auth-mail.json');
const PANEL_AUTH_SETTINGS_KEY = 'panel-auth-settings';

declare global {
  var __ECOMMPANEL_AUTH_SETTINGS_CACHE__: PanelAuthSettingsCache | undefined;
  var __PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpFile, payload, 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value: unknown, fallback = '', maxLength = 160): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizePort(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 1), 65535);
}

export function createDefaultPanelAuthSettings(): PanelAuthSettings {
  return {
    schemaVersion: PANEL_AUTH_SETTINGS_SCHEMA_VERSION,
    updatedAt: nowIso(),
    transport: {
      enabled: true,
      host: process.env.PANEL_SMTP_HOST?.trim() || '',
      port: normalizePort(process.env.PANEL_SMTP_PORT, 587),
      secure: ['1', 'true', 'yes', 'on'].includes((process.env.PANEL_SMTP_SECURE || '').trim().toLowerCase()),
      smtpUser: process.env.PANEL_SMTP_USER?.trim() || '',
      smtpPasswordReference: process.env.PANEL_SMTP_PASSWORD_REFERENCE?.trim() || 'PANEL_SMTP_PASSWORD',
      tlsInsecure: ['1', 'true', 'yes', 'on'].includes((process.env.PANEL_SMTP_TLS_INSECURE || '').trim().toLowerCase()),
    },
    identity: {
      fromName: process.env.PANEL_MAIL_FROM_NAME?.trim() || 'Artmeta Panel',
      fromEmail: process.env.PANEL_MAIL_FROM_EMAIL?.trim() || process.env.PANEL_SMTP_USER?.trim() || '',
    },
    links: {
      baseUrl: process.env.PANEL_AUTH_BASE_URL?.trim() || '',
    },
    customerRegistration: {
      requireEmailVerification: true,
      blockDisposableEmailDomains: true,
      pendingRegistrationTtlMinutes: 30,
      extraBlockedDomains: '',
    },
  };
}

function getPanelSettingsPersistenceMode(): PanelSettingsPersistenceMode {
  const value = process.env.ECOM_PANEL_SETTINGS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Configurações do painel em modo database exigem PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

export function normalizePanelAuthSettings(input: unknown): PanelAuthSettings {
  const fallback = createDefaultPanelAuthSettings();
  const source = (input && typeof input === 'object' ? input : {}) as Partial<PanelAuthSettings> & {
    transport?: Partial<PanelAuthSettings['transport']>;
    identity?: Partial<PanelAuthSettings['identity']>;
    links?: Partial<PanelAuthSettings['links']>;
  };

  const transport: Partial<PanelAuthSettings['transport']> = source.transport ?? {};
  const identity: Partial<PanelAuthSettings['identity']> = source.identity ?? {};
  const links: Partial<PanelAuthSettings['links']> = source.links ?? {};
  const customerRegistration: Partial<PanelAuthSettings['customerRegistration']> = source.customerRegistration ?? {};

  const normalized: PanelAuthSettings = {
    schemaVersion: PANEL_AUTH_SETTINGS_SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    transport: {
      enabled: normalizeBoolean(transport.enabled, fallback.transport.enabled),
      host: normalizeString(transport.host, fallback.transport.host, 160),
      port: normalizePort(transport.port, fallback.transport.port),
      secure: normalizeBoolean(transport.secure, fallback.transport.secure),
      smtpUser: normalizeString(transport.smtpUser, fallback.transport.smtpUser, 160).toLowerCase(),
      smtpPasswordReference:
        normalizeString(transport.smtpPasswordReference, fallback.transport.smtpPasswordReference, 80).replace(/[^A-Z0-9_]/gi, '') ||
        'PANEL_SMTP_PASSWORD',
      tlsInsecure: normalizeBoolean(transport.tlsInsecure, fallback.transport.tlsInsecure),
    },
    identity: {
      fromName: normalizeString(identity.fromName, fallback.identity.fromName, 80) || 'Artmeta Panel',
      fromEmail: normalizeString(identity.fromEmail, fallback.identity.fromEmail, 160).toLowerCase(),
    },
    links: {
      baseUrl: normalizeString(links.baseUrl, fallback.links.baseUrl, 200),
    },
    customerRegistration: {
      requireEmailVerification: normalizeBoolean(
        customerRegistration.requireEmailVerification,
        fallback.customerRegistration.requireEmailVerification,
      ),
      blockDisposableEmailDomains: normalizeBoolean(
        customerRegistration.blockDisposableEmailDomains,
        fallback.customerRegistration.blockDisposableEmailDomains,
      ),
      pendingRegistrationTtlMinutes: Math.min(
        Math.max(
          typeof customerRegistration.pendingRegistrationTtlMinutes === 'number'
            ? Math.round(customerRegistration.pendingRegistrationTtlMinutes)
            : Number.parseInt(String(customerRegistration.pendingRegistrationTtlMinutes || ''), 10) || fallback.customerRegistration.pendingRegistrationTtlMinutes,
          5,
        ),
        180,
      ),
      extraBlockedDomains: normalizeString(
        customerRegistration.extraBlockedDomains,
        fallback.customerRegistration.extraBlockedDomains,
        4000,
      ),
    },
  };

  return normalized;
}

function getCache(): PanelAuthSettingsCache {
  if (!global.__ECOMMPANEL_AUTH_SETTINGS_CACHE__) {
    global.__ECOMMPANEL_AUTH_SETTINGS_CACHE__ = {
      loaded: false,
      settings: createDefaultPanelAuthSettings(),
    };
  }

  return global.__ECOMMPANEL_AUTH_SETTINGS_CACHE__;
}

function loadSettings(): void {
  const cache = getCache();
  if (cache.loaded) return;

  cache.loaded = true;
  cache.settings = normalizePanelAuthSettings(readJsonFile<PanelAuthSettings>(SETTINGS_FILE));
  writeJsonAtomic(SETTINGS_FILE, cache.settings);
}

export function getPanelAuthSettings(): PanelAuthSettings {
  loadSettings();
  return normalizePanelAuthSettings(getCache().settings);
}

export function updatePanelAuthSettings(input: unknown): PanelAuthSettings {
  loadSettings();
  const normalized = normalizePanelAuthSettings({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });
  const cache = getCache();
  cache.settings = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

export function getPanelAuthSettingsDiagnostics(settings = getPanelAuthSettings()): PanelAuthSettingsDiagnostics {
  const passwordReference = settings.transport.smtpPasswordReference || 'PANEL_SMTP_PASSWORD';
  const passwordResolved = Boolean(process.env[passwordReference]?.trim()) || Boolean(process.env.PANEL_SMTP_PASSWORD?.trim());
  const effectiveSmtpUser = settings.transport.smtpUser || process.env.PANEL_SMTP_USER?.trim() || '';
  const effectiveFromEmail = settings.identity.fromEmail || process.env.PANEL_MAIL_FROM_EMAIL?.trim() || effectiveSmtpUser;
  const mailEnabled = Boolean(
    settings.transport.enabled &&
      settings.transport.host &&
      effectiveSmtpUser &&
      effectiveFromEmail &&
      passwordResolved,
  );

  return {
    mailEnabled,
    smtpPasswordReferenceResolved: passwordResolved,
    effectiveFromEmail,
    effectiveSmtpUser,
  };
}

async function seedPanelAuthSettingsDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getPanelSettingsPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__ = seededKeys;
  const registryKey = `${runtime.key}:${PANEL_AUTH_SETTINGS_KEY}`;
  if (seededKeys.has(registryKey)) return;

  const current = await getPanelSettingFromDatabase<PanelAuthSettings>(PANEL_AUTH_SETTINGS_KEY);
  if (!current.available) return;

  if (current.value) {
    seededKeys.add(registryKey);
    return;
  }

  await upsertPanelSettingInDatabase(PANEL_AUTH_SETTINGS_KEY, getPanelAuthSettings());
  seededKeys.add(registryKey);
}

export async function getPanelAuthSettingsRuntime(): Promise<PanelAuthSettings> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return getPanelAuthSettings();

  await seedPanelAuthSettingsDatabaseFromFilesIfNeeded();
  const result = await getPanelSettingFromDatabase<PanelAuthSettings>(PANEL_AUTH_SETTINGS_KEY);
  if (mode === 'database') {
    return normalizePanelAuthSettings(
      requireDatabaseValue(result, 'ler configuracoes de auth e e-mail') || createDefaultPanelAuthSettings(),
    );
  }

  return result.available && result.value ? normalizePanelAuthSettings(result.value) : getPanelAuthSettings();
}

export async function updatePanelAuthSettingsRuntime(input: unknown): Promise<PanelAuthSettings> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return updatePanelAuthSettings(input);

  const normalized = normalizePanelAuthSettings({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });

  if (mode === 'database') {
    const result = await upsertPanelSettingInDatabase(PANEL_AUTH_SETTINGS_KEY, normalized);
    return normalizePanelAuthSettings(requireDatabaseValue(result, 'salvar configuracoes de auth e e-mail'));
  }

  const settings = updatePanelAuthSettings(normalized);
  await upsertPanelSettingInDatabase(PANEL_AUTH_SETTINGS_KEY, settings);
  return settings;
}

export async function getCustomerRegistrationSettingsRuntime() {
  const settings = await getPanelAuthSettingsRuntime();
  return settings.customerRegistration;
}

export async function getPanelAuthSettingsDiagnosticsRuntime(
  settings?: PanelAuthSettings,
): Promise<PanelAuthSettingsDiagnostics> {
  const resolvedSettings = settings || (await getPanelAuthSettingsRuntime());
  return getPanelAuthSettingsDiagnostics(resolvedSettings);
}
