import 'server-only';

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import type {
  DataBootstrapState,
  DataConnectionProfile,
  DataEntityDefinition,
  DataFieldDefinition,
  DataFieldType,
  DataImportPayload,
  DataImportRecord,
  DataStudioBundle,
  DataStudioBundleFile,
  DataStudioSnapshot,
} from '@/features/ecommpanel/types/dataStudio';
import { DATA_FIELD_TYPES } from '@/features/ecommpanel/types/dataStudio';
import { generateDataStudioContracts } from './dataEntityContracts';
import { nowIso, randomToken } from './crypto';
import {
  buildMysqlPanelBootstrapSql,
  buildPostgresPanelBootstrapSql,
  type DataProvisioningInspection,
  type DataProvisioningSecrets,
  inspectMysqlProvisioning,
  inspectPostgresProvisioning,
  provisionMysqlConnection,
  provisionPostgresConnection,
} from './dataProvisioning';

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/data-studio');
const SNAPSHOT_FILE = path.join(ROOT_DIR, 'schema.json');
const IMPORTS_DIR = path.join(ROOT_DIR, 'imports');

type PersistedSnapshot = DataStudioSnapshot;

type SaveEntityInput = {
  id?: string;
  slug: string;
  label: string;
  tableName?: string;
  description?: string;
  status?: DataEntityDefinition['status'];
  fields?: Array<Partial<DataFieldDefinition>>;
};

type SaveConnectionInput = {
  id?: string;
  label: string;
  engine?: DataConnectionProfile['engine'];
  host: string;
  port?: number;
  database: string;
  username: string;
  passwordReference?: string;
  appHostPattern?: string;
  sslMode?: DataConnectionProfile['sslMode'];
  provisioningMethod?: DataConnectionProfile['provisioningMethod'];
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  adminDatabase?: string;
  adminUsername?: string;
  adminPasswordReference?: string;
  notes?: string;
  active?: boolean;
};

type BootstrapUpdateInput = Partial<
  Pick<
    DataBootstrapState,
    'credentialsVerified' | 'databaseProvisioned' | 'seedAdminProvisioned' | 'boilerplateProvisioned' | 'activeConnectionId' | 'notes'
  >
>;

