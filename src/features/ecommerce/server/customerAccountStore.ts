import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient, type PostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import { nowIso, randomToken, sha256 } from '@/features/ecommpanel/server/crypto';
import { hashPassword, verifyPassword } from '@/features/ecommpanel/server/password';
import type {
  CustomerAdminRecord,
  CustomerAdminSummary,
  CustomerAccountAddress,
  CustomerLgpdExportPackage,
  CustomerLgpdApprovalRecord,
  CustomerLgpdApprovalDecision,
  CustomerLgpdApprovalStage,
  CustomerLgpdRequestRecord,
  CustomerLgpdReviewStatus,
  CustomerLgpdRequestStatus,
  CustomerLgpdRequestType,
  CustomerRetentionAction,
  CustomerRetentionPolicyRecord,
  CustomerAccountMeResponse,
  CustomerAccountProfile,
  CustomerAccountRecord,
  CustomerAccountSession,
  CustomerAdminUpsertPayload,
  CustomerPasswordLoginPayload,
  CustomerRegistrationPayload,
  CustomerRegistrationStartResult,
} from '@/features/ecommerce/types/account';
import type { Address, ClientProfileData, OrderFormItem } from '@/features/ecommerce/types/orderForm';

import { CUSTOMER_ACCOUNT_SECURITY } from '../config/accountSecurity';
import { validateCustomerPassword } from '../lib/passwordPolicy';
import { decryptCustomerData, encryptCustomerData, hashLookupValue } from './customerCrypto';
import {
  formatAddressSummary,
  mapAccountProfile,
  mapAddress,
  mapOrder,
  mapSession,
  normalizeDigits,
  normalizeEmail,
  normalizeLine,
  normalizeLoginIdentifier,
  parseRegistrationPayload,
  toIso,
} from './customerAccountStore.helpers';
import {
  type CustomerAccountRow,
  type CustomerAddressRow,
  type CustomerAdminListRow,
  type CustomerAuditEventRow,
  type CustomerLoginTokenRow,
  type CustomerLgpdApprovalRow,
  type CustomerLgpdRequestRow,
  type CustomerOrderRow,
  type CustomerPendingRegistrationRow,
  type CustomerRetentionPolicyRow,
  type CustomerSessionRow,
  DEFAULT_CUSTOMER_RETENTION_POLICIES,
} from './customerAccountStore.types';

declare global {
  var __ECOM_CUSTOMER_DB_SCHEMA_READY_KEYS__: Set<string> | undefined;
}

async function withDbClient<T>(
  handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>,
): Promise<{ available: true; value: T } | { available: false }> {
  return withPostgresClient(handler);
}

async function ensureCustomerSchema(runtime: PostgresRuntime): Promise<void> {
  const readyKeys = global.__ECOM_CUSTOMER_DB_SCHEMA_READY_KEYS__ || new Set<string>();
  global.__ECOM_CUSTOMER_DB_SCHEMA_READY_KEYS__ = readyKeys;
  if (readyKeys.has(runtime.key)) return;

  await withPostgresClient(async (client) => {
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
    await client.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS password_hash TEXT NULL');
    await client.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0');
    await client.query('ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ NULL');
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
    await client.query('ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS group_order_id TEXT NULL');
    await client.query('ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS split_sequence INTEGER NULL');
    await client.query('ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS split_total INTEGER NULL');
    await client.query('ALTER TABLE customer_orders ALTER COLUMN account_id DROP NOT NULL');
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
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_customer_pending_registrations_expires_at ON customer_pending_registrations (expires_at DESC)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_customer_pending_registrations_tax_document_hash ON customer_pending_registrations (tax_document_hash) WHERE tax_document_hash IS NOT NULL',
    );

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
  });

  readyKeys.add(runtime.key);
}

async function withCustomerDb<T>(handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>) {
  const runtime = await withDbClient(async (client, currentRuntime) => {
    await ensureCustomerSchema(currentRuntime);
    return handler(client, currentRuntime);
  });
  return runtime;
}

export async function ensureCustomerAuthSchemaRuntime(): Promise<boolean> {
  const result = await withCustomerDb(async () => true);
  return result.available ? result.value : false;
}

async function insertAuditEvent(
  client: PoolClient,
  input: {
    accountId?: string | null;
    event: string;
    outcome: 'success' | 'failure';
    target?: string | null;
    details?: Record<string, string | number | boolean | null>;
    ipHash?: string | null;
    userAgentHash?: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO customer_audit_events (id, account_id, event, outcome, target, details, ip_hash, user_agent_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())`,
    [
      `cae-${randomToken(6)}`,
      input.accountId || null,
      input.event,
      input.outcome,
      input.target || null,
      JSON.stringify(input.details || null),
      input.ipHash || null,
      input.userAgentHash || null,
    ],
  );
}

async function cleanupExpiredPendingRegistrations(client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM customer_pending_registrations
     WHERE expires_at <= NOW()
        OR used_at IS NOT NULL`,
  );
}

export function normalizeCustomerEmail(value: string): string {
  return normalizeEmail(value);
}

async function getAccountRecordById(client: PoolClient, accountId: string): Promise<CustomerAccountRecord | null> {
  const accountQuery = await client.query<CustomerAccountRow>(
    `SELECT *
     FROM customer_accounts
     WHERE id = $1
       AND deleted_at IS NULL
       AND active = TRUE
     LIMIT 1`,
    [accountId],
  );
  const accountRow = accountQuery.rows[0];
  if (!accountRow) return null;

  const [addressesQuery, ordersQuery] = await Promise.all([
    client.query<CustomerAddressRow>(
      `SELECT *
       FROM customer_addresses
       WHERE account_id = $1
         AND deleted_at IS NULL
       ORDER BY is_default_shipping DESC, updated_at DESC`,
      [accountId],
    ),
    client.query<CustomerOrderRow>(
      `SELECT *
       FROM customer_orders
       WHERE account_id = $1
       ORDER BY placed_at DESC
       LIMIT 30`,
      [accountId],
    ),
  ]);

  return {
    profile: mapAccountProfile(accountRow),
    addresses: addressesQuery.rows.map(mapAddress),
    orders: ordersQuery.rows.map(mapOrder),
    privacy: {
      active: Boolean(accountRow.active),
      deletedAt: toIso(accountRow.deleted_at),
      erasureRequestedAt: toIso(accountRow.erasure_requested_at),
    },
  };
}

async function getAdminAccountRecordById(client: PoolClient, accountId: string): Promise<CustomerAdminRecord | null> {
  const accountQuery = await client.query<CustomerAdminListRow>(
    `SELECT account.*,
            (SELECT COUNT(*) FROM customer_orders orders WHERE orders.account_id = account.id)::text AS orders_count,
            (SELECT COUNT(*) FROM customer_addresses addresses WHERE addresses.account_id = account.id AND addresses.deleted_at IS NULL)::text AS addresses_count
     FROM customer_accounts account
     WHERE account.id = $1
     LIMIT 1`,
    [accountId],
  );
  const accountRow = accountQuery.rows[0];
  if (!accountRow) return null;

  const base = await getAccountRecordById(client, accountId);
  if (!base) {
    return {
      profile: mapAccountProfile(accountRow),
      addresses: [],
      orders: [],
      privacy: {
        active: Boolean(accountRow.active),
        deletedAt: toIso(accountRow.deleted_at),
        erasureRequestedAt: toIso(accountRow.erasure_requested_at),
      },
      active: Boolean(accountRow.active),
      deletedAt: toIso(accountRow.deleted_at),
      erasureRequestedAt: toIso(accountRow.erasure_requested_at),
      ordersCount: Number(accountRow.orders_count || 0),
      addressesCount: Number(accountRow.addresses_count || 0),
    };
  }

  return {
    ...base,
    active: Boolean(accountRow.active),
    deletedAt: toIso(accountRow.deleted_at),
    erasureRequestedAt: toIso(accountRow.erasure_requested_at),
    ordersCount: Number(accountRow.orders_count || 0),
    addressesCount: Number(accountRow.addresses_count || 0),
  };
}

function toAdminSummary(row: CustomerAdminListRow): CustomerAdminSummary {
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    name: row.full_name || row.company_name || row.trade_name || row.email,
    phone: row.phone || undefined,
    active: Boolean(row.active),
    deletedAt: toIso(row.deleted_at),
    erasureRequestedAt: toIso(row.erasure_requested_at),
    marketingOptIn: Boolean(row.marketing_opt_in),
    ordersCount: Number(row.orders_count || 0),
    addressesCount: Number(row.addresses_count || 0),
    lastLoginAt: toIso(row.last_login_at),
    updatedAt: toIso(row.updated_at) || nowIso(),
  };
}

