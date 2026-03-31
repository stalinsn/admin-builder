import 'server-only';

import type { DataConnectionProfile } from '@/features/ecommpanel/types/dataStudio';

import { hashPassword } from './password';

type SshExecutionInput = {
  host: string;
  port: number;
  username: string;
  password: string;
  script: string;
};

export type DataProvisioningSecrets = {
  sshPassword: string;
  adminPassword: string;
  appPassword?: string;
  mainAdminName?: string;
  mainAdminEmail?: string;
  mainAdminPassword?: string;
};

export type DataProvisioningInspection = {
  engine: 'postgresql' | 'mysql';
  version: string;
  databaseExists: boolean;
  appUserExists: boolean;
  boilerplateApplied: boolean;
  seedAdminExists: boolean;
  message: string;
};

type ProvisioningResultSecrets = Required<
  Pick<DataProvisioningSecrets, 'sshPassword' | 'appPassword' | 'mainAdminName' | 'mainAdminEmail' | 'mainAdminPassword'>
> &
  Partial<Pick<DataProvisioningSecrets, 'adminPassword'>>;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function mysqlIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``;
}

function pgIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function mysqlCommandPrefix(connection: DataConnectionProfile, adminPassword: string): string {
  const host = connection.host || '127.0.0.1';
  const port = connection.port || 3306;
  const adminDatabase = connection.adminDatabase || 'mysql';
  const adminUsername = connection.adminUsername || 'root';

  return [
    `DB_CLI="$(command -v mysql || command -v mariadb)"`,
    `if [ -z "$DB_CLI" ]; then echo "Cliente mysql/mariadb não encontrado na VPS." >&2; exit 1; fi`,
    `DB_HOST=${shellQuote(host)}`,
    `DB_PORT=${shellQuote(String(port))}`,
    `DB_ADMIN_USER=${shellQuote(adminUsername)}`,
    `DB_ADMIN_DATABASE=${shellQuote(adminDatabase)}`,
    `DB_ADMIN_PASSWORD=${shellQuote(adminPassword)}`,
  ].join('\n');
}

function postgresCommandPrefix(connection: DataConnectionProfile): string {
  const adminDatabase = connection.adminDatabase || 'postgres';

  return [
    `DB_ADMIN_DATABASE=${shellQuote(adminDatabase)}`,
    'if command -v runuser >/dev/null 2>&1; then',
    '  run_as_postgres() { runuser -u postgres -- "$@"; }',
    'elif command -v sudo >/dev/null 2>&1; then',
    '  run_as_postgres() { sudo -u postgres -- "$@"; }',
    'else',
    '  echo "Nao foi possivel executar comandos como usuario postgres." >&2',
    '  exit 1',
    'fi',
    'psql_admin() { run_as_postgres psql -v ON_ERROR_STOP=1 "$@"; }',
    'createdb_admin() { run_as_postgres createdb "$@"; }',
  ].join('\n');
}

function privilegedShellPrelude(): string {
  return [
    'if [ "$(id -u)" = "0" ]; then',
    '  run_privileged() { "$@"; }',
    'elif command -v sudo >/dev/null 2>&1; then',
    '  run_privileged() { sudo "$@"; }',
    'else',
    '  echo "Este fluxo exige root ou um usuario com sudo." >&2',
    '  exit 1',
    'fi',
  ].join('\n');
}

async function runSshScript(input: SshExecutionInput): Promise<string> {
  const ssh2 = (eval('require') as NodeRequire)('ssh2') as { Client: new () => any };
  const client = new ssh2.Client();

  return await new Promise<string>((resolve, reject) => {
    let settled = false;

    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(error);
    };

    client
      .on('ready', () => {
        client.exec(input.script, (error: Error | undefined, stream: any) => {
          if (error) {
            finishError(error);
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('close', (code: number | undefined) => {
            if (settled) return;
            settled = true;
            client.end();

            if (code && code !== 0) {
              reject(new Error(stderr.trim() || `Falha remota com código ${code}.`));
              return;
            }

            resolve(stdout.trim());
          });

          stream.on('data', (chunk: Buffer | string) => {
            stdout += chunk.toString();
          });

          stream.stderr.on('data', (chunk: Buffer | string) => {
            stderr += chunk.toString();
          });
        });
      })
      .on('error', (error: Error) => {
        finishError(error);
      })
      .connect({
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        readyTimeout: 10000,
      });
  });
}