type ImportBundleInput = {
  entities?: unknown;
  records?: Record<string, unknown[]>;
};

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
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function ensureDirs(): void {
  fs.mkdirSync(ROOT_DIR, { recursive: true });
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeTableName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function sanitizeHost(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function sanitizeUserHostPattern(value: string): string {
  return value.replace(/\s+/g, '').trim() || 'localhost';
}

function sanitizeEngine(value: string | undefined): DataConnectionProfile['engine'] {
  return value === 'mysql' ? 'mysql' : 'postgresql';
}

function sanitizeProvisioningMethod(value: string | undefined): DataConnectionProfile['provisioningMethod'] {
  if (value === 'ssh_postgres') return 'ssh_postgres';
  if (value === 'ssh_mysql') return 'ssh_mysql';
  return 'manual';
}

function isFieldType(value: string): value is DataFieldType {
  return (DATA_FIELD_TYPES as readonly string[]).includes(value);
}

function sanitizeField(field: Partial<DataFieldDefinition>, fallbackName: string): DataFieldDefinition {
  const createdAt = field.createdAt || nowIso();
  const updatedAt = nowIso();
  const normalizedName = sanitizeTableName(field.name || fallbackName || `field_${randomToken(4)}`) || `field_${randomToken(4)}`;
  const label = sanitizeLine(field.label || normalizedName.replace(/_/g, ' ')) || normalizedName;
  const rawType = sanitizeLine(String(field.type || 'text'));

  return {
    id: field.id || `fld-${randomToken(6)}`,
    name: normalizedName,
    label,
    type: isFieldType(rawType) ? rawType : 'text',
    description: sanitizeLine(field.description || ''),
    required: Boolean(field.required),
    unique: Boolean(field.unique),
    indexed: Boolean(field.indexed),
    listVisible: field.listVisible !== false,
    defaultValue: sanitizeLine(field.defaultValue || '') || undefined,
    referenceEntityId: sanitizeLine(field.referenceEntityId || '') || undefined,
    createdAt,
    updatedAt,
  };
}

function createSeedSnapshot(): PersistedSnapshot {
  const now = nowIso();
  const localConnection: DataConnectionProfile = {
    id: 'conn-local-postgres',
    label: 'Postgres local padrão',
    engine: 'postgresql',
    host: '127.0.0.1',
    port: 5432,
    database: 'app_hub',
    username: 'app_hub',
    passwordReference: 'APP_DB_PASSWORD',
    appHostPattern: 'localhost',
    sslMode: 'disable',
    provisioningMethod: 'manual',
    sshHost: '127.0.0.1',
    sshPort: 22,
    sshUsername: 'root',
    adminDatabase: 'postgres',
    adminUsername: 'postgres',
    adminPasswordReference: 'APP_DB_ADMIN_PASSWORD',
    active: true,
    notes: 'Perfil inicial para desenvolvimento e primeiro bootstrap local.',
    reachability: 'unknown',
    credentialStatus: 'unknown',
    createdAt: now,
    updatedAt: now,
  };

  const customers: DataEntityDefinition = {
    id: 'ent-customers',
    slug: 'customers',
    label: 'Clientes',
    tableName: 'customer_accounts',
    description: 'Base principal de clientes com PF/PJ, documentos, consentimentos e status da conta.',
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    fields: [
      sanitizeField({ id: 'fld-customers-email', name: 'email', label: 'E-mail', type: 'email', required: true, unique: true, indexed: true }, 'email'),
      sanitizeField({ id: 'fld-customers-kind', name: 'kind', label: 'Tipo de cadastro', required: true, indexed: true, defaultValue: 'individual' }, 'kind'),
      sanitizeField({ id: 'fld-customers-first-name', name: 'first_name', label: 'Primeiro nome', required: true, indexed: true }, 'first_name'),
      sanitizeField({ id: 'fld-customers-last-name', name: 'last_name', label: 'Sobrenome', indexed: true }, 'last_name'),
      sanitizeField({ id: 'fld-customers-full-name', name: 'full_name', label: 'Nome completo / razão social', required: true, indexed: true }, 'full_name'),
      sanitizeField({ id: 'fld-customers-phone', name: 'phone', label: 'Telefone', indexed: true }, 'phone'),
      sanitizeField({ id: 'fld-customers-alt-phone', name: 'alternate_phone', label: 'Telefone alternativo' }, 'alternate_phone'),
      sanitizeField({ id: 'fld-customers-birth-date', name: 'birth_date_encrypted', label: 'Nascimento', type: 'date' }, 'birth_date_encrypted'),
      sanitizeField({ id: 'fld-customers-tax-type', name: 'tax_document_type', label: 'Tipo de documento', required: true, indexed: true, defaultValue: 'cpf' }, 'tax_document_type'),
      sanitizeField({ id: 'fld-customers-tax-doc', name: 'tax_document_encrypted', label: 'CPF / CNPJ', required: true }, 'tax_document_encrypted'),
      sanitizeField({ id: 'fld-customers-rg-ie', name: 'secondary_document_encrypted', label: 'RG / documento secundário' }, 'secondary_document_encrypted'),
      sanitizeField({ id: 'fld-customers-company-name', name: 'company_name', label: 'Razão social' }, 'company_name'),
      sanitizeField({ id: 'fld-customers-trade-name', name: 'trade_name', label: 'Nome fantasia' }, 'trade_name'),
      sanitizeField({ id: 'fld-customers-state-registration', name: 'state_registration_encrypted', label: 'Inscrição estadual' }, 'state_registration_encrypted'),
      sanitizeField({ id: 'fld-customers-marketing', name: 'marketing_opt_in', label: 'Aceita marketing', type: 'boolean', defaultValue: 'false' }, 'marketing_opt_in'),
      sanitizeField({ id: 'fld-customers-accepted-privacy', name: 'accepted_privacy_at', label: 'Privacidade aceita', type: 'date' }, 'accepted_privacy_at'),
      sanitizeField({ id: 'fld-customers-accepted-terms', name: 'accepted_terms_at', label: 'Termos aceitos', type: 'date' }, 'accepted_terms_at'),
      sanitizeField({ id: 'fld-customers-active', name: 'active', label: 'Conta ativa', type: 'boolean', required: true, indexed: true, defaultValue: 'true' }, 'active'),
    ],
  };

  const blogPosts: DataEntityDefinition = {
    id: 'ent-blog-posts',
    slug: 'blog-posts',
    label: 'Posts do Blog',
    tableName: 'app_blog_posts',
    description: 'Estrutura editorial para posts, resumo, SEO e estado de publicação.',
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    fields: [
      sanitizeField({ id: 'fld-blog-title', name: 'title', label: 'Título', required: true, indexed: true }, 'title'),
      sanitizeField({ id: 'fld-blog-slug', name: 'slug', label: 'Slug', type: 'slug', required: true, unique: true, indexed: true }, 'slug'),
      sanitizeField({ id: 'fld-blog-excerpt', name: 'excerpt', label: 'Resumo', type: 'rich_text' }, 'excerpt'),
      sanitizeField({ id: 'fld-blog-status', name: 'status', label: 'Status', required: true, indexed: true, defaultValue: 'draft' }, 'status'),
      sanitizeField({ id: 'fld-blog-seo', name: 'seo', label: 'SEO', type: 'json' }, 'seo'),
    ],
  };

  const catalogProducts: DataEntityDefinition = {
    id: 'ent-catalog-products',
    slug: 'catalog-products',
    label: 'Produtos',
    tableName: 'app_catalog_products',
    description: 'Produto pai com venda por unidade/peso, embalagem, merchandising e estrutura para variações por segmento.',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    fields: [
      sanitizeField({ id: 'fld-products-name', name: 'name', label: 'Nome', required: true, indexed: true }, 'name'),
      sanitizeField({ id: 'fld-products-slug', name: 'slug', label: 'Slug', type: 'slug', required: true, unique: true, indexed: true }, 'slug'),
      sanitizeField({ id: 'fld-products-sku', name: 'sku', label: 'SKU', required: true, indexed: true }, 'sku'),
      sanitizeField({ id: 'fld-products-status', name: 'status', label: 'Status', required: true, indexed: true, defaultValue: 'draft' }, 'status'),
      sanitizeField({ id: 'fld-products-active', name: 'is_active', label: 'Ativo', type: 'boolean', defaultValue: 'true', indexed: true }, 'is_active'),
      sanitizeField({ id: 'fld-products-brand', name: 'brand', label: 'Marca', indexed: true }, 'brand'),
      sanitizeField({ id: 'fld-products-category-id', name: 'category_id', label: 'Categoria principal', indexed: true }, 'category_id'),
      sanitizeField({ id: 'fld-products-collections', name: 'collections', label: 'Coleções', type: 'json' }, 'collections'),
      sanitizeField({ id: 'fld-products-description', name: 'description', label: 'Descrição', type: 'rich_text' }, 'description'),
      sanitizeField({ id: 'fld-products-commercial-unit', name: 'commercial_unit', label: 'Unidade comercial', type: 'json' }, 'commercial_unit'),
      sanitizeField({ id: 'fld-products-packaging', name: 'packaging', label: 'Embalagem', type: 'json' }, 'packaging'),
      sanitizeField({ id: 'fld-products-merchandising', name: 'merchandising', label: 'Merchandising', type: 'json' }, 'merchandising'),
      sanitizeField({ id: 'fld-products-variants', name: 'variants', label: 'Variações', type: 'json' }, 'variants'),
      sanitizeField({ id: 'fld-products-attributes', name: 'attributes', label: 'Atributos', type: 'json' }, 'attributes'),
      sanitizeField({ id: 'fld-products-stock', name: 'stock', label: 'Estoque', type: 'json' }, 'stock'),
      sanitizeField({ id: 'fld-products-pricing', name: 'pricing', label: 'Preço e promoções', type: 'json' }, 'pricing'),
      sanitizeField({ id: 'fld-products-metadata', name: 'metadata', label: 'Metadados', type: 'json' }, 'metadata'),
    ],
  };

  return {
    schemaVersion: 1,
    updatedAt: now,
    entities: [customers, blogPosts, catalogProducts],
    imports: [],
    connections: [localConnection],
      bootstrap: {
        activeConnectionId: localConnection.id,
        credentialsVerified: false,
        databaseProvisioned: false,
        seedAdminProvisioned: false,
        boilerplateProvisioned: false,
        notes: 'O painel começa com um perfil local padrão. Ajuste host, banco e referência da senha quando necessário.',
      },
  };
}

function loadSnapshot(): PersistedSnapshot {
  ensureDirs();
  const stored = readJsonFile<PersistedSnapshot>(SNAPSHOT_FILE);
  if (stored?.entities?.length) {
    return {
      schemaVersion: 1,
      updatedAt: stored.updatedAt || nowIso(),
      entities: stored.entities.map((entity) => ({
        ...entity,
        fields: (entity.fields || []).map((field, index) => sanitizeField(field, field.name || `field_${index + 1}`)),
      })),
      imports: Array.isArray(stored.imports) ? stored.imports : [],
      connections: Array.isArray(stored.connections)
        ? stored.connections.map((connection) => ({
            id: connection.id || `conn-${randomToken(6)}`,
            label: sanitizeLine(connection.label || 'Conexão sem nome') || 'Conexão sem nome',
            engine: sanitizeEngine(connection.engine),
            host: sanitizeHost(connection.host || '127.0.0.1') || '127.0.0.1',
            port: Number.isFinite(connection.port)
              ? Number(connection.port)
              : sanitizeEngine(connection.engine) === 'mysql'
                ? 3306
                : 5432,
            database: sanitizeTableName(connection.database || 'app_hub') || 'app_hub',
            username: sanitizeLine(connection.username || 'app_hub') || 'app_hub',
            passwordReference: sanitizeLine(connection.passwordReference || 'APP_DB_PASSWORD') || 'APP_DB_PASSWORD',
            appHostPattern: sanitizeUserHostPattern(connection.appHostPattern || 'localhost'),
            sslMode: connection.sslMode === 'require' ? 'require' : connection.sslMode === 'prefer' ? 'prefer' : 'disable',
            provisioningMethod: sanitizeProvisioningMethod(connection.provisioningMethod),
            sshHost: sanitizeHost(connection.sshHost || connection.host || '127.0.0.1') || '127.0.0.1',
            sshPort: Number.isFinite(connection.sshPort) ? Number(connection.sshPort) : 22,
            sshUsername: sanitizeLine(connection.sshUsername || 'root') || 'root',
            adminDatabase:
              sanitizeTableName(connection.adminDatabase || (sanitizeEngine(connection.engine) === 'mysql' ? 'mysql' : 'postgres')) ||
              (sanitizeEngine(connection.engine) === 'mysql' ? 'mysql' : 'postgres'),
            adminUsername: sanitizeLine(connection.adminUsername || (sanitizeEngine(connection.engine) === 'mysql' ? 'root' : 'postgres')) ||
              (sanitizeEngine(connection.engine) === 'mysql' ? 'root' : 'postgres'),
            adminPasswordReference:
              sanitizeLine(connection.adminPasswordReference || 'APP_DB_ADMIN_PASSWORD') || 'APP_DB_ADMIN_PASSWORD',
            active: Boolean(connection.active),
            notes: sanitizeLine(connection.notes || ''),
            reachability:
              connection.reachability === 'reachable'
                ? 'reachable'
                : connection.reachability === 'unreachable'
                  ? 'unreachable'
                  : 'unknown',
            credentialStatus:
              connection.credentialStatus === 'verified'
                ? 'verified'
                : connection.credentialStatus === 'failed'
                  ? 'failed'
                  : 'unknown',
            databaseExists: Boolean(connection.databaseExists),
            appUserExists: Boolean(connection.appUserExists),
            boilerplateApplied: Boolean(connection.boilerplateApplied),
            lastProbeAt: connection.lastProbeAt,
            lastProbeMessage: connection.lastProbeMessage,
            lastProvisionAt: connection.lastProvisionAt,
            lastProvisionMessage: connection.lastProvisionMessage,
            createdAt: connection.createdAt || nowIso(),
            updatedAt: connection.updatedAt || nowIso(),
          }))
        : [],
      bootstrap: {
        activeConnectionId: sanitizeLine(stored.bootstrap?.activeConnectionId || '') || undefined,
        credentialsVerified: Boolean(stored.bootstrap?.credentialsVerified),
        databaseProvisioned: Boolean(stored.bootstrap?.databaseProvisioned),
        seedAdminProvisioned: Boolean(stored.bootstrap?.seedAdminProvisioned),
        boilerplateProvisioned: Boolean(stored.bootstrap?.boilerplateProvisioned),
        packageGeneratedAt: stored.bootstrap?.packageGeneratedAt,
        declaredAt: stored.bootstrap?.declaredAt,
        notes: sanitizeLine(stored.bootstrap?.notes || ''),
      },
    };
  }

  const seed = createSeedSnapshot();
  writeJsonAtomic(SNAPSHOT_FILE, seed);
  return seed;
}

function persistSnapshot(snapshot: PersistedSnapshot): PersistedSnapshot {
  const nextSnapshot: PersistedSnapshot = {
    ...snapshot,
    schemaVersion: 1,
    updatedAt: nowIso(),
  };

  writeJsonAtomic(SNAPSHOT_FILE, nextSnapshot);
  return nextSnapshot;
}

function readImportRows(entitySlug: string): DataImportPayload[] {
  const filePath = path.join(IMPORTS_DIR, `${entitySlug}.json`);
  return readJsonFile<DataImportPayload[]>(filePath) || [];
}

function writeImportRows(entitySlug: string, rows: DataImportPayload[]): void {
  writeJsonAtomic(path.join(IMPORTS_DIR, `${entitySlug}.json`), rows);
}

function toSnapshot(snapshot: PersistedSnapshot): DataStudioSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    updatedAt: snapshot.updatedAt,
    entities: snapshot.entities,
    imports: snapshot.imports,
    connections: snapshot.connections,
    bootstrap: snapshot.bootstrap,
  };
}