function mapLgpdRequest(row: CustomerLgpdRequestRow): CustomerLgpdRequestRecord {
  return {
    id: row.id,
    accountId: row.account_id || undefined,
    accountEmail: row.account_email || undefined,
    type: row.request_type,
    status: row.status,
    source: row.source,
    notes: row.notes || undefined,
    createdAt: toIso(row.created_at) || nowIso(),
    completedAt: toIso(row.completed_at),
    reviewStatus: row.review_status || (row.request_type === 'erasure_request' ? 'pending_review' : 'not_required'),
    reviewedAt: toIso(row.reviewed_at),
    reviewedBy: row.reviewed_by || undefined,
    executionEligible: Boolean(row.execution_eligible),
  };
}

function mapLgpdApproval(row: CustomerLgpdApprovalRow): CustomerLgpdApprovalRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    stage: row.stage,
    decision: row.decision,
    actorUserId: row.actor_user_id || undefined,
    actorUserName: row.actor_user_name || undefined,
    notes: row.notes || undefined,
    createdAt: toIso(row.created_at) || nowIso(),
    decidedAt: toIso(row.decided_at),
  };
}

function mapRetentionPolicy(row: CustomerRetentionPolicyRow): CustomerRetentionPolicyRecord {
  return {
    id: row.id,
    entityKey: row.entity_key,
    label: row.label,
    description: row.description,
    action: row.action,
    retentionDays: Number(row.retention_days || 0),
    legalBasis: row.legal_basis,
    enabled: Boolean(row.enabled),
    updatedAt: toIso(row.updated_at) || nowIso(),
    updatedBy: row.updated_by || undefined,
  };
}

