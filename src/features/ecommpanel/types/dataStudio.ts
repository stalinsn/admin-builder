export const DATA_FIELD_TYPES = [
  'text',
  'slug',
  'email',
  'url',
  'rich_text',
  'integer',
  'number',
  'currency',
  'boolean',
  'date',
  'datetime',
  'json',
  'reference',
] as const;

export type DataFieldType = (typeof DATA_FIELD_TYPES)[number];

export type DataFieldDefinition = {
  id: string;
  name: string;
  label: string;
  type: DataFieldType;
  description: string;
  required: boolean;
  unique: boolean;
  indexed: boolean;
  listVisible: boolean;
  defaultValue?: string;
  referenceEntityId?: string;
  createdAt: string;
  updatedAt: string;
};

export type DataEntityDefinition = {
  id: string;
  slug: string;
  label: string;
  tableName: string;
  description: string;
  status: 'draft' | 'ready';
  fields: DataFieldDefinition[];
  createdAt: string;
  updatedAt: string;
};

export type DataImportRecord = {
  id: string;
  entityId: string;
  entitySlug: string;
  sourceLabel: string;
  rowsCount: number;
  importedAt: string;
};

export type DataConnectionProfile = {
  id: string;
  label: string;
  engine: 'postgresql' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  passwordReference: string;
  appHostPattern: string;
  sslMode: 'disable' | 'prefer' | 'require';
  provisioningMethod: 'manual' | 'ssh_postgres' | 'ssh_mysql';
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  adminDatabase: string;
  adminUsername: string;
  adminPasswordReference: string;
  active: boolean;
  notes: string;
  reachability: 'unknown' | 'reachable' | 'unreachable';
  credentialStatus: 'unknown' | 'verified' | 'failed';
  databaseExists?: boolean;
  appUserExists?: boolean;
  boilerplateApplied?: boolean;
  lastProbeAt?: string;
  lastProbeMessage?: string;
  lastProvisionAt?: string;
  lastProvisionMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type DataBootstrapState = {
  activeConnectionId?: string;
  credentialsVerified: boolean;
  databaseProvisioned: boolean;
  seedAdminProvisioned: boolean;
  boilerplateProvisioned: boolean;
  packageGeneratedAt?: string;
  declaredAt?: string;
  notes: string;
};

export type DataImportPayload = {
  entityId: string;
  entitySlug: string;
  sourceLabel: string;
  importedAt: string;
  rows: Record<string, unknown>[];
};

export type DataStudioSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  entities: DataEntityDefinition[];
  imports: DataImportRecord[];
  connections: DataConnectionProfile[];
  bootstrap: DataBootstrapState;
};

export type DataStudioBundleFile = {
  path: string;
  kind: 'markdown' | 'json' | 'sql' | 'yaml' | 'shell' | 'env';
  content: string;
};

export type DataStudioBundle = {
  generatedAt: string;
  files: DataStudioBundleFile[];
};

export type DataStudioBackup = {
  kind: 'artmeta-panel-data-studio-backup';
  schemaVersion: number;
  generatedAt: string;
  entities: DataEntityDefinition[];
  importsByEntity: Record<string, DataImportPayload[]>;
  recordsByEntity: Record<string, Record<string, unknown>[]>;
};

export type DataEntityRuntimeStatus = {
  entityId: string;
  entitySlug: string;
  entityLabel: string;
  tableName: string;
  databaseAvailable: boolean;
  tableExists: boolean;
  modeledFieldCount: number;
  databaseColumnCount: number;
  rowCount: number;
  missingColumns: string[];
  extraColumns: string[];
  inspectedAt: string;
  schemaPath: string;
  internalCollectionPath: string;
  internalItemPath: string;
  integrationCollectionPath: string;
  integrationItemPath: string;
  readScope: string;
  writeScope: string;
};

export type DataStudioRuntimeSummary = {
  databaseAvailable: boolean;
  inspectedAt: string;
  entities: DataEntityRuntimeStatus[];
};

export type DataDatabaseTableColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  ordinalPosition: number;
  primaryKey: boolean;
};

export type DataDatabaseTable = {
  schema: string;
  tableName: string;
  label: string;
  description: string;
  source: 'system' | 'modeled' | 'database';
  primaryKey: string[];
  columns: DataDatabaseTableColumn[];
};

export type DataTableCsvExport = {
  tableName: string;
  fileName: string;
  rowCount: number;
  generatedAt: string;
  csv: string;
};

export type DataTableCsvImportMode = 'append' | 'upsert';

export type DataTableCsvImportResult = {
  tableName: string;
  mode: DataTableCsvImportMode;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  importedAt: string;
};