function mapFieldToSqlType(field: DataFieldDefinition): string {
  switch (field.type) {
    case 'integer':
      return 'INTEGER';
    case 'number':
      return 'NUMERIC(18,4)';
    case 'currency':
      return 'NUMERIC(18,2)';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'TIMESTAMPTZ';
    case 'json':
      return 'JSONB';
    case 'reference':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildEntitySql(entity: DataEntityDefinition): string {
  const columns = [
    '  id TEXT PRIMARY KEY',
    ...entity.fields.map((field) => {
      const baseType = mapFieldToSqlType(field);
      const nullable = field.required ? ' NOT NULL' : '';
      const defaultValue =
        field.defaultValue && field.type === 'boolean'
          ? ` DEFAULT ${field.defaultValue === 'true' ? 'TRUE' : 'FALSE'}`
          : field.defaultValue && (field.type === 'integer' || field.type === 'number' || field.type === 'currency')
            ? ` DEFAULT ${field.defaultValue}`
            : field.defaultValue
              ? ` DEFAULT '${escapeSqlLiteral(field.defaultValue)}'`
              : '';

      return `  ${field.name} ${baseType}${nullable}${defaultValue}`;
    }),
    '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    '  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
  ];

  const uniqueIndexes = entity.fields.filter((field) => field.unique);
  const indexes = entity.fields.filter((field) => field.indexed && !field.unique);

  return [
    `CREATE TABLE IF NOT EXISTS ${entity.tableName} (`,
    columns.join(',\n'),
    ');',
    ...uniqueIndexes.map(
      (field) => `CREATE UNIQUE INDEX IF NOT EXISTS idx_${entity.tableName}_${field.name}_uniq ON ${entity.tableName} (${field.name});`,
    ),
    ...indexes.map((field) => `CREATE INDEX IF NOT EXISTS idx_${entity.tableName}_${field.name} ON ${entity.tableName} (${field.name});`),
  ].join('\n');
}

function mapFieldToMysqlType(field: DataFieldDefinition): string {
  switch (field.type) {
    case 'integer':
      return 'INT';
    case 'number':
      return 'DECIMAL(18,4)';
    case 'currency':
      return 'DECIMAL(18,2)';
    case 'boolean':
      return 'TINYINT(1)';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'DATETIME';
    case 'json':
      return 'LONGTEXT';
    case 'reference':
      return 'VARCHAR(191)';
    default:
      return 'TEXT';
  }
}

function buildEntitySqlMysql(entity: DataEntityDefinition): string {
  const columns = [
    '  id VARCHAR(64) PRIMARY KEY',
    ...entity.fields.map((field) => {
      const baseType = mapFieldToMysqlType(field);
      const nullable = field.required ? ' NOT NULL' : '';
      const defaultValue =
        field.defaultValue && field.type === 'boolean'
          ? ` DEFAULT ${field.defaultValue === 'true' ? '1' : '0'}`
          : field.defaultValue && (field.type === 'integer' || field.type === 'number' || field.type === 'currency')
            ? ` DEFAULT ${field.defaultValue}`
            : field.defaultValue
              ? ` DEFAULT '${escapeSqlLiteral(field.defaultValue)}'`
              : '';

      return `  ${field.name} ${baseType}${nullable}${defaultValue}`;
    }),
    '  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    '  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  ];

  const uniqueIndexes = entity.fields.filter((field) => field.unique);
  const indexes = entity.fields.filter((field) => field.indexed && !field.unique);

  return [
    `CREATE TABLE IF NOT EXISTS ${entity.tableName} (`,
    columns.join(',\n'),
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    ...uniqueIndexes.map(
      (field) => `CREATE UNIQUE INDEX idx_${entity.tableName}_${field.name}_uniq ON ${entity.tableName} (${field.name}(191));`,
    ),
    ...indexes.map((field) => `CREATE INDEX idx_${entity.tableName}_${field.name} ON ${entity.tableName} (${field.name}(191));`),
  ].join('\n');
}

function buildBootstrapReadme(snapshot: PersistedSnapshot): string {
  const activeConnection = snapshot.connections.find((connection) => connection.id === snapshot.bootstrap.activeConnectionId) || snapshot.connections[0];
  const lines = [
    '# Pacote Base de Dados',
    '',
    'Este pacote foi gerado pelo Data Studio do EcommPanel.',
    '',
    '## Conteudo',
    '',
    '- `schema.json`: definicoes das entidades e campos',
    '- `postgres-content-bootstrap.sql`: script base das entidades para PostgreSQL',
    '- `postgres-panel-bootstrap.sql`: boilerplate oficial de usuarios, sessoes e auditoria do painel em PostgreSQL',
    '- `mysql-content-bootstrap.sql`: script de compatibilidade para MySQL/MariaDB',
    '- `mysql-panel-bootstrap.sql`: boilerplate de compatibilidade para MySQL/MariaDB',
    '- `seed-imports.json`: documentos importados pelo painel para uso como carga inicial',
    '',
    '## Entidades',
    '',
    ...snapshot.entities.map((entity) => `- \`${entity.label}\` -> tabela \`${entity.tableName}\` (${entity.fields.length} campos)`),
    '',
    '## Perfil ativo',
    '',
    activeConnection ? `- Engine: \`${activeConnection.engine}\`` : '- Engine: sem conexão principal definida',
    activeConnection ? `- Método de provisionamento: \`${activeConnection.provisioningMethod}\`` : '- Método de provisionamento: indefinido',
    '',
    '## Observacoes',
    '',
    '- O pacote foi pensado para servir de base de implementacao e popular o banco.',
    '- O fluxo oficial do produto passa por PostgreSQL. MySQL/MariaDB fica como caminho de compatibilidade ou transicao.',
    '- Campos `reference` precisam ser revisados na fase de modelagem final, quando as chaves estrangeiras reais forem definidas.',
    '- O painel ainda pode continuar operando em JSON enquanto a migracao para banco nao for fechada.',
  ];

  return lines.join('\n');
}

export function getDataStudioSnapshot(): DataStudioSnapshot {
  return toSnapshot(loadSnapshot());
}

export function saveDataEntity(input: SaveEntityInput): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const now = nowIso();
  const normalizedSlug = sanitizeSlug(input.slug);
  if (!normalizedSlug) {
    throw new Error('Slug da entidade é obrigatório.');
  }

  const label = sanitizeLine(input.label);
  if (!label) {
    throw new Error('Nome da entidade é obrigatório.');
  }

  const tableName = sanitizeTableName(input.tableName || `app_${normalizedSlug.replace(/-/g, '_')}`);
  if (!tableName) {
    throw new Error('Nome de tabela inválido.');
  }

  const existing = input.id ? snapshot.entities.find((entity) => entity.id === input.id) : null;
  const duplicateSlug = snapshot.entities.find((entity) => entity.slug === normalizedSlug && entity.id !== input.id);
  if (duplicateSlug) {
    throw new Error('Já existe uma entidade com esse slug.');
  }

  const duplicateTable = snapshot.entities.find((entity) => entity.tableName === tableName && entity.id !== input.id);
  if (duplicateTable) {
    throw new Error('Já existe uma entidade com esse nome de tabela.');
  }

  const rawFields = Array.isArray(input.fields) ? input.fields : existing?.fields || [];
  const fields = rawFields
    .map((field, index) => sanitizeField(field, field.name || `field_${index + 1}`))
    .filter((field, index, list) => list.findIndex((candidate) => candidate.name === field.name) === index);

  const entity: DataEntityDefinition = {
    id: existing?.id || input.id || `ent-${randomToken(6)}`,
    slug: normalizedSlug,
    label,
    tableName,
    description: sanitizeLine(input.description || ''),
    status: input.status === 'ready' ? 'ready' : 'draft',
    fields,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextEntities = existing
    ? snapshot.entities.map((candidate) => (candidate.id === entity.id ? entity : candidate))
    : [entity, ...snapshot.entities];

  return toSnapshot(persistSnapshot({ ...snapshot, entities: nextEntities }));
}

export function deleteDataEntity(entityId: string): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const target = snapshot.entities.find((entity) => entity.id === entityId);
  if (!target) {
    throw new Error('Entidade não encontrada.');
  }

  const nextEntities = snapshot.entities.filter((entity) => entity.id !== entityId);
  const nextImports = snapshot.imports.filter((entry) => entry.entityId !== entityId);
  const importFile = path.join(IMPORTS_DIR, `${target.slug}.json`);
  if (fs.existsSync(importFile)) {
    fs.unlinkSync(importFile);
  }

  return toSnapshot(persistSnapshot({ ...snapshot, entities: nextEntities, imports: nextImports }));
}

export function saveDataConnection(input: SaveConnectionInput): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const now = nowIso();
  const existing = input.id ? snapshot.connections.find((connection) => connection.id === input.id) : null;
  const engine = sanitizeEngine(input.engine || existing?.engine);
  const host = sanitizeHost(input.host);
  const label = sanitizeLine(input.label);
  const database = sanitizeTableName(input.database);
  const username = sanitizeLine(input.username);

  if (!label || !host || !database || !username) {
    throw new Error('Nome, host, banco e usuário são obrigatórios para a conexão.');
  }

  const nextConnection: DataConnectionProfile = {
    id: existing?.id || input.id || `conn-${randomToken(6)}`,
    label,
    engine,
    host,
    port: Number.isFinite(input.port) ? Number(input.port) : existing?.port || (engine === 'mysql' ? 3306 : 5432),
    database,
    username,
    passwordReference: sanitizeLine(input.passwordReference || existing?.passwordReference || 'APP_DB_PASSWORD') || 'APP_DB_PASSWORD',
    appHostPattern: sanitizeUserHostPattern(input.appHostPattern || existing?.appHostPattern || 'localhost'),
    sslMode: input.sslMode === 'require' ? 'require' : input.sslMode === 'prefer' ? 'prefer' : 'disable',
    provisioningMethod: sanitizeProvisioningMethod(input.provisioningMethod || existing?.provisioningMethod),
    sshHost: sanitizeHost(input.sshHost || existing?.sshHost || host) || host,
    sshPort: Number.isFinite(input.sshPort) ? Number(input.sshPort) : existing?.sshPort || 22,
    sshUsername: sanitizeLine(input.sshUsername || existing?.sshUsername || 'root') || 'root',
    adminDatabase:
      sanitizeTableName(input.adminDatabase || existing?.adminDatabase || (engine === 'mysql' ? 'mysql' : 'postgres')) ||
      (engine === 'mysql' ? 'mysql' : 'postgres'),
    adminUsername:
      sanitizeLine(input.adminUsername || existing?.adminUsername || (engine === 'mysql' ? 'root' : 'postgres')) ||
      (engine === 'mysql' ? 'root' : 'postgres'),
    adminPasswordReference:
      sanitizeLine(input.adminPasswordReference || existing?.adminPasswordReference || 'APP_DB_ADMIN_PASSWORD') || 'APP_DB_ADMIN_PASSWORD',
    active: Boolean(input.active),
    notes: sanitizeLine(input.notes || ''),
    reachability: existing?.reachability || 'unknown',
    credentialStatus: existing?.credentialStatus || 'unknown',
    databaseExists: existing?.databaseExists || false,
    appUserExists: existing?.appUserExists || false,
    boilerplateApplied: existing?.boilerplateApplied || false,
    lastProbeAt: existing?.lastProbeAt,
    lastProbeMessage: existing?.lastProbeMessage,
    lastProvisionAt: existing?.lastProvisionAt,
    lastProvisionMessage: existing?.lastProvisionMessage,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const nextConnections = existing
    ? snapshot.connections.map((connection) =>
        connection.id === nextConnection.id ? nextConnection : { ...connection, active: nextConnection.active ? false : connection.active },
      )
    : [nextConnection, ...snapshot.connections.map((connection) => ({ ...connection, active: nextConnection.active ? false : connection.active }))];

  const activeConnection =
    nextConnections.find((connection) => connection.active) ||
    nextConnections.find((connection) => connection.id === snapshot.bootstrap.activeConnectionId) ||
    nextConnections[0];

  if (activeConnection && !nextConnections.some((connection) => connection.active)) {
    activeConnection.active = true;
  }

  return toSnapshot(
    persistSnapshot({
      ...snapshot,
      connections: nextConnections,
      bootstrap: {
        ...snapshot.bootstrap,
        activeConnectionId: activeConnection?.id,
      },
    }),
  );
}

export function deleteDataConnection(connectionId: string): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const nextConnections = snapshot.connections.filter((connection) => connection.id !== connectionId);
  const nextActive = nextConnections[0];
  if (nextActive && !nextConnections.some((connection) => connection.active)) {
    nextActive.active = true;
  }

  return toSnapshot(
    persistSnapshot({
      ...snapshot,
      connections: nextConnections,
      bootstrap: {
        ...snapshot.bootstrap,
        activeConnectionId: nextActive?.id,
      },
    }),
  );
}