async function syncCustomerAddresses(
  client: PoolClient,
  accountId: string,
  addresses: NonNullable<CustomerAdminUpsertPayload['addresses']>,
): Promise<void> {
  const keptIds = new Set<string>();
  for (const address of addresses) {
    const saved = await upsertCustomerAddressInClient(client, accountId, address);
    if (saved?.id) keptIds.add(saved.id);
  }

  const existingQuery = await client.query<CustomerAddressRow>(
    `SELECT *
     FROM customer_addresses
     WHERE account_id = $1
       AND deleted_at IS NULL`,
    [accountId],
  );

  for (const row of existingQuery.rows) {
    if (!keptIds.has(row.id)) {
      await client.query(
        `UPDATE customer_addresses
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    }
  }
}

async function upsertCustomerAddressInClient(
  client: PoolClient,
  accountId: string,
  input: Omit<CustomerAccountAddress, 'id' | 'updatedAt' | 'createdAt'> & { id?: string },
): Promise<CustomerAccountAddress | null> {
  const addressId = input.id || `cad-${randomToken(6)}`;
  if (input.isDefaultShipping || input.isDefaultBilling) {
    await client.query(
      `UPDATE customer_addresses
       SET is_default_shipping = CASE WHEN $2 THEN FALSE ELSE is_default_shipping END,
           is_default_billing = CASE WHEN $3 THEN FALSE ELSE is_default_billing END
       WHERE account_id = $1
         AND deleted_at IS NULL`,
      [accountId, Boolean(input.isDefaultShipping), Boolean(input.isDefaultBilling)],
    );
  }

  await client.query(
    `INSERT INTO customer_addresses (
      id, account_id, label, recipient, postal_code, street, number, complement, neighborhood,
      city, state, country, reference, phone, is_default_shipping, is_default_billing, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      recipient = EXCLUDED.recipient,
      postal_code = EXCLUDED.postal_code,
      street = EXCLUDED.street,
      number = EXCLUDED.number,
      complement = EXCLUDED.complement,
      neighborhood = EXCLUDED.neighborhood,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      country = EXCLUDED.country,
      reference = EXCLUDED.reference,
      phone = EXCLUDED.phone,
      is_default_shipping = EXCLUDED.is_default_shipping,
      is_default_billing = EXCLUDED.is_default_billing,
      deleted_at = NULL,
      updated_at = NOW()`,
    [
      addressId,
      accountId,
      normalizeLine(input.label, 80) || 'Endereço',
      normalizeLine(input.recipient, 160) || null,
      normalizeLine(input.postalCode, 16) || null,
      normalizeLine(input.street, 180) || null,
      normalizeLine(input.number, 40) || null,
      normalizeLine(input.complement, 120) || null,
      normalizeLine(input.neighborhood, 120) || null,
      normalizeLine(input.city, 120) || null,
      normalizeLine(input.state, 32) || null,
      normalizeLine(input.country, 32) || 'BRA',
      normalizeLine(input.reference, 160) || null,
      normalizeLine(input.phone, 30) || null,
      Boolean(input.isDefaultShipping),
      Boolean(input.isDefaultBilling),
    ],
  );

  const query = await client.query<CustomerAddressRow>('SELECT * FROM customer_addresses WHERE id = $1 LIMIT 1', [addressId]);
  return query.rows[0] ? mapAddress(query.rows[0]) : null;
}

async function getActiveCustomerAccountRowByIdentifier(
  client: PoolClient,
  identifier: string,
): Promise<CustomerAccountRow | null> {
  const normalized = normalizeLoginIdentifier(identifier);
  if (normalized.email) {
    const query = await client.query<CustomerAccountRow>(
      `SELECT *
       FROM customer_accounts
       WHERE email = $1
         AND deleted_at IS NULL
         AND active = TRUE
       LIMIT 1`,
      [normalized.email],
    );
    return query.rows[0] || null;
  }

  if (normalized.taxDocumentHash) {
    const query = await client.query<CustomerAccountRow>(
      `SELECT *
       FROM customer_accounts
       WHERE tax_document_hash = $1
         AND deleted_at IS NULL
         AND active = TRUE
       LIMIT 1`,
      [normalized.taxDocumentHash],
    );
    return query.rows[0] || null;
  }

  return null;
}

export async function getCustomerAccountByEmail(email: string): Promise<CustomerAccountRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const result = await withCustomerDb(async (client) => {
    const query = await client.query<CustomerAccountRow>(
      `SELECT *
       FROM customer_accounts
       WHERE email = $1
         AND deleted_at IS NULL
         AND active = TRUE
       LIMIT 1`,
      [normalizedEmail],
    );
    const row = query.rows[0];
    return row ? getAccountRecordById(client, row.id) : null;
  });

  return result.available ? result.value : null;
}

export async function authenticateCustomerPassword(input: CustomerPasswordLoginPayload): Promise<CustomerAccountProfile | null> {
  const identifier = input.identifier.trim();
  const password = input.password || '';
  if (!identifier || !password) return null;

  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      const account = await getActiveCustomerAccountRowByIdentifier(client, identifier);
      if (!account) {
        await client.query('ROLLBACK');
        return null;
      }

      const lockUntil = account.lock_until ? new Date(account.lock_until).getTime() : 0;
      if (lockUntil > Date.now()) {
        await insertAuditEvent(client, {
          accountId: account.id,
          event: 'customer.password-login.locked',
          outcome: 'failure',
          target: account.email,
        });
        await client.query('ROLLBACK');
        return null;
      }

      const valid = account.password_hash ? await verifyPassword(password, account.password_hash) : false;
      if (!valid) {
        const nextFailures = Number(account.failed_attempts || 0) + 1;
        const shouldLock = nextFailures >= 5;
        await client.query(
          `UPDATE customer_accounts
           SET failed_attempts = $2,
               lock_until = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [account.id, nextFailures, shouldLock ? new Date(Date.now() + 1000 * 60 * 15).toISOString() : null],
        );
        await insertAuditEvent(client, {
          accountId: account.id,
          event: 'customer.password-login.invalid',
          outcome: 'failure',
          target: account.email,
          details: { failedAttempts: nextFailures },
        });
        await client.query('COMMIT');
        return null;
      }

      if (!account.email_verified_at) {
        await insertAuditEvent(client, {
          accountId: account.id,
          event: 'customer.password-login.unverified',
          outcome: 'failure',
          target: account.email,
        });
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `UPDATE customer_accounts
         SET failed_attempts = 0,
             lock_until = NULL,
             last_login_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [account.id],
      );
      await insertAuditEvent(client, {
        accountId: account.id,
        event: 'customer.password-login.verified',
        outcome: 'success',
        target: account.email,
      });
      await client.query('COMMIT');
      return mapAccountProfile(account);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : null;
}

export async function getCustomerAccountById(accountId: string): Promise<CustomerAccountRecord | null> {
  const result = await withCustomerDb(async (client) => getAccountRecordById(client, accountId));
  return result.available ? result.value : null;
}

export async function listCustomerAccountsAdmin(search?: string): Promise<CustomerAdminSummary[]> {
  const term = normalizeLine(search, 160)?.toLowerCase();
  const result = await withCustomerDb(async (client) => {
    const values: string[] = [];
    let where = '';
    if (term) {
      values.push(`%${term}%`);
      where = `WHERE LOWER(account.email) LIKE $1
                OR LOWER(COALESCE(account.full_name, '')) LIKE $1
                OR LOWER(COALESCE(account.company_name, '')) LIKE $1
                OR LOWER(COALESCE(account.trade_name, '')) LIKE $1
                OR LOWER(COALESCE(account.phone, '')) LIKE $1`;
    }
    const query = await client.query<CustomerAdminListRow>(
      `SELECT account.*,
              (SELECT COUNT(*) FROM customer_orders orders WHERE orders.account_id = account.id)::text AS orders_count,
              (SELECT COUNT(*) FROM customer_addresses addresses WHERE addresses.account_id = account.id AND addresses.deleted_at IS NULL)::text AS addresses_count
       FROM customer_accounts account
       ${where}
       ORDER BY account.updated_at DESC`,
      values,
    );
    return query.rows.map(toAdminSummary);
  });
  return result.available ? result.value : [];
}

export async function getCustomerAccountAdminById(accountId: string): Promise<CustomerAdminRecord | null> {
  const result = await withCustomerDb(async (client) => getAdminAccountRecordById(client, accountId));
  return result.available ? result.value : null;
}

async function listCustomerAuditEventsByAccountId(client: PoolClient, accountId: string) {
  const query = await client.query<CustomerAuditEventRow>(
    `SELECT id, account_id, event, outcome, target, created_at
     FROM customer_audit_events
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 120`,
    [accountId],
  );
  return query.rows.map((row) => ({
    id: row.id,
    event: row.event,
    outcome: row.outcome,
    target: row.target || undefined,
    createdAt: toIso(row.created_at) || nowIso(),
  }));
}

async function listCustomerLgpdRequestsInClient(client: PoolClient): Promise<CustomerLgpdRequestRecord[]> {
  const query = await client.query<CustomerLgpdRequestRow>(
    `SELECT req.*,
            COALESCE(review.decision, CASE WHEN req.request_type = 'erasure_request' AND req.status = 'open' THEN 'pending_review' ELSE 'not_required' END) AS review_status,
            review.decided_at AS reviewed_at,
            review.actor_user_name AS reviewed_by,
            CASE
              WHEN req.request_type = 'erasure_request'
               AND req.status = 'open'
               AND COALESCE(review.decision, 'pending_review') = 'approved'
              THEN TRUE
              ELSE FALSE
            END AS execution_eligible
     FROM customer_lgpd_requests req
     LEFT JOIN LATERAL (
       SELECT decision, decided_at, actor_user_name
       FROM customer_lgpd_approvals approval
       WHERE approval.request_id = req.id
         AND approval.stage = 'review'
       ORDER BY approval.created_at DESC
       LIMIT 1
     ) review ON TRUE
     ORDER BY req.created_at DESC
     LIMIT 200`,
  );
  return query.rows.map(mapLgpdRequest);
}

async function listCustomerRetentionPoliciesInClient(client: PoolClient): Promise<CustomerRetentionPolicyRecord[]> {
  const query = await client.query<CustomerRetentionPolicyRow>(
    `SELECT *
     FROM customer_retention_policies
     ORDER BY entity_key ASC`,
  );
  return query.rows.map(mapRetentionPolicy);
}

async function createLgpdApprovalStageInClient(
  client: PoolClient,
  input: {
    requestId: string;
    stage: CustomerLgpdApprovalStage;
    decision: CustomerLgpdApprovalDecision;
    actorUserId?: string | null;
    actorUserName?: string | null;
    notes?: string;
  },
) {
  const query = await client.query<CustomerLgpdApprovalRow>(
    `INSERT INTO customer_lgpd_approvals (
      id, request_id, stage, decision, actor_user_id, actor_user_name, notes, created_at, decided_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), CASE WHEN $4 = 'pending' THEN NULL ELSE NOW() END)
    RETURNING *`,
    [
      `cla-${randomToken(6)}`,
      input.requestId,
      input.stage,
      input.decision,
      input.actorUserId || null,
      input.actorUserName || null,
      normalizeLine(input.notes, 240) || null,
    ],
  );
  return mapLgpdApproval(query.rows[0]);
}

export async function listCustomerLgpdRequestsAdmin(): Promise<CustomerLgpdRequestRecord[]> {
  const result = await withCustomerDb(async (client) => {
    return listCustomerLgpdRequestsInClient(client);
  });
  return result.available ? result.value : [];
}

export async function listCustomerRetentionPoliciesAdmin(): Promise<CustomerRetentionPolicyRecord[]> {
  const result = await withCustomerDb(async (client) => {
    return listCustomerRetentionPoliciesInClient(client);
  });
  return result.available ? result.value : [];
}

async function createLgpdRequestInClient(
  client: PoolClient,
  input: {
    accountId: string;
    accountEmail: string;
    type: CustomerLgpdRequestType;
    source: 'customer' | 'admin';
    notes?: string;
  },
) {
  const query = await client.query<CustomerLgpdRequestRow>(
    `INSERT INTO customer_lgpd_requests (
      id, account_id, account_email, request_type, status, source, notes, created_at
    ) VALUES ($1, $2, $3, $4, 'open', $5, $6, NOW())
    RETURNING *`,
    [
      `clr-${randomToken(6)}`,
      input.accountId,
      input.accountEmail,
      input.type,
      input.source,
      normalizeLine(input.notes, 240) || null,
    ],
  );
  return mapLgpdRequest(query.rows[0]);
}

export async function createCustomerLgpdRequest(input: {
  accountId: string;
  type: CustomerLgpdRequestType;
  source: 'customer' | 'admin';
  notes?: string;
}): Promise<CustomerLgpdRequestRecord | null> {
  const result = await withCustomerDb(async (client) => {
    const accountQuery = await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE id = $1 LIMIT 1', [input.accountId]);
    const account = accountQuery.rows[0];
    if (!account) return null;

    const existingQuery = await client.query<CustomerLgpdRequestRow>(
      `SELECT *
       FROM customer_lgpd_requests
       WHERE account_id = $1
         AND request_type = $2
         AND status = 'open'
       ORDER BY created_at DESC
       LIMIT 1`,
      [account.id, input.type],
    );
    if (existingQuery.rows[0]) {
      return mapLgpdRequest(existingQuery.rows[0]);
    }

    const request = await createLgpdRequestInClient(client, {
      accountId: account.id,
      accountEmail: account.email,
      type: input.type,
      source: input.source,
      notes: input.notes,
    });

    if (input.type === 'erasure_request') {
      await createLgpdApprovalStageInClient(client, {
        requestId: request.id,
        stage: 'review',
        decision: 'pending',
        notes: 'Aguardando revisão operacional LGPD.',
      });
    }

    if (input.type === 'erasure_request') {
      await client.query(
        `UPDATE customer_accounts
         SET erasure_requested_at = COALESCE(erasure_requested_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [account.id],
      );
    }

    await insertAuditEvent(client, {
      accountId: account.id,
      event: `customer.lgpd.${input.type}.requested`,
      outcome: 'success',
      target: account.email,
      details: { source: input.source },
    });

    return request;
  });
  return result.available ? result.value : null;
}

export async function exportCustomerLgpdPackage(accountId: string): Promise<CustomerLgpdExportPackage | null> {
  const result = await withCustomerDb(async (client) => {
    const accountQuery = await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE id = $1 LIMIT 1', [accountId]);
    const row = accountQuery.rows[0];
    if (!row) return null;

    const [account, auditTrail] = await Promise.all([
      getAdminAccountRecordById(client, accountId),
      listCustomerAuditEventsByAccountId(client, accountId),
    ]);

    return {
      generatedAt: nowIso(),
      account,
      privacy: {
        deletedAt: toIso(row.deleted_at),
        erasureRequestedAt: toIso(row.erasure_requested_at),
        active: Boolean(row.active),
      },
      orders: account?.orders || [],
      addresses: account?.addresses || [],
      auditTrail,
    } satisfies CustomerLgpdExportPackage;
  });
  return result.available ? result.value : null;
}