function parseCount(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildMysqlInspectionScript(connection: DataConnectionProfile, adminPassword: string, mainAdminEmail?: string): string {
  const userExistsQuery = `SELECT COUNT(*) FROM mysql.user WHERE user = ${sqlString(connection.username)} AND host = ${sqlString(
    connection.appHostPattern || 'localhost',
  )};`;
  const databaseExistsQuery = `SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ${sqlString(connection.database)};`;
  const boilerplateQuery = `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${sqlString(
    connection.database,
  )} AND TABLE_NAME IN ('panel_users', 'panel_sessions', 'panel_reset_tokens', 'panel_login_tokens', 'panel_audit_events');`;
  const seedAdminQuery = mainAdminEmail
    ? `SELECT COUNT(*) FROM ${mysqlIdentifier(connection.database)}.panel_users WHERE email = ${sqlString(mainAdminEmail.toLowerCase())};`
    : 'SELECT 0;';

  return `
set -e
${mysqlCommandPrefix(connection, adminPassword)}

VERSION="$($DB_CLI --version | head -n 1)"
DB_EXISTS="$(MYSQL_PWD="$DB_ADMIN_PASSWORD" "$DB_CLI" --protocol=TCP --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --database="$DB_ADMIN_DATABASE" --batch --skip-column-names --raw -e ${shellQuote(
    databaseExistsQuery,
  )})"
USER_EXISTS="$(MYSQL_PWD="$DB_ADMIN_PASSWORD" "$DB_CLI" --protocol=TCP --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --database="$DB_ADMIN_DATABASE" --batch --skip-column-names --raw -e ${shellQuote(
    userExistsQuery,
  )})"

if [ "$DB_EXISTS" = "0" ]; then
  BOILERPLATE_EXISTS="0"
  SEED_ADMIN_EXISTS="0"
else
  BOILERPLATE_EXISTS="$(MYSQL_PWD="$DB_ADMIN_PASSWORD" "$DB_CLI" --protocol=TCP --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --database="$DB_ADMIN_DATABASE" --batch --skip-column-names --raw -e ${shellQuote(
    boilerplateQuery,
  )})"
  if [ "$BOILERPLATE_EXISTS" = "5" ]; then
    SEED_ADMIN_EXISTS="$(MYSQL_PWD="$DB_ADMIN_PASSWORD" "$DB_CLI" --protocol=TCP --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --database="$DB_ADMIN_DATABASE" --batch --skip-column-names --raw -e ${shellQuote(
      seedAdminQuery,
    )})"
  else
    SEED_ADMIN_EXISTS="0"
  fi
fi

printf 'VERSION=%s\\n' "$VERSION"
printf 'DB_EXISTS=%s\\n' "$DB_EXISTS"
printf 'USER_EXISTS=%s\\n' "$USER_EXISTS"
printf 'BOILERPLATE_EXISTS=%s\\n' "$BOILERPLATE_EXISTS"
printf 'SEED_ADMIN_EXISTS=%s\\n' "$SEED_ADMIN_EXISTS"
`.trim();
}

function buildPostgresInspectionScript(connection: DataConnectionProfile, mainAdminEmail?: string): string {
  const databaseExistsQuery = `SELECT COUNT(*) FROM pg_database WHERE datname = ${sqlString(connection.database)};`;
  const userExistsQuery = `SELECT COUNT(*) FROM pg_roles WHERE rolname = ${sqlString(connection.username)};`;
  const boilerplateQuery = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('panel_users', 'panel_sessions', 'panel_reset_tokens', 'panel_login_tokens', 'panel_audit_events');`;
  const seedAdminQuery = mainAdminEmail
    ? `SELECT COUNT(*) FROM public.panel_users WHERE email = ${sqlString(mainAdminEmail.toLowerCase())};`
    : 'SELECT 0;';

  return `
set -e
${privilegedShellPrelude()}

if ! command -v psql >/dev/null 2>&1; then
  printf 'VERSION=%s\\n' 'PostgreSQL nao instalado'
  printf 'DB_EXISTS=0\\n'
  printf 'USER_EXISTS=0\\n'
  printf 'BOILERPLATE_EXISTS=0\\n'
  printf 'SEED_ADMIN_EXISTS=0\\n'
  exit 0
fi

run_privileged systemctl enable --now postgresql >/dev/null 2>&1 || run_privileged service postgresql start >/dev/null 2>&1 || true
${postgresCommandPrefix(connection)}

VERSION="$(psql --version | head -n 1)"
DB_EXISTS="$(psql_admin --dbname="$DB_ADMIN_DATABASE" --tuples-only --no-align --command ${shellQuote(databaseExistsQuery)} | tr -d '[:space:]')"
USER_EXISTS="$(psql_admin --dbname="$DB_ADMIN_DATABASE" --tuples-only --no-align --command ${shellQuote(userExistsQuery)} | tr -d '[:space:]')"

if [ "$DB_EXISTS" = "0" ]; then
  BOILERPLATE_EXISTS="0"
  SEED_ADMIN_EXISTS="0"
else
  BOILERPLATE_EXISTS="$(psql_admin --dbname=${shellQuote(connection.database)} --tuples-only --no-align --command ${shellQuote(boilerplateQuery)} | tr -d '[:space:]')"
  if [ "$BOILERPLATE_EXISTS" = "5" ]; then
    SEED_ADMIN_EXISTS="$(psql_admin --dbname=${shellQuote(connection.database)} --tuples-only --no-align --command ${shellQuote(seedAdminQuery)} | tr -d '[:space:]')"
  else
    SEED_ADMIN_EXISTS="0"
  fi
fi

printf 'VERSION=%s\\n' "$VERSION"
printf 'DB_EXISTS=%s\\n' "$DB_EXISTS"
printf 'USER_EXISTS=%s\\n' "$USER_EXISTS"
printf 'BOILERPLATE_EXISTS=%s\\n' "$BOILERPLATE_EXISTS"
printf 'SEED_ADMIN_EXISTS=%s\\n' "$SEED_ADMIN_EXISTS"
`.trim();
}

export function buildMysqlPanelBootstrapSql(input: {
  mainAdminName: string;
  mainAdminEmail: string;
  mainAdminPasswordHash: string;
}): string {
  const adminEmail = input.mainAdminEmail.trim().toLowerCase();
  const adminName = input.mainAdminName.trim();
  const adminId = 'usr-main-001';
  const now = 'CURRENT_TIMESTAMP';

  return [
    'CREATE TABLE IF NOT EXISTS panel_users (',
    '  id VARCHAR(64) PRIMARY KEY,',
    '  email VARCHAR(191) NOT NULL UNIQUE,',
    '  name VARCHAR(191) NOT NULL,',
    '  role_ids LONGTEXT NOT NULL,',
    '  permissions_allow LONGTEXT NOT NULL,',
    '  permissions_deny LONGTEXT NOT NULL,',
    '  active TINYINT(1) NOT NULL DEFAULT 1,',
    '  must_change_password TINYINT(1) NOT NULL DEFAULT 0,',
    '  password_hash TEXT NOT NULL,',
    '  failed_attempts INT NOT NULL DEFAULT 0,',
    '  lock_until DATETIME NULL,',
    `  created_at DATETIME NOT NULL DEFAULT ${now},`,
    `  updated_at DATETIME NOT NULL DEFAULT ${now} ON UPDATE ${now},`,
    '  last_login_at DATETIME NULL',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE IF NOT EXISTS panel_sessions (',
    '  id VARCHAR(128) PRIMARY KEY,',
    '  user_id VARCHAR(64) NOT NULL,',
    '  csrf_token VARCHAR(128) NOT NULL,',
    '  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  hard_expires_at DATETIME NOT NULL,',
    '  expires_at DATETIME NOT NULL,',
    '  last_seen_at DATETIME NOT NULL,',
    '  user_agent_hash VARCHAR(128) NOT NULL,',
    '  ip_hash VARCHAR(128) NOT NULL,',
    '  INDEX idx_panel_sessions_user_id (user_id),',
    '  CONSTRAINT fk_panel_sessions_user FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE IF NOT EXISTS panel_reset_tokens (',
    '  token VARCHAR(128) PRIMARY KEY,',
    '  user_id VARCHAR(64) NOT NULL,',
    '  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  expires_at DATETIME NOT NULL,',
    '  used_at DATETIME NULL,',
    '  INDEX idx_panel_reset_tokens_user_id (user_id),',
    '  CONSTRAINT fk_panel_reset_tokens_user FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE IF NOT EXISTS panel_login_tokens (',
    '  id VARCHAR(64) PRIMARY KEY,',
    '  user_id VARCHAR(64) NOT NULL,',
    '  code_hash VARCHAR(128) NOT NULL,',
    '  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  expires_at DATETIME NOT NULL,',
    '  used_at DATETIME NULL,',
    "  channel VARCHAR(32) NOT NULL DEFAULT 'email',",
    '  INDEX idx_panel_login_tokens_user_id (user_id),',
    '  CONSTRAINT fk_panel_login_tokens_user FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE IF NOT EXISTS panel_audit_events (',
    '  id VARCHAR(64) PRIMARY KEY,',
    '  actor_user_id VARCHAR(64) NULL,',
    '  event VARCHAR(191) NOT NULL,',
    "  outcome ENUM('success','failure') NOT NULL,",
    '  ip_hash VARCHAR(128) NULL,',
    '  user_agent_hash VARCHAR(128) NULL,',
    '  target VARCHAR(191) NULL,',
    '  details LONGTEXT NULL,',
    '  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  INDEX idx_panel_audit_events_actor_user_id (actor_user_id),',
    '  INDEX idx_panel_audit_events_created_at (created_at)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    `INSERT INTO panel_users (id, email, name, role_ids, permissions_allow, permissions_deny, active, must_change_password, password_hash, failed_attempts)
VALUES (${sqlString(adminId)}, ${sqlString(adminEmail)}, ${sqlString(adminName)}, ${sqlString('["main_admin"]')}, ${sqlString('[]')}, ${sqlString(
      '[]',
    )}, 1, 0, ${sqlString(input.mainAdminPasswordHash)}, 0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role_ids = VALUES(role_ids),
  permissions_allow = VALUES(permissions_allow),
  permissions_deny = VALUES(permissions_deny),
  active = 1,
  password_hash = VALUES(password_hash),
  must_change_password = 0,
  updated_at = CURRENT_TIMESTAMP;`,
    '',
    `INSERT INTO panel_audit_events (id, actor_user_id, event, outcome, target, details)
VALUES ('audit-bootstrap-main-admin', ${sqlString(adminId)}, 'bootstrap.main-admin.seeded', 'success', ${sqlString(
      adminEmail,
    )}, ${sqlString('{"source":"data-studio"}')})
ON DUPLICATE KEY UPDATE
  created_at = created_at;`,
  ].join('\n');
}

export function buildPostgresPanelBootstrapSql(input: {
  mainAdminName: string;
  mainAdminEmail: string;
  mainAdminPasswordHash: string;
}): string {
  const adminEmail = input.mainAdminEmail.trim().toLowerCase();
  const adminName = input.mainAdminName.trim();
  const adminId = 'usr-main-001';

  return [
    'CREATE TABLE IF NOT EXISTS panel_users (',
    '  id TEXT PRIMARY KEY,',
    '  email TEXT NOT NULL UNIQUE,',
    '  name TEXT NOT NULL,',
    "  role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,",
    "  permissions_allow JSONB NOT NULL DEFAULT '[]'::jsonb,",
    "  permissions_deny JSONB NOT NULL DEFAULT '[]'::jsonb,",
    '  active BOOLEAN NOT NULL DEFAULT TRUE,',
    '  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,',
    '  password_hash TEXT NOT NULL,',
    '  failed_attempts INTEGER NOT NULL DEFAULT 0,',
    '  lock_until TIMESTAMPTZ NULL,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  last_login_at TIMESTAMPTZ NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_panel_users_email ON panel_users (email);',
    '',
    'CREATE TABLE IF NOT EXISTS panel_sessions (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,',
    '  csrf_token TEXT NOT NULL,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  hard_expires_at TIMESTAMPTZ NOT NULL,',
    '  expires_at TIMESTAMPTZ NOT NULL,',
    '  last_seen_at TIMESTAMPTZ NOT NULL,',
    '  user_agent_hash TEXT NOT NULL,',
    '  ip_hash TEXT NOT NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_panel_sessions_user_id ON panel_sessions (user_id);',
    '',
    'CREATE TABLE IF NOT EXISTS panel_reset_tokens (',
    '  token TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  expires_at TIMESTAMPTZ NOT NULL,',
    '  used_at TIMESTAMPTZ NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_panel_reset_tokens_user_id ON panel_reset_tokens (user_id);',
    '',
    'CREATE TABLE IF NOT EXISTS panel_login_tokens (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,',
    '  code_hash TEXT NOT NULL,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
    '  expires_at TIMESTAMPTZ NOT NULL,',
    '  used_at TIMESTAMPTZ NULL,',
    "  channel TEXT NOT NULL DEFAULT 'email'",
    ');',
    'CREATE INDEX IF NOT EXISTS idx_panel_login_tokens_user_id ON panel_login_tokens (user_id);',
    '',
    'CREATE TABLE IF NOT EXISTS panel_audit_events (',
    '  id TEXT PRIMARY KEY,',
    '  actor_user_id TEXT NULL REFERENCES panel_users(id) ON DELETE SET NULL,',
    '  event TEXT NOT NULL,',
    "  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),",
    '  ip_hash TEXT NULL,',
    '  user_agent_hash TEXT NULL,',
    '  target TEXT NULL,',
    '  details JSONB NULL,',
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_panel_audit_events_actor_user_id ON panel_audit_events (actor_user_id);',
    'CREATE INDEX IF NOT EXISTS idx_panel_audit_events_created_at ON panel_audit_events (created_at DESC);',
    '',
    `INSERT INTO panel_users (id, email, name, role_ids, permissions_allow, permissions_deny, active, must_change_password, password_hash, failed_attempts)
VALUES (${sqlString(adminId)}, ${sqlString(adminEmail)}, ${sqlString(adminName)}, ${sqlString('["main_admin"]')}::jsonb, ${sqlString(
      '[]',
    )}::jsonb, ${sqlString('[]')}::jsonb, TRUE, FALSE, ${sqlString(input.mainAdminPasswordHash)}, 0)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role_ids = EXCLUDED.role_ids,
  permissions_allow = EXCLUDED.permissions_allow,
  permissions_deny = EXCLUDED.permissions_deny,
  active = TRUE,
  password_hash = EXCLUDED.password_hash,
  must_change_password = FALSE,
  updated_at = NOW();`,
    '',
    `INSERT INTO panel_audit_events (id, actor_user_id, event, outcome, target, details)
VALUES ('audit-bootstrap-main-admin', ${sqlString(adminId)}, 'bootstrap.main-admin.seeded', 'success', ${sqlString(
      adminEmail,
    )}, ${sqlString('{"source":"data-studio"}')}::jsonb)
ON CONFLICT (id) DO NOTHING;`,
  ].join('\n');
}

function buildMysqlProvisionScript(input: {
  connection: DataConnectionProfile;
  adminPassword: string;
  appPassword: string;
  mainAdminName: string;
  mainAdminEmail: string;
  mainAdminPasswordHash: string;
}): string {
  const dbName = mysqlIdentifier(input.connection.database);
  const appUser = sqlString(input.connection.username);
  const appHost = sqlString(input.connection.appHostPattern || 'localhost');
  const appPassword = sqlString(input.appPassword);
  const bootstrapSql = buildMysqlPanelBootstrapSql({
    mainAdminName: input.mainAdminName,
    mainAdminEmail: input.mainAdminEmail,
    mainAdminPasswordHash: input.mainAdminPasswordHash,
  });
  const provisionSql = [
    `CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `CREATE USER IF NOT EXISTS ${appUser}@${appHost} IDENTIFIED BY ${appPassword};`,
    `ALTER USER ${appUser}@${appHost} IDENTIFIED BY ${appPassword};`,
    `GRANT ALL PRIVILEGES ON ${dbName}.* TO ${appUser}@${appHost};`,
    'FLUSH PRIVILEGES;',
  ].join('\n');

  return `
set -e
${mysqlCommandPrefix(input.connection, input.adminPassword)}

printf '%s' ${shellQuote(provisionSql)} | MYSQL_PWD=${shellQuote(input.adminPassword)} "$DB_CLI" --protocol=TCP --host=${shellQuote(
    input.connection.host || '127.0.0.1',
  )} --port=${shellQuote(String(input.connection.port || 3306))} --user=${shellQuote(input.connection.adminUsername || 'root')} --database=${shellQuote(
    input.connection.adminDatabase || 'mysql',
  )}

printf '%s' ${shellQuote(bootstrapSql)} | MYSQL_PWD=${shellQuote(input.adminPassword)} "$DB_CLI" --protocol=TCP --host=${shellQuote(
    input.connection.host || '127.0.0.1',
  )} --port=${shellQuote(String(input.connection.port || 3306))} --user=${shellQuote(input.connection.adminUsername || 'root')} --database=${shellQuote(
    input.connection.database,
  )}

echo 'PROVISION_OK=1'
`.trim();
}

function buildPostgresProvisionScript(input: {
  connection: DataConnectionProfile;
  appPassword: string;
  mainAdminName: string;
  mainAdminEmail: string;
  mainAdminPasswordHash: string;
}): string {
  const connectionDatabase = connectionOrDefault(input.connection.database, 'app_hub');
  const connectionUser = connectionOrDefault(input.connection.username, 'app_hub');
  const bootstrapSql = buildPostgresPanelBootstrapSql({
    mainAdminName: input.mainAdminName,
    mainAdminEmail: input.mainAdminEmail,
    mainAdminPasswordHash: input.mainAdminPasswordHash,
  });
  const roleExistsQuery = `SELECT COUNT(*) FROM pg_roles WHERE rolname = ${sqlString(connectionUser)};`;
  const databaseExistsQuery = `SELECT COUNT(*) FROM pg_database WHERE datname = ${sqlString(connectionDatabase)};`;
  const roleCreateSql = `CREATE ROLE ${pgIdentifier(connectionUser)} LOGIN PASSWORD ${sqlString(input.appPassword)};`;
  const roleAlterSql = `ALTER ROLE ${pgIdentifier(connectionUser)} WITH LOGIN PASSWORD ${sqlString(input.appPassword)};`;
  const grantsSql = [
    `GRANT CONNECT ON DATABASE ${pgIdentifier(connectionDatabase)} TO ${pgIdentifier(connectionUser)};`,
    `ALTER SCHEMA public OWNER TO ${pgIdentifier(connectionUser)};`,
    `GRANT USAGE, CREATE ON SCHEMA public TO ${pgIdentifier(connectionUser)};`,
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${pgIdentifier(connectionUser)};`,
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${pgIdentifier(connectionUser)};`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${pgIdentifier(connectionUser)};`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${pgIdentifier(connectionUser)};`,
  ].join('\n');

  return `
set -e
export DEBIAN_FRONTEND=noninteractive
${privilegedShellPrelude()}

if ! command -v psql >/dev/null 2>&1; then
  run_privileged apt-get update
  run_privileged apt-get install -y postgresql postgresql-contrib
fi

run_privileged systemctl enable --now postgresql >/dev/null 2>&1 || run_privileged service postgresql start >/dev/null 2>&1 || true
${postgresCommandPrefix(input.connection)}

ROLE_EXISTS="$(psql_admin --dbname="$DB_ADMIN_DATABASE" --tuples-only --no-align --command ${shellQuote(roleExistsQuery)} | tr -d '[:space:]')"
DB_EXISTS="$(psql_admin --dbname="$DB_ADMIN_DATABASE" --tuples-only --no-align --command ${shellQuote(databaseExistsQuery)} | tr -d '[:space:]')"

if [ "$ROLE_EXISTS" = "0" ]; then
  psql_admin --dbname="$DB_ADMIN_DATABASE" --command ${shellQuote(roleCreateSql)}
else
  psql_admin --dbname="$DB_ADMIN_DATABASE" --command ${shellQuote(roleAlterSql)}
fi

if [ "$DB_EXISTS" = "0" ]; then
  createdb_admin --owner=${shellQuote(connectionUser)} ${shellQuote(connectionDatabase)}
fi

printf '%s' ${shellQuote(grantsSql)} | psql_admin --dbname=${shellQuote(connectionDatabase)}
printf '%s' ${shellQuote(bootstrapSql)} | psql_admin --dbname=${shellQuote(connectionDatabase)}

echo 'PROVISION_OK=1'
`.trim();
}

function connectionOrDefault(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function parseInspection(output: string): Map<string, string> {
  const pairs = new Map<string, string>();
  output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separator = line.indexOf('=');
      if (separator === -1) return;
      pairs.set(line.slice(0, separator), line.slice(separator + 1));
    });

  return pairs;
}