export function updateDataBootstrapState(input: BootstrapUpdateInput): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const nextBootstrap: DataBootstrapState = {
    ...snapshot.bootstrap,
    ...input,
    notes: input.notes !== undefined ? sanitizeLine(input.notes || '') : snapshot.bootstrap.notes,
    declaredAt:
      input.credentialsVerified !== undefined ||
      input.databaseProvisioned !== undefined ||
      input.seedAdminProvisioned !== undefined ||
      input.boilerplateProvisioned !== undefined
        ? nowIso()
        : snapshot.bootstrap.declaredAt,
  };

  return toSnapshot(
    persistSnapshot({
      ...snapshot,
      bootstrap: nextBootstrap,
    }),
  );
}

function applyProvisioningInspection(
  snapshot: PersistedSnapshot,
  connectionId: string,
  inspection: DataProvisioningInspection,
  options?: { provisioned?: boolean },
): PersistedSnapshot {
  const now = nowIso();
  const nextConnections: DataConnectionProfile[] = snapshot.connections.map((connection) =>
    connection.id === connectionId
      ? {
          ...connection,
          reachability: 'reachable' as const,
          credentialStatus: 'verified' as const,
          databaseExists: inspection.databaseExists,
          appUserExists: inspection.appUserExists,
          boilerplateApplied: inspection.boilerplateApplied,
          lastProbeAt: now,
          lastProbeMessage: inspection.message,
          lastProvisionAt: options?.provisioned ? now : connection.lastProvisionAt,
          lastProvisionMessage: options?.provisioned ? inspection.message : connection.lastProvisionMessage,
          updatedAt: now,
        }
      : connection,
  );

  return {
    ...snapshot,
    connections: nextConnections,
    bootstrap: {
      ...snapshot.bootstrap,
      activeConnectionId: connectionId,
      credentialsVerified: true,
      databaseProvisioned: inspection.databaseExists,
      seedAdminProvisioned: inspection.seedAdminExists,
      boilerplateProvisioned: inspection.boilerplateApplied,
      declaredAt: now,
    },
  };
}

