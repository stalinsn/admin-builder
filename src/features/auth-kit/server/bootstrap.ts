import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

import { Pool, type PoolClient } from 'pg';

const scrypt = promisify(scryptCallback);
const KEYLEN = 64;

type RetentionPolicySeed = {
  id: string;
  entityKey: string;
  label: string;
  description: string;
  action: 'delete' | 'anonymize' | 'retain_minimum';
  retentionDays: number;
  legalBasis: string;
};

const DEFAULT_CUSTOMER_RETENTION_POLICIES: RetentionPolicySeed[] = [
  {
    id: 'crp-account-profile',
    entityKey: 'customer_accounts',
    label: 'Conta do cliente',
    description: 'Dados de identificação e consentimento da conta do cliente.',
    action: 'anonymize',
    retentionDays: 30,
    legalBasis: 'Atendimento ao titular e encerramento controlado da relação.',
  },
  {
    id: 'crp-addresses',
    entityKey: 'customer_addresses',
    label: 'Endereços da conta',
    description: 'Endereços salvos para entrega e cobrança.',
    action: 'delete',
    retentionDays: 30,
    legalBasis: 'Dados acessórios da conta, removidos após tratamento.',
  },
  {
    id: 'crp-sessions',
    entityKey: 'customer_sessions',
    label: 'Sessões autenticadas',
    description: 'Sessões ativas e histórico técnico mínimo da autenticação.',
    action: 'delete',
    retentionDays: 7,
    legalBasis: 'Segurança operacional e encerramento da sessão.',
  },
  {
    id: 'crp-login-tokens',
    entityKey: 'customer_login_tokens',
    label: 'Códigos de acesso',
    description: 'Tokens de login por código enviados ao cliente.',
    action: 'delete',
    retentionDays: 2,
    legalBasis: 'Segurança e prevenção de reuso indevido.',
  },
  {
    id: 'crp-pending-registrations',
    entityKey: 'customer_pending_registrations',
    label: 'Cadastros pendentes',
    description: 'Solicitações de cadastro ainda não validadas por e-mail.',
    action: 'delete',
    retentionDays: 2,
    legalBasis: 'Prevenção a abuso, segurança e conclusão assistida do cadastro.',
  },
  {
    id: 'crp-customer-orders',
    entityKey: 'customer_orders',
    label: 'Projeção de pedidos da conta',
    description: 'Visão de pedidos vinculada à conta para área Minha conta.',
    action: 'anonymize',
    retentionDays: 30,
    legalBasis: 'Desvinculação da conta com preservação do histórico operacional mínimo.',
  },
  {
    id: 'crp-commerce-orders',
    entityKey: 'commerce_orders',
    label: 'Pedido operacional',
    description: 'Pedido consolidado, timeline comercial e dados sanitizados de operação.',
    action: 'retain_minimum',
    retentionDays: 1825,
    legalBasis: 'Operação, auditoria, defesa do negócio e obrigações legais.',
  },
  {
    id: 'crp-order-events',
    entityKey: 'commerce_order_events',
    label: 'Eventos do pedido',
    description: 'Timeline logística, financeira e de atendimento do pedido.',
    action: 'retain_minimum',
    retentionDays: 1825,
    legalBasis: 'Rastreabilidade operacional e auditoria do pedido.',
  },
  {
    id: 'crp-audit',
    entityKey: 'customer_audit_events',
    label: 'Auditoria da conta',
    description: 'Trilha mínima de segurança e tratamento da conta do cliente.',
    action: 'retain_minimum',
    retentionDays: 365,
    legalBasis: 'Segurança, prevenção a fraude e auditoria interna.',
  },
];

export type AuthKitBootstrapInput = {
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  seedDefaultPanelUsers?: boolean;
};

export type AuthKitBootstrapResult = {
  panel: {
    storage: 'database' | 'mock';
    usersCount: number;
    adminCreated: boolean;
    seededDefaultUsers: boolean;
    adminEmail: string;
  };
  customer: {
    schemaReady: boolean;
    retentionPolicies: number;
  };
};