export async function inspectMysqlProvisioning(
  connection: DataConnectionProfile,
  secrets: DataProvisioningSecrets,
): Promise<DataProvisioningInspection> {
  const output = await runSshScript({
    host: connection.sshHost,
    port: connection.sshPort || 22,
    username: connection.sshUsername,
    password: secrets.sshPassword,
    script: buildMysqlInspectionScript(connection, secrets.adminPassword, secrets.mainAdminEmail),
  });

  const pairs = parseInspection(output);
  const version = pairs.get('VERSION') || 'MySQL/MariaDB';
  const databaseExists = parseCount(pairs.get('DB_EXISTS') || '0') > 0;
  const appUserExists = parseCount(pairs.get('USER_EXISTS') || '0') > 0;
  const boilerplateCount = parseCount(pairs.get('BOILERPLATE_EXISTS') || '0');
  const boilerplateApplied = boilerplateCount >= 5;
  const seedAdminExists = parseCount(pairs.get('SEED_ADMIN_EXISTS') || '0') > 0;

  const summary = databaseExists
    ? boilerplateApplied
      ? 'Banco encontrado e boilerplate de autenticação já aplicado.'
      : 'Banco encontrado, mas o boilerplate de autenticação ainda não foi aplicado.'
    : 'Banco ainda não existe no servidor remoto.';

  return {
    engine: 'mysql',
    version,
    databaseExists,
    appUserExists,
    boilerplateApplied,
    seedAdminExists,
    message: summary,
  };
}