export async function probeDataConnection(connectionId: string): Promise<DataStudioSnapshot> {
  const snapshot = loadSnapshot();
  const target = snapshot.connections.find((connection) => connection.id === connectionId);
  if (!target) {
    throw new Error('Conexão não encontrada.');
  }

  const result = await new Promise<{ reachability: DataConnectionProfile['reachability']; message: string }>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (payload: { reachability: DataConnectionProfile['reachability']; message: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(payload);
    };

    socket.setTimeout(2500);
    socket.once('connect', () => finish({ reachability: 'reachable', message: 'Host e porta responderam com sucesso.' }));
    socket.once('timeout', () => finish({ reachability: 'unreachable', message: 'Tempo esgotado ao tentar alcançar o host.' }));
    socket.once('error', (error) => finish({ reachability: 'unreachable', message: error.message || 'Falha de rede ao alcançar o host.' }));
    socket.connect(target.port, target.host);
  });

  const nextConnections = snapshot.connections.map((connection) =>
    connection.id === connectionId
      ? {
          ...connection,
          reachability: result.reachability,
          lastProbeAt: nowIso(),
          lastProbeMessage: result.message,
          updatedAt: nowIso(),
        }
      : connection,
  );

  return toSnapshot(
    persistSnapshot({
      ...snapshot,
      connections: nextConnections,
    }),
  );
}