export async function reviewCustomerLgpdRequest(
  requestId: string,
  input: {
    decision: 'approved' | 'rejected';
    actorUserId: string;
    actorUserName: string;
    notes?: string;
  },
): Promise<CustomerLgpdRequestRecord | null> {
  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      const requestQuery = await client.query<CustomerLgpdRequestRow>(
        `SELECT *
         FROM customer_lgpd_requests
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [requestId],
      );
      const request = requestQuery.rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return null;
      }
      if (request.request_type !== 'erasure_request') {
        await client.query('ROLLBACK');
        return null;
      }
      if (request.status !== 'open') {
        await client.query('ROLLBACK');
        const refreshed = await listCustomerLgpdRequestsInClient(client);
        return refreshed.find((entry) => entry.id === requestId) || null;
      }

      await createLgpdApprovalStageInClient(client, {
        requestId,
        stage: 'review',
        decision: input.decision,
        actorUserId: input.actorUserId,
        actorUserName: input.actorUserName,
        notes: input.notes,
      });

      if (input.decision === 'rejected') {
        await client.query(
          `UPDATE customer_lgpd_requests
           SET status = 'rejected',
               completed_at = NOW()
           WHERE id = $1`,
          [requestId],
        );
        if (request.account_id) {
          await client.query(
            `UPDATE customer_accounts
             SET erasure_requested_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [request.account_id],
          );
        }
      }

      await insertAuditEvent(client, {
        accountId: request.account_id,
        event: `customer.lgpd.review.${input.decision}`,
        outcome: 'success',
        target: request.account_email || request.account_id || null,
        details: {
          requestId,
          actorUserId: input.actorUserId,
          actorUserName: input.actorUserName,
        },
      });

      await client.query('COMMIT');
      const refreshed = await listCustomerLgpdRequestsInClient(client);
      return refreshed.find((entry) => entry.id === requestId) || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : null;
}

export async function updateCustomerRetentionPolicy(
  entityKey: string,
  input: {
    action: CustomerRetentionAction;
    retentionDays: number;
    legalBasis: string;
    enabled: boolean;
    actorUserId?: string | null;
  },
): Promise<CustomerRetentionPolicyRecord | null> {
  const result = await withCustomerDb(async (client) => {
    const normalizedKey = normalizeLine(entityKey, 80);
    if (!normalizedKey) return null;
    const query = await client.query<CustomerRetentionPolicyRow>(
      `UPDATE customer_retention_policies
       SET action = $2,
           retention_days = $3,
           legal_basis = $4,
           enabled = $5,
           updated_by = $6,
           updated_at = NOW()
       WHERE entity_key = $1
       RETURNING *`,
      [
        normalizedKey,
        input.action,
        Math.max(1, Math.floor(input.retentionDays || 0)),
        normalizeLine(input.legalBasis, 220) || 'Base legal não informada',
        Boolean(input.enabled),
        input.actorUserId || null,
      ],
    );
    return query.rows[0] ? mapRetentionPolicy(query.rows[0]) : null;
  });
  return result.available ? result.value : null;
}

function buildAnonymizedEmail(accountId: string): string {
  return `anon+${accountId}@redacted.local`;
}

function buildOrderAnonymizedSnapshot(accountId: string) {
  return {
    lgpd: {
      anonymized: true,
      accountReference: accountId,
      reason: 'customer_erasure',
      anonymizedAt: nowIso(),
    },
    customer: {
      name: 'Dados removidos',
      email: buildAnonymizedEmail(accountId),
      phone: null,
      document: null,
    },
  };
}

function buildShippingAnonymizedSnapshot() {
  return {
    selectedAddress: {
      street: 'Dados removidos',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'BRA',
    },
    deliveryOptions: [],
    pickupOptions: [],
    selectedOptionId: null,
    lgpd: {
      anonymized: true,
      reason: 'customer_erasure',
      anonymizedAt: nowIso(),
    },
  };
}