export async function inspectPostgresProvisioning(
  connection: DataConnectionProfile,
  secrets: Pick<DataProvisioningSecrets, 'sshPassword' | 'mainAdminEmail'>,
): Promise<DataProvisioningInspection> {
  const output = await runSshScript({
    host: connection.sshHost,
    port: connection.sshPort || 22,
    username: connection.sshUsername,
    password: secrets.sshPassword,
    script: buildPostgresInspectionScript(connection, secrets.mainAdminEmail),
  });

  const pairs = parseInspection(output);
  const version = pairs.get('VERSION') || 'PostgreSQL';
  const databaseExists = parseCount(pairs.get('DB_EXISTS') || '0') > 0;
  const appUserExists = parseCount(pairs.get('USER_EXISTS') || '0') > 0;
  const boilerplateCount = parseCount(pairs.get('BOILERPLATE_EXISTS') || '0');
  const boilerplateApplied = boilerplateCount >= 5;
  const seedAdminExists = parseCount(pairs.get('SEED_ADMIN_EXISTS') || '0') > 0;

  const summary =
    version === 'PostgreSQL nao instalado'
      ? 'PostgreSQL ainda não está instalado na VPS. O provisionamento oficial pode instalar e configurar o serviço.'
      : databaseExists
        ? boilerplateApplied
          ? 'Banco PostgreSQL encontrado e boilerplate do painel já aplicado.'
          : 'Banco PostgreSQL encontrado, mas o boilerplate do painel ainda não foi aplicado.'
        : 'Banco PostgreSQL ainda não existe no servidor remoto.';

  return {
    engine: 'postgresql',
    version,
    databaseExists,
    appUserExists,
    boilerplateApplied,
    seedAdminExists,
    message: summary,
  };
}