export async function inspectDataProvisioning(connectionId: string, secrets: DataProvisioningSecrets): Promise<DataStudioSnapshot> {
  const snapshot = loadSnapshot();
  const target = snapshot.connections.find((connection) => connection.id === connectionId);
  if (!target) {
    throw new Error('Conexão não encontrada.');
  }

  if (target.engine === 'postgresql' && target.provisioningMethod === 'ssh_postgres') {
    if (!secrets.sshPassword) {
      throw new Error('Senha SSH é obrigatória para inspecionar a VPS.');
    }

    const inspection = await inspectPostgresProvisioning(target, {
      sshPassword: secrets.sshPassword,
      mainAdminEmail: secrets.mainAdminEmail,
    });
    return toSnapshot(persistSnapshot(applyProvisioningInspection(snapshot, connectionId, inspection)));
  }

  if (target.engine === 'mysql' && target.provisioningMethod === 'ssh_mysql') {
    if (!secrets.sshPassword || !secrets.adminPassword) {
      throw new Error('Senha SSH e senha administrativa do banco são obrigatórias para inspecionar a VPS.');
    }

    const inspection = await inspectMysqlProvisioning(target, secrets);
    return toSnapshot(persistSnapshot(applyProvisioningInspection(snapshot, connectionId, inspection)));
  }

  throw new Error('A inspeção remota automática está disponível apenas para conexões SSH do PostgreSQL ou MySQL/MariaDB.');
}