export async function anonymizeCustomerAccount(
  accountId: string,
  input?: {
    requestId?: string | null;
    actorType?: 'customer' | 'admin';
    actorId?: string | null;
    actorName?: string | null;
    notes?: string;
  },
): Promise<CustomerLgpdRequestRecord | null> {
  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      const accountQuery = await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE id = $1 LIMIT 1 FOR UPDATE', [accountId]);
      const account = accountQuery.rows[0];
      if (!account) {
        await client.query('ROLLBACK');
        return null;
      }

      let approvedRequestId = input?.requestId || null;
      if (input?.actorType === 'admin') {
        const approvedQuery = await client.query<CustomerLgpdRequestRow>(
          `SELECT req.*,
                  COALESCE(review.decision, 'pending_review') AS review_status
           FROM customer_lgpd_requests req
           LEFT JOIN LATERAL (
             SELECT decision
             FROM customer_lgpd_approvals approval
             WHERE approval.request_id = req.id
               AND approval.stage = 'review'
             ORDER BY approval.created_at DESC
             LIMIT 1
           ) review ON TRUE
           WHERE req.account_id = $1
             AND req.request_type = 'erasure_request'
             AND req.status = 'open'
           ORDER BY req.created_at DESC
           LIMIT 1`,
          [accountId],
        );
        const approvedRequest = approvedQuery.rows.find((entry) => entry.review_status === 'approved');
        if (!approvedRequest) {
          await client.query('ROLLBACK');
          return null;
        }
        approvedRequestId = approvedRequest.id;
      }

      const anonymizedEmail = buildAnonymizedEmail(accountId);

      await client.query(
        `UPDATE customer_accounts
         SET email = $2,
             first_name = NULL,
             last_name = NULL,
             full_name = 'Dados removidos por solicitação LGPD',
             phone = NULL,
             alternate_phone = NULL,
             birth_date_encrypted = NULL,
             tax_document_encrypted = NULL,
             tax_document_last4 = NULL,
             tax_document_hash = NULL,
             secondary_document_encrypted = NULL,
             company_name = NULL,
             trade_name = NULL,
             state_registration_encrypted = NULL,
             password_hash = NULL,
             failed_attempts = 0,
             lock_until = NULL,
             marketing_opt_in = FALSE,
             active = FALSE,
             deleted_at = COALESCE(deleted_at, NOW()),
             erasure_requested_at = COALESCE(erasure_requested_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [accountId, anonymizedEmail],
      );

      await client.query(
        `UPDATE customer_addresses
         SET label = 'Removido por LGPD',
             recipient = NULL,
             postal_code = NULL,
             street = NULL,
             number = NULL,
             complement = NULL,
             neighborhood = NULL,
             city = NULL,
             state = NULL,
             country = 'BRA',
             reference = NULL,
             phone = NULL,
             is_default_shipping = FALSE,
             is_default_billing = FALSE,
             deleted_at = COALESCE(deleted_at, NOW()),
             updated_at = NOW()
         WHERE account_id = $1`,
        [accountId],
      );

      await client.query(`DELETE FROM customer_sessions WHERE account_id = $1`, [accountId]);
      await client.query(`DELETE FROM customer_login_tokens WHERE account_id = $1`, [accountId]);
      await client.query(`UPDATE customer_orders SET account_id = NULL, address_summary = 'Dados removidos por solicitação LGPD' WHERE account_id = $1`, [accountId]);
      await client.query(
        `UPDATE commerce_orders
         SET customer_account_id = NULL,
             customer_email = $2,
             customer_snapshot_json = $3::jsonb,
             shipping_snapshot_json = $4::jsonb,
             updated_at = NOW()
         WHERE customer_account_id = $1`,
        [
          accountId,
          anonymizedEmail,
          JSON.stringify(buildOrderAnonymizedSnapshot(accountId)),
          JSON.stringify(buildShippingAnonymizedSnapshot()),
        ],
      );

      const request = await createLgpdRequestInClient(client, {
        accountId,
        accountEmail: account.email,
        type: 'anonymization',
        source: input?.actorType === 'customer' ? 'customer' : 'admin',
        notes: input?.notes,
      });

      await createLgpdApprovalStageInClient(client, {
        requestId: request.id,
        stage: 'execution',
        decision: 'approved',
        actorUserId: input?.actorId || null,
        actorUserName: input?.actorName || null,
        notes: input?.notes || 'Execução final da anonimização.',
      });

      await client.query(
        `UPDATE customer_lgpd_requests
         SET status = 'completed',
             completed_at = NOW()
         WHERE id = $1`,
        [request.id],
      );

      if (approvedRequestId) {
        await client.query(
          `UPDATE customer_lgpd_requests
           SET status = 'completed',
               completed_at = NOW()
           WHERE id = $1`,
          [approvedRequestId],
        );
      }

      await insertAuditEvent(client, {
        accountId,
        event: 'customer.lgpd.anonymized',
        outcome: 'success',
        target: account.email,
        details: {
          actorType: input?.actorType || 'admin',
          actorId: input?.actorId || null,
          actorName: input?.actorName || null,
          requestId: approvedRequestId,
        },
      });

      await client.query('COMMIT');
      return {
        ...request,
        status: 'completed',
        completedAt: nowIso(),
      } satisfies CustomerLgpdRequestRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  return result.available ? result.value : null;
}

export async function upsertCustomerAccountAdmin(
  input: CustomerAdminUpsertPayload & { accountId?: string },
): Promise<CustomerAdminRecord | null> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) return null;

  const taxDocument = normalizeDigits(input.taxDocument);
  if (!taxDocument) return null;

  const result = await withCustomerDb(async (client) => {
    const existing = input.accountId
      ? await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE id = $1 LIMIT 1', [input.accountId])
      : await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE email = $1 LIMIT 1', [normalizedEmail]);
    const current = existing.rows[0];

    const accountId = current?.id || input.accountId || `cst-${randomToken(6)}`;
    const firstName = normalizeLine(input.firstName, 80);
    const lastName = normalizeLine(input.lastName, 120);
    const companyName = normalizeLine(input.companyName, 180);
    const tradeName = normalizeLine(input.tradeName, 180);
    const fullName =
      input.kind === 'company'
        ? companyName || tradeName || current?.full_name || normalizedEmail
        : [firstName, lastName].filter(Boolean).join(' ') || current?.full_name || normalizedEmail;

    await client.query(
      `INSERT INTO customer_accounts (
        id, email, kind, first_name, last_name, full_name, phone, alternate_phone,
        birth_date_encrypted, tax_document_type, tax_document_encrypted, tax_document_last4, tax_document_hash,
        secondary_document_encrypted, company_name, trade_name, state_registration_encrypted, marketing_opt_in,
        accepted_privacy_at, accepted_terms_at, active, deleted_at, erasure_requested_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        CASE WHEN $19 THEN NOW() ELSE NULL END,
        CASE WHEN $20 THEN NOW() ELSE NULL END,
        $21, NULL, NULL, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        kind = EXCLUDED.kind,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        alternate_phone = EXCLUDED.alternate_phone,
        birth_date_encrypted = EXCLUDED.birth_date_encrypted,
        tax_document_type = EXCLUDED.tax_document_type,
        tax_document_encrypted = EXCLUDED.tax_document_encrypted,
        tax_document_last4 = EXCLUDED.tax_document_last4,
        tax_document_hash = EXCLUDED.tax_document_hash,
        secondary_document_encrypted = EXCLUDED.secondary_document_encrypted,
        company_name = EXCLUDED.company_name,
        trade_name = EXCLUDED.trade_name,
        state_registration_encrypted = EXCLUDED.state_registration_encrypted,
        marketing_opt_in = EXCLUDED.marketing_opt_in,
        accepted_privacy_at = CASE WHEN EXCLUDED.accepted_privacy_at IS NOT NULL THEN COALESCE(customer_accounts.accepted_privacy_at, EXCLUDED.accepted_privacy_at) ELSE customer_accounts.accepted_privacy_at END,
        accepted_terms_at = CASE WHEN EXCLUDED.accepted_terms_at IS NOT NULL THEN COALESCE(customer_accounts.accepted_terms_at, EXCLUDED.accepted_terms_at) ELSE customer_accounts.accepted_terms_at END,
        active = EXCLUDED.active,
        deleted_at = NULL,
        erasure_requested_at = NULL,
        updated_at = NOW()`,
      [
        accountId,
        normalizedEmail,
        input.kind,
        firstName || null,
        lastName || null,
        fullName,
        normalizeLine(input.phone, 30) || null,
        normalizeLine(input.alternatePhone, 30) || null,
        encryptCustomerData(normalizeLine(input.birthDate, 20)),
        input.taxDocumentType,
        encryptCustomerData(taxDocument),
        taxDocument.slice(-4),
        hashLookupValue(`${input.taxDocumentType}:${taxDocument}`),
        encryptCustomerData(normalizeLine(input.secondaryDocument, 60)),
        companyName || null,
        tradeName || null,
        encryptCustomerData(normalizeLine(input.stateRegistration, 60)),
        Boolean(input.marketingOptIn),
        Boolean(input.acceptedPrivacy),
        Boolean(input.acceptedTerms),
        input.active !== undefined ? Boolean(input.active) : true,
      ],
    );

    if (Array.isArray(input.addresses)) {
      await syncCustomerAddresses(client, accountId, input.addresses);
    }

    await insertAuditEvent(client, {
      accountId,
      event: current ? 'customer.admin.updated' : 'customer.admin.created',
      outcome: 'success',
      target: normalizedEmail,
      details: {
        active: input.active !== undefined ? Boolean(input.active) : true,
        addresses: Array.isArray(input.addresses) ? input.addresses.length : 0,
      },
    });

    return getAdminAccountRecordById(client, accountId);
  });

  return result.available ? result.value : null;
}

async function upsertCustomerAccountFromRegistration(
  client: PoolClient,
  input: CustomerRegistrationPayload,
  options?: { verifiedEmail?: boolean; passwordHash?: string },
): Promise<CustomerAccountRecord | null> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail || !input.acceptedPrivacy || !input.acceptedTerms) return null;
  const password = input.password?.trim() || '';
  if (!options?.passwordHash) {
    if (!password) return null;
    if (validateCustomerPassword(password)) return null;
  }

  const taxDocument = normalizeDigits(input.taxDocument);
  if (!taxDocument) return null;

  const secondaryDocument = normalizeLine(input.secondaryDocument, 60);
  const birthDate = normalizeLine(input.birthDate, 20);
  const firstName = normalizeLine(input.firstName, 80);
  const lastName = normalizeLine(input.lastName, 120);
  const companyName = normalizeLine(input.companyName, 180);
  const tradeName = normalizeLine(input.tradeName, 180);
  const phone = normalizeLine(input.phone, 30);
  const alternatePhone = normalizeLine(input.alternatePhone, 30);
  const stateRegistration = normalizeLine(input.stateRegistration, 60);
  const fullName =
    input.kind === 'company'
      ? companyName || tradeName || normalizedEmail
      : [firstName, lastName].filter(Boolean).join(' ') || normalizedEmail;
  const now = new Date().toISOString();
  const verifiedAt = options?.verifiedEmail ? now : null;
  const passwordHash = options?.passwordHash || (await hashPassword(password));

  const existing = await client.query<CustomerAccountRow>(
    `SELECT *
     FROM customer_accounts
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  let accountId = existing.rows[0]?.id || `cst-${randomToken(6)}`;

  await client.query(
    `INSERT INTO customer_accounts (
        id, email, kind, first_name, last_name, full_name, phone, alternate_phone,
        birth_date_encrypted, tax_document_type, tax_document_encrypted, tax_document_last4, tax_document_hash,
        secondary_document_encrypted, company_name, trade_name, state_registration_encrypted, password_hash, marketing_opt_in,
        accepted_privacy_at, accepted_terms_at, email_verified_at, active, deleted_at, erasure_requested_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, TRUE, NULL, NULL, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        kind = EXCLUDED.kind,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        alternate_phone = EXCLUDED.alternate_phone,
        birth_date_encrypted = COALESCE(EXCLUDED.birth_date_encrypted, customer_accounts.birth_date_encrypted),
        tax_document_type = EXCLUDED.tax_document_type,
        tax_document_encrypted = EXCLUDED.tax_document_encrypted,
        tax_document_last4 = EXCLUDED.tax_document_last4,
        tax_document_hash = EXCLUDED.tax_document_hash,
        secondary_document_encrypted = COALESCE(EXCLUDED.secondary_document_encrypted, customer_accounts.secondary_document_encrypted),
        company_name = EXCLUDED.company_name,
        trade_name = EXCLUDED.trade_name,
        state_registration_encrypted = COALESCE(EXCLUDED.state_registration_encrypted, customer_accounts.state_registration_encrypted),
        password_hash = COALESCE(EXCLUDED.password_hash, customer_accounts.password_hash),
        failed_attempts = 0,
        lock_until = NULL,
        marketing_opt_in = EXCLUDED.marketing_opt_in,
        accepted_privacy_at = COALESCE(customer_accounts.accepted_privacy_at, EXCLUDED.accepted_privacy_at),
        accepted_terms_at = COALESCE(customer_accounts.accepted_terms_at, EXCLUDED.accepted_terms_at),
        email_verified_at = CASE
          WHEN EXCLUDED.email_verified_at IS NOT NULL THEN COALESCE(customer_accounts.email_verified_at, EXCLUDED.email_verified_at)
          ELSE customer_accounts.email_verified_at
        END,
        active = TRUE,
        deleted_at = NULL,
        updated_at = NOW()`,
    [
      accountId,
      normalizedEmail,
      input.kind,
      firstName || null,
      lastName || null,
      fullName,
      phone || null,
      alternatePhone || null,
      encryptCustomerData(birthDate),
      input.taxDocumentType,
      encryptCustomerData(taxDocument),
      taxDocument.slice(-4),
      hashLookupValue(`${input.taxDocumentType}:${taxDocument}`),
      encryptCustomerData(secondaryDocument),
      companyName || null,
      tradeName || null,
      encryptCustomerData(stateRegistration),
      passwordHash,
      Boolean(input.marketingOptIn),
      now,
      now,
      verifiedAt,
    ],
  );

  const accountQuery = await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE email = $1 LIMIT 1', [normalizedEmail]);
  accountId = accountQuery.rows[0]?.id || accountId;

  await insertAuditEvent(client, {
    accountId,
    event: existing.rows[0] ? 'customer.account.updated' : 'customer.account.created',
    outcome: 'success',
    target: normalizedEmail,
    details: {
      kind: input.kind,
      marketingOptIn: Boolean(input.marketingOptIn),
      verifiedEmail: Boolean(options?.verifiedEmail),
    },
  });

  return getAccountRecordById(client, accountId);
}

export async function registerCustomerAccount(
  input: CustomerRegistrationPayload,
  options?: { verifiedEmail?: boolean },
): Promise<CustomerAccountRecord | null> {
  const result = await withCustomerDb(async (client) => upsertCustomerAccountFromRegistration(client, input, options));
  return result.available ? result.value : null;
}

export async function startCustomerRegistration(
  input: CustomerRegistrationPayload,
  options: {
    ttlMs?: number;
    requestCooldownMs?: number;
  } = {},
): Promise<CustomerRegistrationStartResult> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail || !input.acceptedPrivacy || !input.acceptedTerms) {
    return { ok: false, reason: 'database-unavailable' };
  }

  const password = input.password?.trim() || '';
  if (!password || validateCustomerPassword(password)) {
    return { ok: false, reason: 'database-unavailable' };
  }

  const taxDocument = normalizeDigits(input.taxDocument);
  if (!taxDocument) {
    return { ok: false, reason: 'database-unavailable' };
  }

  const taxDocumentHash = hashLookupValue(`${input.taxDocumentType}:${taxDocument}`);
  const ttlMs = Math.max(1000 * 60 * 5, options.ttlMs || CUSTOMER_ACCOUNT_SECURITY.registrationVerificationTtlMs);
  const cooldownMs = Math.max(
    1000 * 30,
    options.requestCooldownMs || CUSTOMER_ACCOUNT_SECURITY.registrationVerificationRequestCooldownMs,
  );
  const passwordHash = await hashPassword(password);

  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      await cleanupExpiredPendingRegistrations(client);

      const existingAccountQuery = await client.query<CustomerAccountRow>(
        `SELECT *
         FROM customer_accounts
         WHERE email = $1
           AND deleted_at IS NULL
           AND active = TRUE
         LIMIT 1`,
        [normalizedEmail],
      );
      const existingAccount = existingAccountQuery.rows[0];
      if (existingAccount?.email_verified_at) {
        await client.query('ROLLBACK');
        return { ok: false as const, reason: 'account-exists' as const };
      }

      if (taxDocumentHash) {
        const duplicateDocumentQuery = await client.query<{ email: string }>(
          `SELECT email
           FROM customer_accounts
           WHERE tax_document_hash = $1
             AND email <> $2
             AND deleted_at IS NULL
             AND active = TRUE
           LIMIT 1`,
          [taxDocumentHash, normalizedEmail],
        );
        if (duplicateDocumentQuery.rows[0]) {
          await client.query('ROLLBACK');
          return { ok: false as const, reason: 'document-in-use' as const };
        }
      }

      const currentPendingQuery = await client.query<CustomerPendingRegistrationRow>(
        `SELECT *
         FROM customer_pending_registrations
         WHERE email = $1
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1
         FOR UPDATE`,
        [normalizedEmail],
      );
      const currentPending = currentPendingQuery.rows[0];
      if (currentPending) {
        const age = Date.now() - new Date(currentPending.last_sent_at || currentPending.created_at).getTime();
        if (age < cooldownMs) {
          await client.query('ROLLBACK');
          return {
            ok: false as const,
            reason: 'cooldown-active' as const,
            retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - age) / 1000)),
            expiresAt: toIso(currentPending.expires_at),
          };
        }
      }

      const code = String(Number.parseInt(randomToken(3), 16) % 1000000).padStart(6, '0');
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const payload = JSON.stringify({
        ...input,
        email: normalizedEmail,
        taxDocument,
      });

      await client.query(
        `INSERT INTO customer_pending_registrations (
          id, email, payload_encrypted, password_hash, tax_document_hash, code_hash, created_at, last_sent_at, expires_at, used_at, channel
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, NULL, 'email'
        )
        ON CONFLICT (email) DO UPDATE SET
          payload_encrypted = EXCLUDED.payload_encrypted,
          password_hash = EXCLUDED.password_hash,
          tax_document_hash = EXCLUDED.tax_document_hash,
          code_hash = EXCLUDED.code_hash,
          last_sent_at = NOW(),
          expires_at = EXCLUDED.expires_at,
          used_at = NULL,
          channel = EXCLUDED.channel`,
        [
          currentPending?.id || `cpr-${randomToken(6)}`,
          normalizedEmail,
          encryptCustomerData(payload) || '',
          passwordHash,
          taxDocumentHash || null,
          sha256(code),
          expiresAt,
        ],
      );

      await insertAuditEvent(client, {
        accountId: existingAccount?.id || null,
        event: currentPending ? 'customer.registration.resent' : 'customer.registration.started',
        outcome: 'success',
        target: normalizedEmail,
      });

      await client.query('COMMIT');
      return { ok: true as const, email: normalizedEmail, requiresVerification: true as const, expiresAt, code };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (!result.available) {
    return { ok: false, reason: 'database-unavailable' };
  }

  if (!result.value.ok) {
    return result.value;
  }

  return {
    ok: true,
    email: result.value.email,
    requiresVerification: true,
    expiresAt: result.value.expiresAt,
    debugCode: result.value.code,
  };
}