export async function provisionMysqlConnection(
  connection: DataConnectionProfile,
  secrets: Required<
    Pick<DataProvisioningSecrets, 'sshPassword' | 'adminPassword' | 'appPassword' | 'mainAdminName' | 'mainAdminEmail' | 'mainAdminPassword'>
  >,
): Promise<DataProvisioningInspection> {
  const mainAdminPasswordHash = await hashPassword(secrets.mainAdminPassword);

  await runSshScript({
    host: connection.sshHost,
    port: connection.sshPort || 22,
    username: connection.sshUsername,
    password: secrets.sshPassword,
    script: buildMysqlProvisionScript({
      connection,
      adminPassword: secrets.adminPassword,
      appPassword: secrets.appPassword,
      mainAdminName: secrets.mainAdminName,
      mainAdminEmail: secrets.mainAdminEmail,
      mainAdminPasswordHash,
    }),
  });

  return inspectMysqlProvisioning(connection, {
    sshPassword: secrets.sshPassword,
    adminPassword: secrets.adminPassword,
    mainAdminEmail: secrets.mainAdminEmail,
  });
}

export async function provisionPostgresConnection(
  connection: DataConnectionProfile,
  secrets: ProvisioningResultSecrets,
): Promise<DataProvisioningInspection> {
  const mainAdminPasswordHash = await hashPassword(secrets.mainAdminPassword);

  await runSshScript({
    host: connection.sshHost,
    port: connection.sshPort || 22,
    username: connection.sshUsername,
    password: secrets.sshPassword,
    script: buildPostgresProvisionScript({
      connection,
      appPassword: secrets.appPassword,
      mainAdminName: secrets.mainAdminName,
      mainAdminEmail: secrets.mainAdminEmail,
      mainAdminPasswordHash,
    }),
  });

  return inspectPostgresProvisioning(connection, {
    sshPassword: secrets.sshPassword,
    mainAdminEmail: secrets.mainAdminEmail,
  });
}