export async function provisionDataConnection(
  connectionId: string,
  secrets: Required<Pick<DataProvisioningSecrets, 'sshPassword' | 'appPassword' | 'mainAdminName' | 'mainAdminEmail' | 'mainAdminPassword'>> &
    Partial<Pick<DataProvisioningSecrets, 'adminPassword'>>,
): Promise<DataStudioSnapshot> {
  const snapshot = loadSnapshot();
  const target = snapshot.connections.find((connection) => connection.id === connectionId);
  if (!target) {
    throw new Error('Conexão não encontrada.');
  }

  if (target.engine === 'postgresql' && target.provisioningMethod === 'ssh_postgres') {
    const inspection = await provisionPostgresConnection(target, secrets);
    return toSnapshot(persistSnapshot(applyProvisioningInspection(snapshot, connectionId, inspection, { provisioned: true })));
  }

  if (target.engine === 'mysql' && target.provisioningMethod === 'ssh_mysql') {
    if (!secrets.adminPassword) {
      throw new Error('Senha administrativa do banco é obrigatória para provisionar conexões MySQL/MariaDB.');
    }

    const inspection = await provisionMysqlConnection(target, {
      sshPassword: secrets.sshPassword,
      adminPassword: secrets.adminPassword,
      appPassword: secrets.appPassword,
      mainAdminName: secrets.mainAdminName,
      mainAdminEmail: secrets.mainAdminEmail,
      mainAdminPassword: secrets.mainAdminPassword,
    });
    return toSnapshot(persistSnapshot(applyProvisioningInspection(snapshot, connectionId, inspection, { provisioned: true })));
  }

  throw new Error('O provisionamento remoto automático está disponível apenas para conexões SSH do PostgreSQL ou MySQL/MariaDB.');
}

export function importDataRows(input: {
  entityId: string;
  sourceLabel?: string;
  rows: Record<string, unknown>[];
}): DataStudioSnapshot {
  const snapshot = loadSnapshot();
  const entity = snapshot.entities.find((candidate) => candidate.id === input.entityId);
  if (!entity) {
    throw new Error('Entidade não encontrada para importação.');
  }

  const rows = Array.isArray(input.rows) ? input.rows.filter((row) => row && typeof row === 'object') : [];
  if (!rows.length) {
    throw new Error('Nenhum registro válido foi enviado para importação.');
  }

  const payload: DataImportPayload = {
    entityId: entity.id,
    entitySlug: entity.slug,
    sourceLabel: sanitizeLine(input.sourceLabel || 'importacao-manual') || 'importacao-manual',
    importedAt: nowIso(),
    rows,
  };

  const currentRows = readImportRows(entity.slug);
  const nextRows = [payload, ...currentRows].slice(0, 12);
  writeImportRows(entity.slug, nextRows);

  const importRecord: DataImportRecord = {
    id: `imp-${randomToken(6)}`,
    entityId: entity.id,
    entitySlug: entity.slug,
    sourceLabel: payload.sourceLabel,
    rowsCount: rows.length,
    importedAt: payload.importedAt,
  };

  return toSnapshot(persistSnapshot({ ...snapshot, imports: [importRecord, ...snapshot.imports].slice(0, 80) }));
}