export async function verifyPendingCustomerRegistration(
  email: string,
  code: string,
): Promise<CustomerAccountRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();
  if (!normalizedEmail || !normalizedCode) return null;

  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      await cleanupExpiredPendingRegistrations(client);

      const pendingQuery = await client.query<CustomerPendingRegistrationRow>(
        `SELECT *
         FROM customer_pending_registrations
         WHERE email = $1
           AND used_at IS NULL
           AND expires_at > NOW()
           AND code_hash = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [normalizedEmail, sha256(normalizedCode)],
      );
      const pending = pendingQuery.rows[0];
      if (!pending) {
        await client.query('ROLLBACK');
        return null;
      }

      const payload = parseRegistrationPayload(decryptCustomerData(pending.payload_encrypted));
      if (!payload) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('UPDATE customer_pending_registrations SET used_at = NOW() WHERE id = $1', [pending.id]);
      const account = await upsertCustomerAccountFromRegistration(client, payload, {
        verifiedEmail: true,
        passwordHash: pending.password_hash,
      });
      if (!account) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('DELETE FROM customer_pending_registrations WHERE email = $1', [normalizedEmail]);
      await insertAuditEvent(client, {
        accountId: account.profile.id,
        event: 'customer.registration.verified',
        outcome: 'success',
        target: normalizedEmail,
      });

      await client.query('COMMIT');
      return account;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : null;
}

export async function issueLoginTokenForCustomerEmail(email: string): Promise<
  | { ok: true; code: string; expiresAt: string; accountId: string }
  | {
      ok: false;
      reason: 'user-not-found' | 'email-not-verified' | 'cooldown-active' | 'database-unavailable';
      retryAfterSeconds?: number;
      expiresAt?: string;
    }
> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { ok: false, reason: 'user-not-found' };

  const result = await withCustomerDb(async (client) => {
    await cleanupExpiredPendingRegistrations(client);
    const accountQuery = await client.query<CustomerAccountRow>(
      `SELECT *
       FROM customer_accounts
       WHERE email = $1
         AND deleted_at IS NULL
         AND active = TRUE
       LIMIT 1`,
      [normalizedEmail],
    );
    const account = accountQuery.rows[0];
    if (!account) return { ok: false as const, reason: 'user-not-found' as const };
    if (!account.email_verified_at) return { ok: false as const, reason: 'email-not-verified' as const };

    await client.query('BEGIN');
    try {
      const existingQuery = await client.query<CustomerLoginTokenRow>(
        `SELECT *
         FROM customer_login_tokens
         WHERE account_id = $1
           AND used_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         FOR UPDATE`,
        [account.id],
      );

      const current = existingQuery.rows[0];
      if (current) {
        const age = Date.now() - new Date(current.created_at).getTime();
        if (age < CUSTOMER_ACCOUNT_SECURITY.loginTokenRequestCooldownMs) {
          await client.query('ROLLBACK');
          return {
            ok: false as const,
            reason: 'cooldown-active' as const,
            retryAfterSeconds: Math.max(1, Math.ceil((CUSTOMER_ACCOUNT_SECURITY.loginTokenRequestCooldownMs - age) / 1000)),
            expiresAt: toIso(current.expires_at),
          };
        }

        await client.query(
          `UPDATE customer_login_tokens
           SET used_at = NOW()
           WHERE account_id = $1
             AND used_at IS NULL
             AND expires_at > NOW()`,
          [account.id],
        );
      }

      const code = String(Number.parseInt(randomToken(3), 16) % 1000000).padStart(6, '0');
      const expiresAt = new Date(Date.now() + CUSTOMER_ACCOUNT_SECURITY.loginTokenTtlMs).toISOString();

      await client.query(
        `INSERT INTO customer_login_tokens (id, account_id, code_hash, created_at, expires_at, channel)
         VALUES ($1, $2, $3, NOW(), $4, 'email')`,
        [`clt-${randomToken(6)}`, account.id, sha256(code), expiresAt],
      );

      await insertAuditEvent(client, {
        accountId: account.id,
        event: 'customer.login-token.requested',
        outcome: 'success',
        target: account.email,
      });

      await client.query('COMMIT');
      return { ok: true as const, code, expiresAt, accountId: account.id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : { ok: false, reason: 'database-unavailable' };
}

export async function consumeCustomerLoginToken(email: string, code: string): Promise<CustomerAccountProfile | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();
  if (!normalizedEmail || !normalizedCode) return null;

  const result = await withCustomerDb(async (client) => {
    await client.query('BEGIN');
    try {
      const accountQuery = await client.query<CustomerAccountRow>(
        `SELECT *
         FROM customer_accounts
         WHERE email = $1
           AND deleted_at IS NULL
           AND active = TRUE
         LIMIT 1`,
        [normalizedEmail],
      );
      const account = accountQuery.rows[0];
      if (!account) {
        await client.query('ROLLBACK');
        return null;
      }

      const tokenQuery = await client.query<CustomerLoginTokenRow>(
        `SELECT *
         FROM customer_login_tokens
         WHERE account_id = $1
           AND used_at IS NULL
           AND expires_at > NOW()
           AND code_hash = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [account.id, sha256(normalizedCode)],
      );
      const token = tokenQuery.rows[0];
      if (!token) {
        await insertAuditEvent(client, {
          accountId: account.id,
          event: 'customer.login-token.invalid',
          outcome: 'failure',
          target: account.email,
        });
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('UPDATE customer_login_tokens SET used_at = NOW() WHERE id = $1', [token.id]);
      await client.query('UPDATE customer_accounts SET email_verified_at = COALESCE(email_verified_at, NOW()), last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [account.id]);

      await insertAuditEvent(client, {
        accountId: account.id,
        event: 'customer.login-token.verified',
        outcome: 'success',
        target: account.email,
      });

      await client.query('COMMIT');
      return mapAccountProfile(account);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return result.available ? result.value : null;
}

export async function createCustomerSession(input: {
  accountId: string;
  userAgent: string;
  ip: string;
}): Promise<{ session: CustomerAccountSession; rawSessionId: string; csrfToken: string } | null> {
  const result = await withCustomerDb(async (client) => {
    const rawSessionId = randomToken(24);
    const id = sha256(rawSessionId);
    const now = Date.now();
    const hardExpiresAt = new Date(now + CUSTOMER_ACCOUNT_SECURITY.sessionTtlMs).toISOString();
    const idleExpiresAt = new Date(Math.min(new Date(hardExpiresAt).getTime(), now + CUSTOMER_ACCOUNT_SECURITY.sessionIdleTtlMs)).toISOString();

    await client.query(
      `INSERT INTO customer_sessions (
        id, account_id, csrf_token, created_at, hard_expires_at, expires_at, last_seen_at, user_agent_hash, ip_hash
      ) VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6, $7)`,
      [id, input.accountId, randomToken(16), hardExpiresAt, idleExpiresAt, sha256(input.userAgent || 'unknown-ua'), sha256(input.ip || 'unknown-ip')],
    );

    const query = await client.query<CustomerSessionRow>('SELECT * FROM customer_sessions WHERE id = $1 LIMIT 1', [id]);
    const accountQuery = await client.query<CustomerAccountRow>('SELECT email FROM customer_accounts WHERE id = $1 LIMIT 1', [input.accountId]);
    const email = accountQuery.rows[0]?.email || '';
    return {
      session: mapSession(query.rows[0], email),
      rawSessionId,
      csrfToken: query.rows[0]?.csrf_token || '',
    };
  });

  if (!result.available || !result.value) return null;
  return {
    session: result.value.session,
    rawSessionId: result.value.rawSessionId,
    csrfToken: result.value.csrfToken,
  };
}

export async function getCustomerSession(
  rawSessionId: string,
): Promise<{ account: CustomerAccountRecord; session: CustomerAccountSession; csrfToken: string; userAgentHash: string; ipHash: string } | null> {
  const result = await withCustomerDb(async (client) => {
    const sessionQuery = await client.query<CustomerSessionRow>('SELECT * FROM customer_sessions WHERE id = $1 LIMIT 1', [sha256(rawSessionId)]);
    const row = sessionQuery.rows[0];
    if (!row) return null;
    if (Date.now() >= new Date(row.expires_at).getTime()) {
      await client.query('DELETE FROM customer_sessions WHERE id = $1', [sha256(rawSessionId)]);
      return null;
    }
    const account = await getAccountRecordById(client, row.account_id);
    if (!account) {
      await client.query('DELETE FROM customer_sessions WHERE id = $1', [sha256(rawSessionId)]);
      return null;
    }
    return {
      account,
      session: mapSession(row, account.profile.email),
      csrfToken: row.csrf_token,
      userAgentHash: row.user_agent_hash,
      ipHash: row.ip_hash,
    };
  });

  return result.available ? result.value : null;
}

export async function touchCustomerSession(
  rawSessionId: string,
): Promise<{ account: CustomerAccountRecord; session: CustomerAccountSession; csrfToken: string; userAgentHash: string; ipHash: string } | null> {
  const result = await withCustomerDb(async (client) => {
    const sessionQuery = await client.query<CustomerSessionRow>('SELECT * FROM customer_sessions WHERE id = $1 LIMIT 1', [sha256(rawSessionId)]);
    const row = sessionQuery.rows[0];
    if (!row) return null;

    const hardExpiresAt = new Date(row.hard_expires_at).getTime();
    if (hardExpiresAt <= Date.now()) {
      await client.query('DELETE FROM customer_sessions WHERE id = $1', [sha256(rawSessionId)]);
      return null;
    }

    const expiresAt = new Date(Math.min(hardExpiresAt, Date.now() + CUSTOMER_ACCOUNT_SECURITY.sessionIdleTtlMs)).toISOString();
    await client.query(
      `UPDATE customer_sessions
       SET expires_at = $2,
           last_seen_at = NOW()
       WHERE id = $1`,
      [sha256(rawSessionId), expiresAt],
    );

    const refreshed = await client.query<CustomerSessionRow>('SELECT * FROM customer_sessions WHERE id = $1 LIMIT 1', [sha256(rawSessionId)]);
    const nextRow = refreshed.rows[0];
    if (!nextRow) return null;
    const account = await getAccountRecordById(client, nextRow.account_id);
    if (!account) return null;
    return {
      account,
      session: mapSession(nextRow, account.profile.email),
      csrfToken: nextRow.csrf_token,
      userAgentHash: nextRow.user_agent_hash,
      ipHash: nextRow.ip_hash,
    };
  });

  return result.available ? result.value : null;
}

export async function deleteCustomerSession(rawSessionId: string): Promise<void> {
  const result = await withCustomerDb(async (client) => {
    await client.query('DELETE FROM customer_sessions WHERE id = $1', [sha256(rawSessionId)]);
  });
  void result;
}

export async function updateCustomerProfile(
  accountId: string,
  input: Partial<CustomerRegistrationPayload> & {
    email?: string;
    acceptedPrivacy?: boolean;
    acceptedTerms?: boolean;
  },
): Promise<CustomerAccountRecord | null> {
  const result = await withCustomerDb(async (client) => {
    const existingQuery = await client.query<CustomerAccountRow>('SELECT * FROM customer_accounts WHERE id = $1 LIMIT 1', [accountId]);
    const existing = existingQuery.rows[0];
    if (!existing) return null;

    const nextEmail = normalizeEmail(input.email || existing.email);
    const nextKind = input.kind || existing.kind;
    const firstName = normalizeLine(input.firstName, 80) ?? existing.first_name ?? undefined;
    const lastName = normalizeLine(input.lastName, 120) ?? existing.last_name ?? undefined;
    const companyName = normalizeLine(input.companyName, 180) ?? existing.company_name ?? undefined;
    const tradeName = normalizeLine(input.tradeName, 180) ?? existing.trade_name ?? undefined;
    const fullName =
      nextKind === 'company'
        ? companyName || tradeName || existing.full_name || nextEmail
        : [firstName, lastName].filter(Boolean).join(' ') || existing.full_name || nextEmail;
    const taxDocument = normalizeDigits(input.taxDocument) || decryptCustomerData(existing.tax_document_encrypted);
    const secondaryDocument = normalizeLine(input.secondaryDocument, 60) ?? decryptCustomerData(existing.secondary_document_encrypted);
    const birthDate = normalizeLine(input.birthDate, 20) ?? decryptCustomerData(existing.birth_date_encrypted);
    const stateRegistration = normalizeLine(input.stateRegistration, 60) ?? decryptCustomerData(existing.state_registration_encrypted);

    await client.query(
      `UPDATE customer_accounts
       SET email = $2,
           kind = $3,
           first_name = $4,
           last_name = $5,
           full_name = $6,
           phone = $7,
           alternate_phone = $8,
           birth_date_encrypted = $9,
           tax_document_type = $10,
           tax_document_encrypted = $11,
           tax_document_last4 = $12,
           tax_document_hash = $13,
           secondary_document_encrypted = $14,
           company_name = $15,
           trade_name = $16,
           state_registration_encrypted = $17,
           marketing_opt_in = $18,
           accepted_privacy_at = CASE WHEN $19 THEN COALESCE(accepted_privacy_at, NOW()) ELSE accepted_privacy_at END,
           accepted_terms_at = CASE WHEN $20 THEN COALESCE(accepted_terms_at, NOW()) ELSE accepted_terms_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [
        accountId,
        nextEmail,
        nextKind,
        firstName || null,
        lastName || null,
        fullName,
        normalizeLine(input.phone, 30) ?? existing.phone ?? null,
        normalizeLine(input.alternatePhone, 30) ?? existing.alternate_phone ?? null,
        encryptCustomerData(birthDate),
        input.taxDocumentType || existing.tax_document_type,
        encryptCustomerData(taxDocument),
        taxDocument ? taxDocument.slice(-4) : null,
        hashLookupValue(`${input.taxDocumentType || existing.tax_document_type}:${taxDocument || ''}`),
        encryptCustomerData(secondaryDocument),
        companyName || null,
        tradeName || null,
        encryptCustomerData(stateRegistration),
        input.marketingOptIn ?? existing.marketing_opt_in,
        Boolean(input.acceptedPrivacy),
        Boolean(input.acceptedTerms),
      ],
    );

    await insertAuditEvent(client, {
      accountId,
      event: 'customer.profile.updated',
      outcome: 'success',
      target: nextEmail,
    });

    return getAccountRecordById(client, accountId);
  });

  return result.available ? result.value : null;
}

export async function upsertCustomerAddress(
  accountId: string,
  input: Omit<CustomerAccountAddress, 'id' | 'updatedAt' | 'createdAt'> & { id?: string },
): Promise<CustomerAccountAddress | null> {
  const result = await withCustomerDb(async (client) => {
    return upsertCustomerAddressInClient(client, accountId, input);
  });

  return result.available ? result.value : null;
}

export async function deleteCustomerAddress(accountId: string, addressId: string): Promise<boolean> {
  const result = await withCustomerDb(async (client) => {
    const query = await client.query(
      `UPDATE customer_addresses
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1
         AND account_id = $2
         AND deleted_at IS NULL`,
      [addressId, accountId],
    );
    return (query.rowCount || 0) > 0;
  });

  return result.available ? result.value : false;
}

export async function ensureCustomerCheckoutAccount(input: {
  email: string;
  shippingAddress?: Address | null;
  clientProfileData?: ClientProfileData | null;
}): Promise<string | null> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) return null;

  const result = await withCustomerDb(async (client) => {
    const accountQuery = await client.query<CustomerAccountRow>(
      `SELECT *
       FROM customer_accounts
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    const existing = accountQuery.rows[0];
    const accountId = existing?.id || `cst-${randomToken(6)}`;
    const firstName = normalizeLine(input.clientProfileData?.firstName, 80);
    const lastName = normalizeLine(input.clientProfileData?.lastName, 120);
    const document = normalizeDigits(input.clientProfileData?.document || '');
    const phone = normalizeLine(input.clientProfileData?.phone, 30);
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || existing?.full_name || normalizedEmail;

    await client.query(
      `INSERT INTO customer_accounts (
        id, email, kind, first_name, last_name, full_name, phone, tax_document_type, tax_document_encrypted,
        tax_document_last4, tax_document_hash, active, created_at, updated_at
      ) VALUES (
        $1, $2, 'individual', $3, $4, $5, $6, 'cpf', $7, $8, $9, TRUE, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(customer_accounts.first_name, EXCLUDED.first_name),
        last_name = COALESCE(customer_accounts.last_name, EXCLUDED.last_name),
        full_name = COALESCE(customer_accounts.full_name, EXCLUDED.full_name),
        phone = COALESCE(customer_accounts.phone, EXCLUDED.phone),
        tax_document_encrypted = COALESCE(customer_accounts.tax_document_encrypted, EXCLUDED.tax_document_encrypted),
        tax_document_last4 = COALESCE(customer_accounts.tax_document_last4, EXCLUDED.tax_document_last4),
        tax_document_hash = COALESCE(customer_accounts.tax_document_hash, EXCLUDED.tax_document_hash),
        updated_at = NOW(),
        active = TRUE,
        deleted_at = NULL`,
      [
        accountId,
        normalizedEmail,
        firstName || null,
        lastName || null,
        fullName,
        phone || null,
        encryptCustomerData(document),
        document ? document.slice(-4) : null,
        document ? hashLookupValue(`cpf:${document}`) : null,
      ],
    );

    if (input.shippingAddress?.street || input.shippingAddress?.postalCode) {
      await upsertCustomerAddress(accountId, {
        label: 'Último endereço usado',
        recipient: fullName,
        postalCode: input.shippingAddress.postalCode,
        street: input.shippingAddress.street,
        number: input.shippingAddress.number,
        complement: input.shippingAddress.complement,
        neighborhood: input.shippingAddress.neighborhood,
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        country: input.shippingAddress.country,
        isDefaultShipping: existing ? false : true,
        isDefaultBilling: false,
      });
    }

    return accountId;
  });

  return result.available ? result.value : null;
}

export async function projectCustomerCheckoutOrders(input: {
  accountId: string;
  paymentMethod: string;
  orders: Array<{
    id: string;
    groupOrderId?: string | null;
    splitSequence?: number | null;
    splitTotal?: number | null;
    totalValue: number;
    shippingValue: number;
    items: OrderFormItem[];
    shippingAddress?: Address | null;
  }>;
}): Promise<void> {
  if (!input.accountId || !Array.isArray(input.orders) || !input.orders.length) return;

  await withCustomerDb(async (client) => {
    for (const order of input.orders) {
      await client.query(
        `INSERT INTO customer_orders (
          id, account_id, group_order_id, split_sequence, split_total, placed_at, status, payment_method,
          total_value, shipping_value, items_count, items_json, address_summary, source
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), 'created', $6,
          $7, $8, $9, $10::jsonb, $11, 'checkout'
        )
        ON CONFLICT (id) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          group_order_id = EXCLUDED.group_order_id,
          split_sequence = EXCLUDED.split_sequence,
          split_total = EXCLUDED.split_total,
          payment_method = EXCLUDED.payment_method,
          total_value = EXCLUDED.total_value,
          shipping_value = EXCLUDED.shipping_value,
          items_count = EXCLUDED.items_count,
          items_json = EXCLUDED.items_json,
          address_summary = EXCLUDED.address_summary`,
        [
          order.id,
          input.accountId,
          order.groupOrderId || null,
          order.splitSequence || null,
          order.splitTotal || null,
          input.paymentMethod || 'Não informado',
          Number(order.totalValue || 0),
          Number(order.shippingValue || 0),
          order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          JSON.stringify(
            order.items.map((item) => ({
              id: item.id,
              name: item.name,
              image: item.image,
              quantity: Number(item.quantity || 0),
              price: Number(item.price || 0),
            })),
          ),
          formatAddressSummary(order.shippingAddress),
        ],
      );
    }
  });
}

export async function buildCustomerMeResponse(rawSessionId: string | undefined): Promise<CustomerAccountMeResponse> {
  if (!rawSessionId) {
    return { authenticated: false, session: null, account: null };
  }
  const resolved = await touchCustomerSession(rawSessionId);
  if (!resolved) {
    return { authenticated: false, session: null, account: null };
  }
  return {
    authenticated: true,
    session: resolved.session,
    account: resolved.account,
  };
}