function normalizeRequired(value: string, label: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} é obrigatório para o bootstrap do auth kit.`);
  }
  return normalized;
}

function validatePasswordPolicy(password: string) {
  const reasons: string[] = [];
  if (password.length < 12) reasons.push('Password must have at least 12 characters.');
  if (!/[A-Z]/.test(password)) reasons.push('Password must include at least one uppercase letter.');
  if (!/[a-z]/.test(password)) reasons.push('Password must include at least one lowercase letter.');
  if (!/[0-9]/.test(password)) reasons.push('Password must include at least one number.');
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push('Password must include at least one symbol.');
  return { ok: reasons.length === 0, reasons };
}

function randomToken(size = 6) {
  return randomBytes(Math.ceil(size / 2))
    .toString('hex')
    .slice(0, size);
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

function createPoolFromEnv() {
  const host = process.env.APP_DB_HOST || '127.0.0.1';
  const port = Number(process.env.APP_DB_PORT || '5432');
  const database = process.env.APP_DB_NAME || '';
  const user = process.env.APP_DB_USER || '';
  const password = process.env.APP_DB_PASSWORD || '';

  if (!database || !user || !password) {
    throw new Error('APP_DB_NAME, APP_DB_USER e APP_DB_PASSWORD precisam estar definidos para o bootstrap do auth kit.');
  }

  return new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });
}

async function ensurePanelSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      permissions_allow JSONB NOT NULL DEFAULT '[]'::jsonb,
      permissions_deny JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      password_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      lock_until TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_users_email ON panel_users (email)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hard_expires_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      user_agent_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_sessions_user_id ON panel_sessions (user_id)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_reset_tokens_user_id ON panel_reset_tokens (user_id)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_login_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      channel TEXT NOT NULL DEFAULT 'email'
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_login_tokens_user_id ON panel_login_tokens (user_id)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NULL REFERENCES panel_users(id) ON DELETE SET NULL,
      event TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
      ip_hash TEXT NULL,
      user_agent_hash TEXT NULL,
      target TEXT NULL,
      details JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_audit_events_actor_user_id ON panel_audit_events (actor_user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_panel_audit_events_created_at ON panel_audit_events (created_at DESC)');
}

async function ensureCustomerSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('individual', 'company')),
      first_name TEXT NULL,
      last_name TEXT NULL,
      full_name TEXT NULL,
      phone TEXT NULL,
      alternate_phone TEXT NULL,
      birth_date_encrypted TEXT NULL,
      tax_document_type TEXT NOT NULL CHECK (tax_document_type IN ('cpf', 'cnpj')),
      tax_document_encrypted TEXT NULL,
      tax_document_last4 TEXT NULL,
      tax_document_hash TEXT NULL,
      secondary_document_encrypted TEXT NULL,
      company_name TEXT NULL,
      trade_name TEXT NULL,
      state_registration_encrypted TEXT NULL,
      password_hash TEXT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      lock_until TIMESTAMPTZ NULL,
      marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      accepted_privacy_at TIMESTAMPTZ NULL,
      accepted_terms_at TIMESTAMPTZ NULL,
      email_verified_at TIMESTAMPTZ NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      deleted_at TIMESTAMPTZ NULL,
      erasure_requested_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_tax_document_hash ON customer_accounts (tax_document_hash) WHERE tax_document_hash IS NOT NULL');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_accounts_active ON customer_accounts (active, updated_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      recipient TEXT NULL,
      postal_code TEXT NULL,
      street TEXT NULL,
      number TEXT NULL,
      complement TEXT NULL,
      neighborhood TEXT NULL,
      city TEXT NULL,
      state TEXT NULL,
      country TEXT NULL,
      reference TEXT NULL,
      phone TEXT NULL,
      is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
      is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_addresses_account_id ON customer_addresses (account_id, updated_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY,
      account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
      group_order_id TEXT NULL,
      split_sequence INTEGER NULL,
      split_total INTEGER NULL,
      placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'created',
      payment_method TEXT NOT NULL,
      total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      shipping_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      items_count INTEGER NOT NULL DEFAULT 0,
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      address_summary TEXT NULL,
      source TEXT NOT NULL DEFAULT 'storefront'
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_orders_account_id ON customer_orders (account_id, placed_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_login_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      channel TEXT NOT NULL DEFAULT 'email'
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_login_tokens_account_id ON customer_login_tokens (account_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_login_tokens_expires_at ON customer_login_tokens (expires_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_pending_registrations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      payload_encrypted TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      tax_document_hash TEXT NULL,
      code_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      channel TEXT NOT NULL DEFAULT 'email'
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_pending_registrations_expires_at ON customer_pending_registrations (expires_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_pending_registrations_tax_document_hash ON customer_pending_registrations (tax_document_hash) WHERE tax_document_hash IS NOT NULL');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      hard_expires_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_sessions_account_id ON customer_sessions (account_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions (expires_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_audit_events (
      id TEXT PRIMARY KEY,
      account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
      event TEXT NOT NULL,
      outcome TEXT NOT NULL,
      target TEXT NULL,
      details JSONB NULL,
      ip_hash TEXT NULL,
      user_agent_hash TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_lgpd_requests (
      id TEXT PRIMARY KEY,
      account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
      account_email TEXT NULL,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      source TEXT NOT NULL DEFAULT 'customer',
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_lgpd_requests_status ON customer_lgpd_requests (status, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_lgpd_requests_account ON customer_lgpd_requests (account_id, created_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_lgpd_approvals (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES customer_lgpd_requests(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT 'pending',
      actor_user_id TEXT NULL,
      actor_user_name TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ NULL
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_customer_lgpd_approvals_request ON customer_lgpd_approvals (request_id, created_at DESC)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_retention_policies (
      id TEXT PRIMARY KEY,
      entity_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      action TEXT NOT NULL,
      retention_days INTEGER NOT NULL,
      legal_basis TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const policy of DEFAULT_CUSTOMER_RETENTION_POLICIES) {
    await client.query(
      `INSERT INTO customer_retention_policies (
        id, entity_key, label, description, action, retention_days, legal_basis, enabled, updated_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'system', NOW())
      ON CONFLICT (entity_key) DO NOTHING`,
      [policy.id, policy.entityKey, policy.label, policy.description, policy.action, policy.retentionDays, policy.legalBasis],
    );
  }
}

async function ensureInitialAdmin(
  client: PoolClient,
  adminEmail: string,
  adminName: string,
  adminPasswordHash: string,
  seedDefaultPanelUsers: boolean,
) {
  const existingUsers = await client.query<{ id: string; email: string }>('SELECT id, email FROM panel_users');

  if (existingUsers.rows.length > 0 && !seedDefaultPanelUsers) {
    return { adminCreated: false, usersCount: existingUsers.rows.length };
  }

  const existingAdmin = existingUsers.rows.find((row) => row.email.trim().toLowerCase() === adminEmail);
  const adminId = existingAdmin?.id || `usr-${randomToken(6)}`;

  await client.query(
    `INSERT INTO panel_users (
      id, email, name, role_ids, permissions_allow, permissions_deny,
      active, must_change_password, password_hash, failed_attempts, created_at, updated_at
    ) VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb, '[]'::jsonb, TRUE, FALSE, $5, 0, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role_ids = EXCLUDED.role_ids,
      active = TRUE,
      must_change_password = FALSE,
      password_hash = EXCLUDED.password_hash,
      updated_at = NOW()`,
    [adminId, adminEmail, adminName, JSON.stringify(['main_admin', 'store_owner']), adminPasswordHash],
  );

  await client.query(
    `INSERT INTO panel_audit_events (id, actor_user_id, event, outcome, target, details, created_at)
     VALUES ($1, $2, 'bootstrap.main-admin.seeded', 'success', $3, $4::jsonb, NOW())
     ON CONFLICT (id) DO NOTHING`,
    ['audit-bootstrap-main-admin', adminId, adminEmail, JSON.stringify({ source: 'auth-kit' })],
  );

  const countQuery = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM panel_users');
  return {
    adminCreated: !existingAdmin,
    usersCount: Number(countQuery.rows[0]?.count || 0),
  };
}

export async function bootstrapAuthKitRuntime(input: AuthKitBootstrapInput): Promise<AuthKitBootstrapResult> {
  const adminEmail = normalizeRequired(input.adminEmail, 'Admin e-mail').toLowerCase();
  const adminName = normalizeRequired(input.adminName, 'Admin nome');
  const adminPassword = normalizeRequired(input.adminPassword, 'Admin senha');
  const passwordValidation = validatePasswordPolicy(adminPassword);
  if (!passwordValidation.ok) {
    throw new Error(`A senha inicial do admin não atende à política: ${passwordValidation.reasons.join(' ')}`);
  }

  const adminPasswordHash = await hashPassword(adminPassword);
  const pool = createPoolFromEnv();

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensurePanelSchema(client);
      await ensureCustomerSchema(client);
      const panelResult = await ensureInitialAdmin(
        client,
        adminEmail,
        adminName,
        adminPasswordHash,
        Boolean(input.seedDefaultPanelUsers),
      );
      await client.query('COMMIT');

      const retentionCountQuery = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM customer_retention_policies',
      );

      return {
        panel: {
          storage: 'database',
          usersCount: panelResult.usersCount,
          adminCreated: panelResult.adminCreated,
          seededDefaultUsers: false,
          adminEmail,
        },
        customer: {
          schemaReady: true,
          retentionPolicies: Number(retentionCountQuery.rows[0]?.count || 0),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