export function importDataStudioBundle(input: ImportBundleInput): DataStudioSnapshot {
  const entities = Array.isArray(input.entities) ? input.entities : [];

  const savedEntities = entities.map((entity) => {
    if (!entity || typeof entity !== 'object') {
      throw new Error('Entidade inválida no pacote de importação.');
    }
    return saveDataEntity(entity as SaveEntityInput);
  });

  let latestSnapshot = savedEntities[savedEntities.length - 1] || getDataStudioSnapshot();

  if (input.records && typeof input.records === 'object') {
    for (const [entitySlug, rows] of Object.entries(input.records)) {
      const entity = latestSnapshot.entities.find((candidate) => candidate.slug === sanitizeSlug(entitySlug));
      if (!entity || !Array.isArray(rows) || !rows.length) continue;
      latestSnapshot = importDataRows({
        entityId: entity.id,
        sourceLabel: 'pacote-importado',
        rows: rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object'),
      });
    }
  }

  return latestSnapshot;
}

export function generateDataStudioBundle(): DataStudioBundle {
  const snapshot = loadSnapshot();
  const contracts = generateDataStudioContracts(toSnapshot(snapshot));
  const importedRows = snapshot.entities.reduce<Record<string, DataImportPayload[]>>((acc, entity) => {
    acc[entity.slug] = readImportRows(entity.slug);
    return acc;
  }, {});

  const activeConnection = snapshot.connections.find((connection) => connection.id === snapshot.bootstrap.activeConnectionId) || snapshot.connections[0];
  const generatedAt = nowIso();
  const bundleMainAdminName = 'Main Admin';
  const bundleMainAdminEmail = 'main@ecommpanel.local';
  const bundleMainAdminPasswordHash = '<definir-hash-real-no-provisionamento>';
  const files: DataStudioBundleFile[] = [
    {
      path: 'database/README.md',
      kind: 'markdown',
      content: buildBootstrapReadme(snapshot),
    },
    {
      path: 'database/schema.json',
      kind: 'json',
      content: JSON.stringify(toSnapshot(snapshot), null, 2),
    },
    {
      path: 'database/postgres-content-bootstrap.sql',
      kind: 'sql',
      content: [
        '-- Pacote inicial gerado pelo Data Studio',
        '-- Revisar constraints, foreign keys e regras transacionais antes de producao.',
        '',
        ...snapshot.entities.map((entity) => buildEntitySql(entity)),
      ].join('\n\n'),
    },
    {
      path: 'database/postgres-panel-bootstrap.sql',
      kind: 'sql',
      content: [
        '-- Boilerplate oficial do painel em PostgreSQL.',
        '-- Substitua o hash placeholder pelo valor gerado no provisionamento real, se aplicar manualmente.',
        '',
        buildPostgresPanelBootstrapSql({
          mainAdminName: bundleMainAdminName,
          mainAdminEmail: bundleMainAdminEmail,
          mainAdminPasswordHash: bundleMainAdminPasswordHash,
        }),
      ].join('\n'),
    },
    {
      path: 'database/mysql-content-bootstrap.sql',
      kind: 'sql',
      content: [
        '-- Pacote inicial de entidades para MySQL/MariaDB',
        '-- Revisar foreign keys e indices largos antes de producao.',
        '',
        ...snapshot.entities.map((entity) => buildEntitySqlMysql(entity)),
      ].join('\n\n'),
    },
    {
      path: 'database/mysql-panel-bootstrap.sql',
      kind: 'sql',
      content: [
        '-- Boilerplate de compatibilidade para MySQL/MariaDB.',
        '-- Substitua o hash placeholder pelo valor gerado no provisionamento real, se aplicar manualmente.',
        '',
        buildMysqlPanelBootstrapSql({
          mainAdminName: bundleMainAdminName,
          mainAdminEmail: bundleMainAdminEmail,
          mainAdminPasswordHash: bundleMainAdminPasswordHash,
        }),
      ].join('\n'),
    },
    {
      path: 'database/seed-imports.json',
      kind: 'json',
      content: JSON.stringify(importedRows, null, 2),
    },
    ...contracts.entities.map(({ entity, schema }) => ({
      path: `contracts/entities/${entity.slug}.schema.json`,
      kind: 'json' as const,
      content: JSON.stringify(schema, null, 2),
    })),
    {
      path: 'contracts/openapi.generated.json',
      kind: 'json',
      content: JSON.stringify(contracts.openApi, null, 2),
    },
    {
      path: 'database/connection-profile.json',
      kind: 'json',
      content: JSON.stringify(
        {
          activeConnection,
          bootstrap: {
            ...snapshot.bootstrap,
            packageGeneratedAt: generatedAt,
          },
        },
        null,
        2,
      ),
    },
  ];

  persistSnapshot({
    ...snapshot,
    bootstrap: {
      ...snapshot.bootstrap,
      packageGeneratedAt: generatedAt,
    },
  });

  return {
    generatedAt,
    files,
  };
}
