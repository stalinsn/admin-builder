'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  DATA_FIELD_TYPES,
  type DataStudioBackup,
  type DataBootstrapState,
  type DataConnectionProfile,
  type DataDatabaseTable,
  type DataEntityDefinition,
  type DataEntityRuntimeStatus,
  type DataFieldDefinition,
  type DataFieldType,
  type DataStudioBundle,
  type DataStudioRuntimeSummary,
  type DataStudioBundleFile,
  type DataStudioSnapshot,
  type DataTableCsvExport,
  type DataTableCsvImportMode,
  type DataTableCsvImportResult,
} from '@/features/ecommpanel/types/dataStudio';
import DataEntityRecordsWorkspace from '@/features/ecommpanel/components/DataEntityRecordsWorkspace';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';
import type { AdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';

type MeApiResponse = {
  csrfToken?: string;
};

type DataStudioApiResponse = {
  snapshot?: DataStudioSnapshot;
  runtime?: DataStudioRuntimeSummary;
  bundle?: DataStudioBundle;
  backup?: DataStudioBackup;
  databaseTables?: DataDatabaseTable[];
  databaseTablesAvailable?: boolean;
  csvExport?: DataTableCsvExport;
  csvImportResult?: DataTableCsvImportResult;
  error?: string;
};

type DataStudioManagerProps = {
  initialSettings: AdminBuilderSettings;
  initialSnapshot: DataStudioSnapshot;
  initialRuntime: DataStudioRuntimeSummary;
  initialBundle: DataStudioBundle;
  initialDatabaseTables: DataDatabaseTable[];
  initialDatabaseTablesAvailable: boolean;
  canManageConnections: boolean;
  canManageBootstrap: boolean;
  canManageEntities: boolean;
  canManageRecords: boolean;
  canManageDatabaseTables: boolean;
};

type EntityForm = {
  id?: string;
  slug: string;
  label: string;
  tableName: string;
  description: string;
  status: 'draft' | 'ready';
  fields: DataFieldDefinition[];
};

type ConnectionForm = {
  id?: string;
  label: string;
  engine: DataConnectionProfile['engine'];
  host: string;
  port: string;
  database: string;
  username: string;
  passwordReference: string;
  appHostPattern: string;
  sslMode: DataConnectionProfile['sslMode'];
  provisioningMethod: DataConnectionProfile['provisioningMethod'];
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  adminDatabase: string;
  adminUsername: string;
  adminPasswordReference: string;
  notes: string;
  active: boolean;
};

type BootstrapForm = {
  activeConnectionId: string;
  credentialsVerified: boolean;
  databaseProvisioned: boolean;
  seedAdminProvisioned: boolean;
  boilerplateProvisioned: boolean;
  notes: string;
};

type ProvisioningSecretsForm = {
  sshPassword: string;
  adminPassword: string;
  appPassword: string;
  mainAdminName: string;
  mainAdminEmail: string;
  mainAdminPassword: string;
};

type DataModuleKey = 'modeling' | 'connections' | 'bootstrap' | 'records' | 'import' | 'csv' | 'bundle';

const DATA_MODULE_META: Record<
  DataModuleKey,
  {
    label: string;
    title: string;
    description: string;
    detail: string;
  }
> = {
  modeling: {
    label: 'Modelagem',
    title: 'Modelagem de entidades',
    description: 'Defina entidades, campos, regras e status estrutural da base.',
    detail: 'Estrutura lógica, tabela física e runtime por entidade.',
  },
  connections: {
    label: 'Conexões',
    title: 'Perfis de conexão',
    description: 'Cadastre, teste e promova conexões da instância com o banco.',
    detail: 'Host, engine, credenciais técnicas e conexão principal.',
  },
  bootstrap: {
    label: 'Implantação',
    title: 'Implantação inicial',
    description: 'Controle o bootstrap, credenciais e provisionamento do ambiente.',
    detail: 'Base criada, admin inicial, boilerplate e inspeção remota.',
  },
  records: {
    label: 'Registros',
    title: 'Registros por entidade',
    description: 'Leia, edite e popule os dados reais das entidades criadas.',
    detail: 'Tabela dinâmica, criação manual, exclusão e importação JSON.',
  },
  import: {
    label: 'Importação',
    title: 'Importação manual',
    description: 'Carregue registros JSON ou pacotes completos de estrutura.',
    detail: 'Importação orientada por entidade ou por bundle estrutural.',
  },
  csv: {
    label: 'CSV',
    title: 'Sincronização CSV',
    description: 'Exporte e reimporte tabelas físicas em fluxo de planilha.',
    detail: 'Append, replace, preview e trilha de auditoria por tabela.',
  },
  bundle: {
    label: 'Pacote base',
    title: 'Pacote técnico',
    description: 'Consolide schema, contratos e artefatos técnicos do módulo.',
    detail: 'JSON Schema, OpenAPI e bundle para consumo externo.',
  },
};

function isDataModuleKey(value: string | null): value is DataModuleKey {
  return value === 'modeling' || value === 'connections' || value === 'bootstrap' || value === 'records' || value === 'import' || value === 'csv' || value === 'bundle';
}

function formatDateTime(value?: string): string {
  if (!value) return 'Ainda não gerado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tableize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function fieldize(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/g, '')
    .replace(/_{2,}/g, '_');

  if (!normalized) return '';
  if (/^[a-z_]/.test(normalized)) return normalized;
  return `field_${normalized}`;
}

function downloadTextFile(file: DataStudioBundleFile) {
  downloadNamedTextFile(file.path.split('/').pop() || 'arquivo.txt', file.content);
}

function downloadNamedTextFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildEmptyField(index: number): DataFieldDefinition {
  const now = new Date().toISOString();
  return {
    id: `tmp-fld-${Date.now()}-${index}`,
    name: '',
    label: '',
    type: 'text',
    description: '',
    required: false,
    unique: false,
    indexed: false,
    listVisible: true,
    createdAt: now,
    updatedAt: now,
  };
}

function buildEmptyEntityForm(): EntityForm {
  return {
    slug: '',
    label: '',
    tableName: '',
    description: '',
    status: 'draft',
    fields: [buildEmptyField(1)],
  };
}

function cloneEntityToForm(entity?: DataEntityDefinition | null): EntityForm {
  if (!entity) return buildEmptyEntityForm();

  return {
    id: entity.id,
    slug: entity.slug,
    label: entity.label,
    tableName: entity.tableName,
    description: entity.description,
    status: entity.status,
    fields: entity.fields.length ? entity.fields.map((field) => ({ ...field })) : [buildEmptyField(1)],
  };
}

function buildEmptyConnectionForm(): ConnectionForm {
  return {
    label: '',
    engine: 'postgresql',
    host: '127.0.0.1',
    port: '5432',
    database: 'admin_builder',
    username: 'admin_builder',
    passwordReference: 'APP_DB_PASSWORD',
    appHostPattern: 'localhost',
    sslMode: 'disable',
    provisioningMethod: 'manual',
    sshHost: '127.0.0.1',
    sshPort: '22',
    sshUsername: 'root',
    adminDatabase: 'postgres',
    adminUsername: 'postgres',
    adminPasswordReference: 'APP_DB_ADMIN_PASSWORD',
    notes: '',
    active: true,
  };
}

function cloneConnectionToForm(connection?: DataConnectionProfile | null): ConnectionForm {
  if (!connection) return buildEmptyConnectionForm();

  return {
    id: connection.id,
    label: connection.label,
    engine: connection.engine,
    host: connection.host,
    port: String(connection.port),
    database: connection.database,
    username: connection.username,
    passwordReference: connection.passwordReference,
    appHostPattern: connection.appHostPattern,
    sslMode: connection.sslMode,
    provisioningMethod: connection.provisioningMethod,
    sshHost: connection.sshHost,
    sshPort: String(connection.sshPort),
    sshUsername: connection.sshUsername,
    adminDatabase: connection.adminDatabase,
    adminUsername: connection.adminUsername,
    adminPasswordReference: connection.adminPasswordReference,
    notes: connection.notes,
    active: connection.active,
  };
}

function cloneBootstrapToForm(bootstrap: DataBootstrapState): BootstrapForm {
  return {
    activeConnectionId: bootstrap.activeConnectionId || '',
    credentialsVerified: bootstrap.credentialsVerified,
    databaseProvisioned: bootstrap.databaseProvisioned,
    seedAdminProvisioned: bootstrap.seedAdminProvisioned,
    boilerplateProvisioned: bootstrap.boilerplateProvisioned,
    notes: bootstrap.notes,
  };
}

function describeFieldRules(field: DataFieldDefinition): string {
  const rules = [];
  if (field.required) rules.push('obrigatório');
  if (field.unique) rules.push('único');
  if (field.indexed) rules.push('indexado');
  if (field.listVisible) rules.push('lista');
  return rules.length ? rules.join(' • ') : 'sem regra extra';
}

function buildEntityAcronym(entity: DataEntityDefinition): string {
  const source = (entity.slug || entity.label || '').replace(/[_-]+/g, ' ').trim();
  if (!source) return 'ENT';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 4).map((part) => part[0]).join('').toUpperCase();
  }
  const compact = source.replace(/[^a-zA-Z0-9]/g, '');
  return (compact.slice(0, 4) || 'ENT').toUpperCase();
}

function buildMissingColumnsLabel(runtime?: DataEntityRuntimeStatus | null): string {
  if (!runtime) return 'runtime indisponível';
  if (!runtime.databaseAvailable) return 'sem conexão com o banco';
  if (!runtime.tableExists) return 'tabela ainda não materializada';
  if (!runtime.missingColumns.length && !runtime.extraColumns.length) return 'schema alinhado';
  const parts = [];
  if (runtime.missingColumns.length) parts.push(`${runtime.missingColumns.length} faltando`);
  if (runtime.extraColumns.length) parts.push(`${runtime.extraColumns.length} extras`);
  return parts.join(' • ');
}

function buildRuntimeTableStatus(runtime?: DataEntityRuntimeStatus | null): string {
  if (!runtime) return 'Sem inspeção';
  if (!runtime.databaseAvailable) return 'Banco indisponível';
  return runtime.tableExists ? 'Tabela física ativa' : 'Tabela pendente';
}

function buildEmptyProvisioningSecrets(): ProvisioningSecretsForm {
  return {
    sshPassword: '',
    adminPassword: '',
    appPassword: '',
    mainAdminName: 'Main Admin',
    mainAdminEmail: 'main@ecommpanel.local',
    mainAdminPassword: 'Admin@123456',
  };
}

export default function DataStudioManager({
  initialSettings,
  initialSnapshot,
  initialRuntime,
  initialBundle,
  initialDatabaseTables,
  initialDatabaseTablesAvailable,
  canManageConnections,
  canManageBootstrap,
  canManageEntities,
  canManageRecords,
  canManageDatabaseTables,
}: DataStudioManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<DataStudioSnapshot>(initialSnapshot);
  const [runtime, setRuntime] = useState<DataStudioRuntimeSummary>(initialRuntime);
  const [bundle, setBundle] = useState<DataStudioBundle>(initialBundle);
  const [databaseTables, setDatabaseTables] = useState<DataDatabaseTable[]>(initialDatabaseTables);
  const [databaseTablesAvailable, setDatabaseTablesAvailable] = useState(initialDatabaseTablesAvailable);
  const [backupDraftText, setBackupDraftText] = useState('');
  const [backupFileName, setBackupFileName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialSnapshot.entities[0]?.id || null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(initialSnapshot.connections[0]?.id || null);
  const [selectedDatabaseTableName, setSelectedDatabaseTableName] = useState<string | null>(initialDatabaseTables[0]?.tableName || null);
  const [entityForm, setEntityForm] = useState<EntityForm>(() => cloneEntityToForm(initialSnapshot.entities[0]));
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>(() => cloneConnectionToForm(initialSnapshot.connections[0]));
  const [bootstrapForm, setBootstrapForm] = useState<BootstrapForm>(() => cloneBootstrapToForm(initialSnapshot.bootstrap));
  const [csrfToken, setCsrfToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [provisioningSecrets, setProvisioningSecrets] = useState<ProvisioningSecretsForm>(() => buildEmptyProvisioningSecrets());
  const [importRowsText, setImportRowsText] = useState('[\n  {\n    \"email\": \"cliente@exemplo.com\",\n    \"first_name\": \"Stalin\"\n  }\n]');
  const [importBundleText, setImportBundleText] = useState('{\n  "entities": [],\n  "records": {}\n}');
  const [csvImportText, setCsvImportText] = useState('');
  const [csvImportMode, setCsvImportMode] = useState<DataTableCsvImportMode>('append');
  const [csvPreview, setCsvPreview] = useState<DataTableCsvExport | null>(null);
  const [csvImportSummary, setCsvImportSummary] = useState<DataTableCsvImportResult | null>(null);
  const [activeBundlePath, setActiveBundlePath] = useState<string>(initialBundle.files[0]?.path || '');
  const [currentProvisioningStep, setCurrentProvisioningStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeDataModule, setActiveDataModule] = useState<DataModuleKey | null>(null);
  const [isEntityViewerOpen, setIsEntityViewerOpen] = useState(false);
  const [isEntityEditorOpen, setIsEntityEditorOpen] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const createIntentHandledRef = useRef(false);

  const selectedEntity = useMemo(
    () => snapshot.entities.find((entity) => entity.id === selectedEntityId) || null,
    [selectedEntityId, snapshot.entities],
  );

  const selectedEntityRuntime = useMemo(
    () => runtime.entities.find((entity) => entity.entityId === selectedEntityId) || null,
    [runtime.entities, selectedEntityId],
  );

  const runtimeByEntityId = useMemo(
    () => new Map(runtime.entities.map((entity) => [entity.entityId, entity])),
    [runtime.entities],
  );

  const selectedConnection = useMemo(
    () => snapshot.connections.find((connection) => connection.id === selectedConnectionId) || null,
    [selectedConnectionId, snapshot.connections],
  );

  const activeBundleFile = useMemo(
    () => bundle.files.find((file) => file.path === activeBundlePath) || bundle.files[0] || null,
    [activeBundlePath, bundle.files],
  );

  const selectedDatabaseTable = useMemo(
    () => databaseTables.find((table) => table.tableName === selectedDatabaseTableName) || null,
    [databaseTables, selectedDatabaseTableName],
  );

  const selectedConnectionUsesPostgresSsh =
    selectedConnection?.engine === 'postgresql' && selectedConnection.provisioningMethod === 'ssh_postgres';
  const selectedConnectionUsesMysqlSsh = selectedConnection?.engine === 'mysql' && selectedConnection.provisioningMethod === 'ssh_mysql';
  const selectedConnectionUsesRemoteProvisioning = selectedConnectionUsesPostgresSsh || selectedConnectionUsesMysqlSsh;

  const totalFields = useMemo(
    () => snapshot.entities.reduce((sum, entity) => sum + entity.fields.length, 0),
    [snapshot.entities],
  );

  const readyEntities = useMemo(
    () => snapshot.entities.filter((entity) => entity.status === 'ready').length,
    [snapshot.entities],
  );

  const reachableConnections = useMemo(
    () => snapshot.connections.filter((connection) => connection.reachability === 'reachable').length,
    [snapshot.connections],
  );

  function updateModuleQuery(moduleKey: DataModuleKey | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (moduleKey) {
      params.set('module', moduleKey);
    } else {
      params.delete('module');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function openDataModule(moduleKey: DataModuleKey) {
    setActiveDataModule(moduleKey);
    updateModuleQuery(moduleKey);
  }

  function closeDataModule() {
    setActiveDataModule(null);
    updateModuleQuery(null);
  }

  useEffect(() => {
    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar autenticação.');
        return response.json() as Promise<MeApiResponse>;
      })
      .then((payload) => {
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setEntityForm(cloneEntityToForm(selectedEntity));
  }, [selectedEntity]);

  useEffect(() => {
    setConnectionForm(cloneConnectionToForm(selectedConnection));
  }, [selectedConnection]);

  useEffect(() => {
    setBootstrapForm(cloneBootstrapToForm(snapshot.bootstrap));
  }, [snapshot.bootstrap]);

  useEffect(() => {
    if (!bundle.files.length) {
      setActiveBundlePath('');
      return;
    }
    if (!bundle.files.some((file) => file.path === activeBundlePath)) {
      setActiveBundlePath(bundle.files[0].path);
    }
  }, [activeBundlePath, bundle.files]);

  useEffect(() => {
    if (!databaseTables.length) {
      setSelectedDatabaseTableName(null);
      return;
    }

    if (!selectedDatabaseTableName || !databaseTables.some((table) => table.tableName === selectedDatabaseTableName)) {
      setSelectedDatabaseTableName(databaseTables[0].tableName);
    }
  }, [databaseTables, selectedDatabaseTableName]);

  useEffect(() => {
    const requestedModule = searchParams.get('module');
    if (isDataModuleKey(requestedModule)) {
      setActiveDataModule(requestedModule);
      return;
    }

    if (!requestedModule && activeDataModule) {
      setActiveDataModule(null);
    }
  }, [activeDataModule, searchParams]);

  useEffect(() => {
    const requestedModule = searchParams.get('module');
    const requestedCreate = searchParams.get('create');

    if (requestedModule === 'modeling' && requestedCreate === '1' && !createIntentHandledRef.current) {
      createIntentHandledRef.current = true;
      handleNewEntity();
      return;
    }

    if (requestedCreate !== '1') {
      createIntentHandledRef.current = false;
    }
  }, [searchParams]);

  function applyPayload(payload: DataStudioApiResponse, nextSuccess?: string) {
    if (payload.snapshot) {
      setSnapshot(payload.snapshot);

      if (selectedEntityId && payload.snapshot.entities.some((entity) => entity.id === selectedEntityId)) {
        setSelectedEntityId(selectedEntityId);
      } else {
        setSelectedEntityId(payload.snapshot.entities[0]?.id || null);
      }

      if (selectedConnectionId && payload.snapshot.connections.some((connection) => connection.id === selectedConnectionId)) {
        setSelectedConnectionId(selectedConnectionId);
      } else {
        setSelectedConnectionId(payload.snapshot.connections[0]?.id || null);
      }
    }

    if (payload.bundle) {
      setBundle(payload.bundle);
    }

    if (payload.backup) {
      setBackupDraftText(JSON.stringify(payload.backup, null, 2));
      setBackupFileName(`artmeta-panel-backup-${payload.backup.generatedAt.replace(/[:.]/g, '-')}.json`);
    }

    if (payload.runtime) {
      setRuntime(payload.runtime);
    }

    if (payload.databaseTables) {
      setDatabaseTables(payload.databaseTables);
    }

    if (typeof payload.databaseTablesAvailable === 'boolean') {
      setDatabaseTablesAvailable(payload.databaseTablesAvailable);
    }

    if (payload.csvExport) {
      setCsvPreview(payload.csvExport);
    }

    if (payload.csvImportResult) {
      setCsvImportSummary(payload.csvImportResult);
    }

    setError(null);
    setSuccess(nextSuccess || null);
  }

  async function refreshStudioState(nextSuccess?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as DataStudioApiResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao atualizar o estado do Data Studio.');
      }
      applyPayload(payload || {}, nextSuccess);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar o estado do Data Studio.');
    } finally {
      setSaving(false);
    }
  }

  async function requestAction(body: unknown, nextSuccess: string) {
    if (!csrfToken || saving) return false;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as DataStudioApiResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao processar o Data Studio.');
      }

      applyPayload(payload || {}, nextSuccess);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao processar o Data Studio.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleNewEntity() {
    setSelectedEntityId(null);
    setEntityForm(buildEmptyEntityForm());
    setExpandedFieldId(null);
    setIsEntityEditorOpen(true);
    setError(null);
    setSuccess(null);
  }

  function handleNewConnection() {
    setSelectedConnectionId(null);
    setConnectionForm(buildEmptyConnectionForm());
    setError(null);
    setSuccess(null);
  }

  function updateField(fieldId: string, key: keyof DataFieldDefinition, value: string | boolean) {
    setEntityForm((prev) => ({
      ...prev,
      fields: prev.fields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              [key]: value,
              updatedAt: new Date().toISOString(),
            }
          : field,
      ),
    }));
  }

  function addField() {
    const nextField = buildEmptyField(entityForm.fields.length + 1);
    setEntityForm((prev) => ({
      ...prev,
      fields: [...prev.fields, nextField],
    }));
    setExpandedFieldId(nextField.id);
  }

  function removeField(fieldId: string) {
    setEntityForm((prev) => ({
      ...prev,
      fields: prev.fields.length > 1 ? prev.fields.filter((field) => field.id !== fieldId) : [buildEmptyField(1)],
    }));
    setExpandedFieldId((current) => (current === fieldId ? null : current));
  }

  function openEntityEditor(entityId?: string | null) {
    if (entityId) {
      setSelectedEntityId(entityId);
    }
    setExpandedFieldId(null);
    setIsEntityEditorOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openEntityViewer(entityId?: string | null) {
    if (entityId) {
      setSelectedEntityId(entityId);
    }
    setIsEntityViewerOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function handleSetEntityStatus(status: EntityForm['status']) {
    if (!canManageEntities) return;
    if (!selectedEntity) return;

    const saved = await requestAction(
      {
        action: 'saveEntity',
        entity: {
          ...selectedEntity,
          status,
        },
      },
      status === 'ready' ? 'Entidade marcada como pronta.' : 'Entidade voltou para rascunho.',
    );

    if (saved) {
      setSelectedEntityId(selectedEntity.id);
    }
  }

  async function handleSaveEntity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageEntities) return;

    const slug = slugify(entityForm.slug || entityForm.label);
    const tableName = tableize(entityForm.tableName || `app_${slug.replace(/-/g, '_')}`);

    const saved = await requestAction(
      {
        action: 'saveEntity',
        entity: {
          ...entityForm,
          slug,
          tableName,
        },
      },
      entityForm.id ? 'Entidade atualizada com sucesso.' : 'Entidade criada com sucesso.',
    );

    if (saved) {
      setIsEntityEditorOpen(false);
      setExpandedFieldId(null);
    }
  }

  async function handleDeleteEntity() {
    if (!canManageEntities) return;

    if (!entityForm.id) {
      handleNewEntity();
      return;
    }

    const confirmed = window.confirm('Remover esta entidade e os imports relacionados?');
    if (!confirmed) return;

    await requestAction(
      {
        action: 'deleteEntity',
        entityId: entityForm.id,
      },
      'Entidade removida com sucesso.',
    );
  }

  async function handleSaveConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageConnections) return;

    await requestAction(
      {
        action: 'saveConnection',
        connection: {
          ...connectionForm,
          engine: connectionForm.engine,
          host: connectionForm.host.trim(),
          port: Number.parseInt(connectionForm.port || (connectionForm.engine === 'mysql' ? '3306' : '5432'), 10),
          database: tableize(connectionForm.database),
          username: connectionForm.username.trim(),
          passwordReference: connectionForm.passwordReference.trim(),
          appHostPattern: connectionForm.appHostPattern.trim() || 'localhost',
          provisioningMethod: connectionForm.provisioningMethod,
          sshHost: connectionForm.sshHost.trim(),
          sshPort: Number.parseInt(connectionForm.sshPort || '22', 10),
          sshUsername: connectionForm.sshUsername.trim(),
          adminDatabase: tableize(connectionForm.adminDatabase),
          adminUsername: connectionForm.adminUsername.trim(),
          adminPasswordReference: connectionForm.adminPasswordReference.trim(),
        },
      },
      connectionForm.id ? 'Conexão atualizada com sucesso.' : 'Conexão cadastrada com sucesso.',
    );
  }

  async function handleDeleteConnection() {
    if (!canManageConnections || !connectionForm.id) {
      handleNewConnection();
      return;
    }

    const confirmed = window.confirm('Remover esta conexão do painel?');
    if (!confirmed) return;

    await requestAction(
      {
        action: 'deleteConnection',
        connectionId: connectionForm.id,
      },
      'Conexão removida com sucesso.',
    );
  }

  async function handleProbeConnection() {
    if (!canManageConnections || !selectedConnectionId) return;

    await requestAction(
      {
        action: 'probeConnection',
        connectionId: selectedConnectionId,
      },
      'Teste de reachabilidade concluído.',
    );
  }

  async function handleInspectProvisioning() {
    if (!selectedConnectionId) {
      setError('Selecione uma conexão antes de inspecionar a VPS.');
      return;
    }

    await requestAction(
      {
        action: 'inspectProvisioning',
        connectionId: selectedConnectionId,
        secrets: {
          sshPassword: provisioningSecrets.sshPassword,
          adminPassword: provisioningSecrets.adminPassword,
          mainAdminEmail: provisioningSecrets.mainAdminEmail,
        },
      },
      'Inspeção remota concluída.',
    );
  }

  async function handleProvisionConnection() {
    if (!selectedConnectionId) {
      setError('Selecione uma conexão antes de provisionar a VPS.');
      return;
    }

    await requestAction(
      {
        action: 'provisionConnection',
        connectionId: selectedConnectionId,
        secrets: {
          sshPassword: provisioningSecrets.sshPassword,
          adminPassword: provisioningSecrets.adminPassword,
          appPassword: provisioningSecrets.appPassword,
          mainAdminName: provisioningSecrets.mainAdminName,
          mainAdminEmail: provisioningSecrets.mainAdminEmail,
          mainAdminPassword: provisioningSecrets.mainAdminPassword,
        },
      },
      'Provisionamento remoto concluído com sucesso.',
    );
  }

  async function handleSaveBootstrap() {
    if (!canManageBootstrap) return;

    await requestAction(
      {
        action: 'updateBootstrap',
        bootstrap: bootstrapForm,
      },
      'Estado de bootstrap atualizado com sucesso.',
    );
  }

  async function handleImportRows() {
    if (!canManageRecords) return;
    if (!selectedEntityId) {
      setError('Selecione uma entidade antes de importar registros.');
      return;
    }

    try {
      const rows = JSON.parse(importRowsText) as unknown;
      if (!Array.isArray(rows)) {
        throw new Error('O JSON de importação precisa ser uma lista de objetos.');
      }

      await requestAction(
        {
          action: 'importRows',
          entityId: selectedEntityId,
          sourceLabel: 'painel-manual',
          rows,
        },
        'Registros importados com sucesso.',
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'JSON inválido para importação.');
    }
  }

  async function handleImportBundle() {
    if (!canManageRecords && !canManageEntities) return;

    try {
      const bundlePayload = JSON.parse(importBundleText) as unknown;
      if (!bundlePayload || typeof bundlePayload !== 'object') {
        throw new Error('O pacote precisa ser um objeto JSON.');
      }

      await requestAction(
        {
          action: 'importBundle',
          bundle: bundlePayload,
        },
        'Pacote importado com sucesso.',
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'JSON inválido para pacote.');
    }
  }

  async function handleGenerateBundle() {
    if (!canManageEntities && !canManageBootstrap) return;

    await requestAction(
      {
        action: 'generateBundle',
      },
      'Pacote base atualizado com sucesso.',
    );
  }

  async function handleGenerateBackup() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action: 'generateBackup',
        }),
      });
      const payload = (await response.json().catch(() => null)) as DataStudioApiResponse | null;
      if (!response.ok || !payload?.backup) {
        throw new Error(payload?.error || 'Não foi possível gerar o backup geral do Data Studio.');
      }

      applyPayload(
        payload,
        payload.backup.recordsStatus === 'included'
          ? 'Backup geral gerado com sucesso.'
          : 'Backup estrutural gerado sem registros, porque o banco não está disponível.',
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao gerar o backup geral.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreBackup() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedBackup = JSON.parse(backupDraftText);
      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action: 'restoreBackup',
          backup: parsedBackup,
        }),
      });
      const payload = (await response.json().catch(() => null)) as DataStudioApiResponse | null;
      if (!response.ok || !payload?.backup || !payload.snapshot) {
        throw new Error(payload?.error || 'Não foi possível restaurar o backup geral.');
      }

      applyPayload(
        payload,
        payload.backup.recordsStatus === 'included'
          ? 'Backup restaurado com sucesso.'
          : 'Backup restaurado em modo estrutural. Os registros não foram reaplicados porque o banco não está disponível.',
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao restaurar o backup geral.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncSelectedEntityStructure() {
    if (!canManageEntities || !selectedEntityId) return;
    await requestAction(
      {
        action: 'syncEntityStructure',
        entityId: selectedEntityId,
      },
      'Estrutura da entidade sincronizada com a tabela física.',
    );
  }

  async function handleRebuildEntitiesFromDatabase(replaceExisting: boolean) {
    if (!canManageEntities) return;
    await requestAction(
      {
        action: 'rebuildEntitiesFromDatabase',
        replaceExisting,
      },
      replaceExisting
        ? 'Entidades reconstruídas a partir da base física.'
        : 'Entidades do banco adicionadas ao snapshot.',
    );
  }

  async function handleRefreshDatabaseTables() {
    if (!canManageDatabaseTables) return;

    await requestAction(
      {
        action: 'refreshDatabaseTables',
      },
      'Estrutura física da base recarregada com sucesso.',
    );
  }

  async function handleExportTableCsv() {
    if (!canManageDatabaseTables || !selectedDatabaseTableName) {
      setError('Selecione uma tabela antes de exportar.');
      return;
    }

    await requestAction(
      {
        action: 'exportTableCsv',
        tableName: selectedDatabaseTableName,
      },
      'CSV gerado com sucesso.',
    );
  }

  async function handleImportTableCsv() {
    if (!canManageDatabaseTables || !selectedDatabaseTableName) {
      setError('Selecione uma tabela antes de importar o CSV.');
      return;
    }

    if (!csvImportText.trim()) {
      setError('Cole um CSV ou carregue um arquivo antes de importar.');
      return;
    }

    await requestAction(
      {
        action: 'importTableCsv',
        tableName: selectedDatabaseTableName,
        csvContent: csvImportText,
        mode: csvImportMode,
      },
      'Importação CSV concluída com sucesso.',
    );
  }

  async function handleLoadCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setCsvImportText(content);
      setSuccess(`Arquivo ${file.name} carregado para importação.`);
      setError(null);
    } catch {
      setError('Não foi possível ler o arquivo CSV selecionado.');
    } finally {
      event.target.value = '';
    }
  }

  useEffect(() => {
    const hasOverlayOpen = Boolean(activeDataModule || isEntityViewerOpen || isEntityEditorOpen);
    if (!hasOverlayOpen) return undefined;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();

      if (isEntityEditorOpen) {
        setIsEntityEditorOpen(false);
        return;
      }

      if (isEntityViewerOpen) {
        setIsEntityViewerOpen(false);
        return;
      }

      if (activeDataModule) {
        closeDataModule();
      }
    }

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [activeDataModule, isEntityEditorOpen, isEntityViewerOpen]);

  const currentDataModule: DataModuleKey = activeDataModule ?? 'modeling';
  const currentModuleMeta = DATA_MODULE_META[currentDataModule];

  return (
    <section className={`panel-grid panel-data-studio panel-data-studio--${currentDataModule} panel-manager-page`} aria-labelledby="panel-data-title">
      <PanelPageHeader
        title={currentModuleMeta.title}
        titleId="panel-data-title"
        description={currentModuleMeta.description}
        actions={
          currentDataModule === 'modeling' && canManageEntities ? (
            <button type="button" className="panel-btn panel-btn-primary panel-btn-sm panel-manager-primary-button" onClick={handleNewEntity}>
              + Nova Entidade
            </button>
          ) : null
        }
      />

      {currentDataModule === 'modeling' ? (
      <div className="panel-manager-stats">
        <article className="panel-manager-stat panel-manager-stat--blue">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Entidades Total</span>
            <strong>{formatInteger(snapshot.entities.length)}</strong>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--green">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Ativas</span>
            <strong>{formatInteger(readyEntities)}</strong>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--gold">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Total de Campos</span>
            <strong>{formatInteger(totalFields)}</strong>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--purple">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Total de Registros</span>
            <strong>{formatInteger(runtime.entities.reduce((sum, entity) => sum + entity.rowCount, 0))}</strong>
          </div>
        </article>
      </div>
      ) : null}

      {(error || success) && (
        <div className={`panel-feedback ${error ? 'panel-feedback-error' : 'panel-feedback-success'}`}>{error || success}</div>
      )}

      {currentDataModule === 'modeling' ? (
      <div className="panel-table-shell">
        <div className="panel-table-wrap">
          <table className="panel-table panel-manager-table panel-manager-entities-table">
            <thead>
              <tr>
                <th>Entidade</th>
                <th>Tabela Física</th>
                <th>Campos</th>
                <th>Registros</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.entities.length ? (
                snapshot.entities.map((entity) => {
                  const entityRuntime = runtimeByEntityId.get(entity.id);
                  return (
                    <tr key={entity.id}>
                      <td>
                        <div className="panel-manager-entity-cell">
                          <span className="panel-manager-entity-cell__icon">{buildEntityAcronym(entity)}</span>
                          <div>
                            <strong>{entity.label}</strong>
                            <small>{entity.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td><code>{entity.tableName}</code></td>
                      <td>{entity.fields.length} campos</td>
                      <td>{formatInteger(entityRuntime?.rowCount || 0)}</td>
                      <td>
                        <span className={`panel-badge ${entity.status === 'ready' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {entity.status === 'ready' ? 'Ativa' : 'Rascunho'}
                        </span>
                      </td>
                      <td>
                        <div className="panel-manager-icon-actions">
                          <button type="button" className="panel-manager-icon-button panel-manager-icon-button--blue" onClick={() => openEntityViewer(entity.id)} aria-label={`Ver ${entity.label}`}>
                            ◉
                          </button>
                          {canManageEntities ? (
                            <button type="button" className="panel-manager-icon-button panel-manager-icon-button--gold" onClick={() => openEntityEditor(entity.id)} aria-label={`Editar ${entity.label}`}>
                              ✎
                            </button>
                          ) : null}
                          {canManageEntities ? (
                            <button
                              type="button"
                              className="panel-manager-icon-button panel-manager-icon-button--neutral"
                              onClick={async () => {
                                setSelectedEntityId(entity.id);
                                await requestAction(
                                  {
                                    action: 'saveEntity',
                                    entity: {
                                      ...entity,
                                      status: entity.status === 'ready' ? 'draft' : 'ready',
                                    },
                                  },
                                  entity.status === 'ready' ? 'Entidade voltou para rascunho.' : 'Entidade marcada como pronta.',
                                );
                              }}
                              aria-label={`Alternar status de ${entity.label}`}
                            >
                              ⚙
                            </button>
                          ) : null}
                          {canManageEntities ? (
                            <button
                              type="button"
                              className="panel-manager-icon-button panel-manager-icon-button--danger"
                              onClick={async () => {
                                const confirmed = window.confirm('Remover esta entidade e os imports relacionados?');
                                if (!confirmed) return;
                                await requestAction(
                                  {
                                    action: 'deleteEntity',
                                    entityId: entity.id,
                                  },
                                  'Entidade removida com sucesso.',
                                );
                              }}
                              aria-label={`Remover ${entity.label}`}
                            >
                              🗑
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="panel-table-empty">Nenhuma entidade modelada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {currentDataModule === 'modeling' ? (
      <article className="panel-manager-card panel-manager-card--actions">
        <div className="panel-card-header">
          <div className="panel-card-header__copy">
            <h2>Operações estruturais</h2>
            <p className="panel-muted">Aplique ações técnicas sem sair da tabela principal de entidades.</p>
          </div>
        </div>
        <div className="panel-manager-quick-actions panel-manager-quick-actions--tight">
          <button type="button" className="panel-manager-quick-action" onClick={handleSyncSelectedEntityStructure} disabled={!selectedEntity || saving || !canManageEntities}>
            <strong>Sincronizar com Banco</strong>
            <small>Atualizar a tabela física da entidade selecionada.</small>
          </button>
          <button type="button" className="panel-manager-quick-action" onClick={handleGenerateBundle} disabled={saving || (!canManageEntities && !canManageBootstrap)}>
            <strong>Exportar Schema</strong>
            <small>Atualizar contrato JSON e artefatos técnicos.</small>
          </button>
          <button type="button" className="panel-manager-quick-action" onClick={() => openDataModule('import')}>
            <strong>Importar definições</strong>
            <small>Carregar estrutura existente sem trocar de seção.</small>
          </button>
        </div>
      </article>
      ) : null}

      {currentDataModule !== 'modeling' ? (
        <section className="panel-data-module-surface" aria-labelledby="panel-data-module-title">
          <div className="panel-data-module-surface__header">
            <div>
              <p className="panel-kicker">Fluxo ativo</p>
              <h2 id="panel-data-module-title">{currentModuleMeta.label}</h2>
              <p>{currentModuleMeta.detail}</p>
            </div>
          </div>

            <div className="panel-data-module-surface__body">
              {currentDataModule === 'connections' ? (
                <div className="panel-grid">
                  <article className="panel-card">
                    <div className="panel-inline-between">
                      <div>
                        <h3>Conexões cadastradas</h3>
                        <p className="panel-muted">Escolha uma conexão para revisar ou editar.</p>
                      </div>
                      {canManageConnections ? (
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={handleNewConnection}>
                          Nova conexão
                        </button>
                      ) : null}
                    </div>

                    <div className="panel-data-entity-table">
                      <div className="panel-data-entity-table__head">
                        <span>Conexão</span>
                        <span>Status</span>
                        <span>Papel</span>
                        <span>Ações</span>
                      </div>
                      {snapshot.connections.map((connection) => {
                        const active = connection.id === selectedConnectionId;
                        return (
                          <div key={connection.id} className={`panel-data-entity-row ${active ? 'is-active' : ''}`}>
                            <span className="panel-data-entity-row__main">
                              <strong>{connection.label}</strong>
                              <small>
                                {connection.host}:{connection.port} / {connection.database}
                              </small>
                            </span>
                            <span
                              className={`panel-badge ${
                                connection.reachability === 'reachable'
                                  ? 'panel-badge-success'
                                  : connection.reachability === 'unreachable'
                                    ? 'panel-badge-neutral'
                                    : 'panel-badge-neutral'
                              }`}
                            >
                              {connection.reachability === 'reachable'
                                ? 'alcançável'
                                : connection.reachability === 'unreachable'
                                  ? 'sem resposta'
                                  : 'não testado'}
                            </span>
                            <span>{connection.active ? 'principal' : 'auxiliar'}</span>
                            <div className="panel-actions">
                              <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => setSelectedConnectionId(connection.id)}>
                                Selecionar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="panel-card">
                    <form className="panel-form" onSubmit={handleSaveConnection}>
                      <div className="panel-form-grid panel-form-grid--three">
                        <div className="panel-field">
                          <label>Engine</label>
                          <select
                            className="panel-select"
                            value={connectionForm.engine}
                            onChange={(event) =>
                              setConnectionForm((prev) => ({
                                ...prev,
                                engine: event.target.value as DataConnectionProfile['engine'],
                                port: event.target.value === 'mysql' ? '3306' : '5432',
                                adminDatabase: event.target.value === 'mysql' ? 'mysql' : 'postgres',
                                adminUsername: event.target.value === 'mysql' ? 'root' : 'postgres',
                                provisioningMethod: event.target.value === 'mysql' ? 'ssh_mysql' : 'ssh_postgres',
                              }))
                            }
                            disabled={!canManageConnections}
                          >
                            <option value="postgresql">PostgreSQL</option>
                            <option value="mysql">MySQL / MariaDB</option>
                          </select>
                        </div>
                        <div className="panel-field">
                          <label>Nome</label>
                          <input className="panel-input" value={connectionForm.label} onChange={(event) => setConnectionForm((prev) => ({ ...prev, label: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                        <div className="panel-field">
                          <label>Host</label>
                          <input className="panel-input" value={connectionForm.host} onChange={(event) => setConnectionForm((prev) => ({ ...prev, host: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                      </div>
                      <div className="panel-form-grid panel-form-grid--three">
                        <div className="panel-field">
                          <label>Porta</label>
                          <input className="panel-input" value={connectionForm.port} onChange={(event) => setConnectionForm((prev) => ({ ...prev, port: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                        <div className="panel-field">
                          <label>Banco</label>
                          <input className="panel-input" value={connectionForm.database} onChange={(event) => setConnectionForm((prev) => ({ ...prev, database: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                        <div className="panel-field">
                          <label>Usuário</label>
                          <input className="panel-input" value={connectionForm.username} onChange={(event) => setConnectionForm((prev) => ({ ...prev, username: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                      </div>
                      <div className="panel-form-grid panel-form-grid--three">
                        <div className="panel-field">
                          <label>Senha por referência</label>
                          <input className="panel-input" value={connectionForm.passwordReference} onChange={(event) => setConnectionForm((prev) => ({ ...prev, passwordReference: event.target.value }))} disabled={!canManageConnections} placeholder="APP_DB_PASSWORD" />
                        </div>
                        <div className="panel-field">
                          <label>Host permitido do usuário</label>
                          <input className="panel-input" value={connectionForm.appHostPattern} onChange={(event) => setConnectionForm((prev) => ({ ...prev, appHostPattern: event.target.value }))} disabled={!canManageConnections} placeholder="localhost" />
                        </div>
                        <div className="panel-field">
                          <label>SSL</label>
                          <select className="panel-select" value={connectionForm.sslMode} onChange={(event) => setConnectionForm((prev) => ({ ...prev, sslMode: event.target.value as DataConnectionProfile['sslMode'] }))} disabled={!canManageConnections}>
                            <option value="disable">disable</option>
                            <option value="prefer">prefer</option>
                            <option value="require">require</option>
                          </select>
                        </div>
                      </div>
                      <details className="panel-data-inline-details">
                        <summary>Mostrar dados avançados de provisionamento</summary>
                        <div className="panel-form-grid panel-form-grid--three">
                          <div className="panel-field">
                            <label>Método de provisão</label>
                            <select className="panel-select" value={connectionForm.provisioningMethod} onChange={(event) => setConnectionForm((prev) => ({ ...prev, provisioningMethod: event.target.value as DataConnectionProfile['provisioningMethod'] }))} disabled={!canManageConnections}>
                              <option value="ssh_postgres">SSH + PostgreSQL oficial na VPS</option>
                              <option value="ssh_mysql">SSH + MySQL local na VPS</option>
                              <option value="manual">Manual</option>
                            </select>
                          </div>
                          <div className="panel-field">
                            <label>Host SSH</label>
                            <input className="panel-input" value={connectionForm.sshHost} onChange={(event) => setConnectionForm((prev) => ({ ...prev, sshHost: event.target.value }))} disabled={!canManageConnections} />
                          </div>
                          <div className="panel-field">
                            <label>Porta SSH</label>
                            <input className="panel-input" value={connectionForm.sshPort} onChange={(event) => setConnectionForm((prev) => ({ ...prev, sshPort: event.target.value }))} disabled={!canManageConnections} />
                          </div>
                        </div>
                        <div className="panel-form-grid panel-form-grid--three">
                          <div className="panel-field">
                            <label>Usuário SSH</label>
                            <input className="panel-input" value={connectionForm.sshUsername} onChange={(event) => setConnectionForm((prev) => ({ ...prev, sshUsername: event.target.value }))} disabled={!canManageConnections} />
                          </div>
                          <div className="panel-field">
                            <label>Banco admin</label>
                            <input className="panel-input" value={connectionForm.adminDatabase} onChange={(event) => setConnectionForm((prev) => ({ ...prev, adminDatabase: event.target.value }))} disabled={!canManageConnections} />
                          </div>
                          <div className="panel-field">
                            <label>Usuário admin</label>
                            <input className="panel-input" value={connectionForm.adminUsername} onChange={(event) => setConnectionForm((prev) => ({ ...prev, adminUsername: event.target.value }))} disabled={!canManageConnections} />
                          </div>
                        </div>
                        <div className="panel-form-grid panel-form-grid--three">
                          <div className="panel-field">
                            <label>Senha admin por referência</label>
                            <input className="panel-input" value={connectionForm.adminPasswordReference} onChange={(event) => setConnectionForm((prev) => ({ ...prev, adminPasswordReference: event.target.value }))} disabled={!canManageConnections} placeholder={connectionForm.engine === 'postgresql' ? 'Opcional no fluxo SSH oficial' : 'APP_DB_ADMIN_PASSWORD'} />
                          </div>
                          <label className="panel-role-item">
                            <input type="checkbox" checked={connectionForm.active} onChange={(event) => setConnectionForm((prev) => ({ ...prev, active: event.target.checked }))} disabled={!canManageConnections} />
                            <span>Usar como conexão principal</span>
                          </label>
                        </div>
                        <div className="panel-field">
                          <label>Observações</label>
                          <textarea className="panel-textarea" value={connectionForm.notes} onChange={(event) => setConnectionForm((prev) => ({ ...prev, notes: event.target.value }))} disabled={!canManageConnections} />
                        </div>
                      </details>
                      <div className="panel-actions">
                        <button type="submit" className="panel-btn panel-btn-primary" disabled={saving || !canManageConnections}>
                          Salvar conexão
                        </button>
                        <button type="button" className="panel-btn panel-btn-secondary" onClick={handleProbeConnection} disabled={saving || !canManageConnections || !selectedConnectionId}>
                          Testar alcance
                        </button>
                        <button type="button" className="panel-btn panel-btn-danger" onClick={handleDeleteConnection} disabled={saving || !canManageConnections}>
                          {connectionForm.id ? 'Excluir conexão' : 'Limpar rascunho'}
                        </button>
                      </div>
                    </form>
                  </article>
                </div>
              ) : null}

              {currentDataModule === 'bootstrap' ? (
                <div className="panel-data-wizard">
                  <div className="panel-inline-between">
                    <span className="panel-muted">Último pacote em {formatDateTime(snapshot.bootstrap.packageGeneratedAt)}</span>
                  </div>
                  <div className="panel-data-wizard__steps">
                    {[
                      { step: 1 as const, label: 'Conexão', desc: 'Escolha o destino e revise o perfil principal.', complete: Boolean(bootstrapForm.activeConnectionId) },
                      { step: 2 as const, label: 'Validação', desc: 'Confirme o acesso e inspecione a VPS.', complete: bootstrapForm.credentialsVerified },
                      { step: 3 as const, label: 'Provisionamento', desc: 'Informe segredos da execução e prepare a base.', complete: bootstrapForm.databaseProvisioned },
                      { step: 4 as const, label: 'Confirmação', desc: 'Registre o estado final e o boilerplate.', complete: bootstrapForm.boilerplateProvisioned && bootstrapForm.seedAdminProvisioned },
                    ].map((item) => (
                      <button key={item.step} type="button" className={`panel-data-wizard-step ${currentProvisioningStep === item.step ? 'is-active' : ''} ${item.complete ? 'is-complete' : ''}`} onClick={() => setCurrentProvisioningStep(item.step)}>
                        <span className="panel-data-wizard-step__index">{item.step}</span>
                        <span className="panel-data-wizard-step__content">
                          <strong>{item.label}</strong>
                          <small>{item.desc}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="panel-data-wizard__body">
                    {currentProvisioningStep === 1 ? (
                      <div className="panel-data-wizard-panel">
                        <div className="panel-field">
                          <label>Conexão principal do bootstrap</label>
                          <select className="panel-select" value={bootstrapForm.activeConnectionId} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, activeConnectionId: event.target.value }))} disabled={!canManageBootstrap}>
                            <option value="">Selecione</option>
                            {snapshot.connections.map((connection) => (
                              <option key={connection.id} value={connection.id}>
                                {connection.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedConnection ? (
                          <div className="panel-data-connection-status">
                            <strong>Destino atual</strong>
                            <span>{selectedConnection.label}</span>
                            <small>
                              {selectedConnectionUsesRemoteProvisioning
                                ? `VPS ${selectedConnection.sshHost}:${selectedConnection.sshPort} via ${selectedConnection.sshUsername}`
                                : 'Provisionamento manual'}
                            </small>
                            <small>
                              {selectedConnectionUsesPostgresSsh
                                ? `PostgreSQL oficial: banco ${selectedConnection.database} / usuário ${selectedConnection.username}.`
                                : selectedConnectionUsesMysqlSsh
                                  ? `Compatibilidade MySQL/MariaDB: banco ${selectedConnection.database} / usuário ${selectedConnection.username}@${selectedConnection.appHostPattern}.`
                                  : 'Perfil em modo manual. A criação da base acontece fora da automação.'}
                            </small>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {currentProvisioningStep === 2 ? (
                      <div className="panel-data-wizard-panel">
                        <div className="panel-data-connection-status">
                          <strong>Inspeção e validação</strong>
                          <span>{selectedConnection?.lastProbeMessage || 'Ainda não houve inspeção recente.'}</span>
                          <small>{selectedConnection?.lastProvisionMessage || 'Use a ação abaixo para verificar o ambiente remoto.'}</small>
                        </div>
                        <div className="panel-actions">
                          <button type="button" className="panel-btn panel-btn-secondary" onClick={handleInspectProvisioning} disabled={saving || !selectedConnectionId || !selectedConnection || !selectedConnectionUsesRemoteProvisioning}>
                            Inspecionar VPS
                          </button>
                        </div>
                        <label className="panel-role-item">
                          <input type="checkbox" checked={bootstrapForm.credentialsVerified} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, credentialsVerified: event.target.checked }))} disabled={!canManageBootstrap} />
                          <span>Credenciais e acesso já verificados</span>
                        </label>
                      </div>
                    ) : null}
                    {currentProvisioningStep === 3 ? (
                      <div className="panel-data-wizard-panel">
                        <div className="panel-data-provisioning-grid">
                          <div className="panel-field">
                            <label>Senha SSH desta execução</label>
                            <input className="panel-input" type="password" value={provisioningSecrets.sshPassword} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, sshPassword: event.target.value }))} disabled={!canManageBootstrap && !canManageConnections} placeholder="Não fica persistida" />
                          </div>
                          <div className="panel-field">
                            <label>{selectedConnectionUsesMysqlSsh ? 'Senha admin do banco' : 'Senha admin do banco (opcional)'}</label>
                            <input className="panel-input" type="password" value={provisioningSecrets.adminPassword} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, adminPassword: event.target.value }))} disabled={!canManageBootstrap && !canManageConnections} placeholder={selectedConnectionUsesMysqlSsh ? 'Obrigatória no fluxo MySQL' : 'No PostgreSQL via SSH o painel usa o superusuário local'} />
                          </div>
                          <div className="panel-field">
                            <label>Senha do usuário do app</label>
                            <input className="panel-input" type="password" value={provisioningSecrets.appPassword} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, appPassword: event.target.value }))} disabled={!canManageBootstrap && !canManageConnections} placeholder="Obrigatória no provisionamento" />
                          </div>
                          <div className="panel-field">
                            <label>Nome do Main Admin inicial</label>
                            <input className="panel-input" value={provisioningSecrets.mainAdminName} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, mainAdminName: event.target.value }))} disabled={!canManageBootstrap} />
                          </div>
                          <div className="panel-field">
                            <label>E-mail do Main Admin inicial</label>
                            <input className="panel-input" type="email" value={provisioningSecrets.mainAdminEmail} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, mainAdminEmail: event.target.value }))} disabled={!canManageBootstrap} />
                          </div>
                          <div className="panel-field">
                            <label>Senha do Main Admin inicial</label>
                            <input className="panel-input" type="password" value={provisioningSecrets.mainAdminPassword} onChange={(event) => setProvisioningSecrets((prev) => ({ ...prev, mainAdminPassword: event.target.value }))} disabled={!canManageBootstrap} />
                          </div>
                        </div>
                        <div className="panel-actions">
                          <button type="button" className="panel-btn panel-btn-primary" onClick={handleProvisionConnection} disabled={saving || !selectedConnectionId || !selectedConnection || !selectedConnectionUsesRemoteProvisioning}>
                            Provisionar banco inicial
                          </button>
                        </div>
                        <label className="panel-role-item">
                          <input type="checkbox" checked={bootstrapForm.databaseProvisioned} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, databaseProvisioned: event.target.checked }))} disabled={!canManageBootstrap} />
                          <span>Base já criada</span>
                        </label>
                      </div>
                    ) : null}
                    {currentProvisioningStep === 4 ? (
                      <div className="panel-data-wizard-panel">
                        <div className="panel-inline-wrap">
                          <label className="panel-role-item">
                            <input type="checkbox" checked={bootstrapForm.boilerplateProvisioned} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, boilerplateProvisioned: event.target.checked }))} disabled={!canManageBootstrap} />
                            <span>Boilerplate inicial aplicado</span>
                          </label>
                          <label className="panel-role-item">
                            <input type="checkbox" checked={bootstrapForm.seedAdminProvisioned} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, seedAdminProvisioned: event.target.checked }))} disabled={!canManageBootstrap} />
                            <span>Main Admin inicial já provisionado</span>
                          </label>
                        </div>
                        <div className="panel-field">
                          <label>Observações operacionais</label>
                          <textarea className="panel-textarea" value={bootstrapForm.notes} onChange={(event) => setBootstrapForm((prev) => ({ ...prev, notes: event.target.value }))} disabled={!canManageBootstrap} />
                        </div>
                        <div className="panel-data-connection-status">
                          <strong>Última declaração</strong>
                          <span>{formatDateTime(snapshot.bootstrap.declaredAt)}</span>
                          <small>Pacote base em {formatDateTime(snapshot.bootstrap.packageGeneratedAt)}</small>
                        </div>
                        <div className="panel-actions">
                          <button type="button" className="panel-btn panel-btn-secondary" onClick={handleSaveBootstrap} disabled={saving || !canManageBootstrap}>
                            Salvar estado manual
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="panel-data-wizard__footer">
                      <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setCurrentProvisioningStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3 | 4) : current))} disabled={currentProvisioningStep === 1}>
                        Etapa anterior
                      </button>
                      <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setCurrentProvisioningStep((current) => (current < 4 ? ((current + 1) as 1 | 2 | 3 | 4) : current))} disabled={currentProvisioningStep === 4}>
                        Próxima etapa
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentDataModule === 'import' ? (
                <div className="panel-data-import-grid">
                  <article className="panel-card">
                    <div className="panel-data-context-banner panel-data-context-banner--import">
                      <div>
                        <strong>Entidade alvo</strong>
                        <p className="panel-muted">
                          {selectedEntity
                            ? `Os registros abaixo serão aplicados em ${selectedEntity.label} (${selectedEntity.tableName}).`
                            : 'Selecione ou crie uma entidade antes de importar registros específicos.'}
                        </p>
                      </div>
                      <label className="panel-field panel-field--toolbar">
                        <span>Entidade</span>
                        <select
                          className="panel-select"
                          value={selectedEntityId || ''}
                          onChange={(event) => setSelectedEntityId(event.target.value || null)}
                          disabled={!snapshot.entities.length}
                        >
                          <option value="">Selecione</option>
                          {snapshot.entities.map((entity) => (
                            <option key={entity.id} value={entity.id}>
                              {entity.label} ({entity.tableName})
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {selectedEntity ? (
                      <div className="panel-data-import-target">
                        <span className="panel-badge panel-badge-success">Entidade ativa</span>
                        <strong>{selectedEntity.label}</strong>
                        <code>{selectedEntity.tableName}</code>
                        <small>
                          {selectedEntity.fields.length} campos · {selectedEntity.status === 'ready' ? 'pronta para operação' : 'em rascunho'}
                        </small>
                      </div>
                    ) : null}
                    <h3>Registros da entidade selecionada</h3>
                    {!selectedEntity ? (
                      <div className="panel-feedback panel-feedback-warning">
                        Nenhuma entidade selecionada. Escolha a entidade alvo para liberar a importação manual de registros.
                      </div>
                    ) : null}
                    <textarea className="panel-textarea panel-data-codearea" value={importRowsText} onChange={(event) => setImportRowsText(event.target.value)} disabled={!canManageRecords} />
                    <div className="panel-actions">
                      <button type="button" className="panel-btn panel-btn-secondary" onClick={handleImportRows} disabled={saving || !selectedEntityId || !canManageRecords}>
                        Importar registros
                      </button>
                    </div>
                  </article>
                  <article className="panel-card">
                    <h3>Pacote completo</h3>
                    <textarea className="panel-textarea panel-data-codearea" value={importBundleText} onChange={(event) => setImportBundleText(event.target.value)} disabled={!canManageEntities && !canManageRecords} />
                    <div className="panel-actions">
                      <button type="button" className="panel-btn panel-btn-secondary" onClick={handleImportBundle} disabled={saving || (!canManageEntities && !canManageRecords)}>
                        Importar pacote
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}

              {currentDataModule === 'records' ? (
                <DataEntityRecordsWorkspace
                  entities={snapshot.entities}
                  initialSettings={initialSettings}
                  csrfToken={csrfToken}
                  canManageRecords={canManageRecords}
                  initialEntityId={selectedEntityId}
                />
              ) : null}

              {currentDataModule === 'csv' && canManageDatabaseTables ? (
                <div className="panel-data-import-grid">
                  <article className="panel-card">
                    <div className="panel-inline-between panel-inline-wrap">
                      <div>
                        <h3>Exportação e leitura da tabela</h3>
                        <p className="panel-muted">Escolha a tabela, visualize a estrutura e gere o CSV operacional.</p>
                      </div>
                      <div className="panel-actions">
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={handleRefreshDatabaseTables} disabled={saving}>
                          Recarregar tabelas
                        </button>
                        {csvPreview ? (
                          <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => downloadNamedTextFile(csvPreview.fileName, csvPreview.csv, 'text/csv;charset=utf-8')}>
                            Baixar último CSV
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="panel-form-grid panel-form-grid--two">
                      <div className="panel-field">
                        <label>Tabela</label>
                        <select className="panel-select" value={selectedDatabaseTableName || ''} onChange={(event) => setSelectedDatabaseTableName(event.target.value || null)} disabled={saving || !databaseTables.length}>
                          <option value="">Selecione</option>
                          {databaseTables.map((table) => (
                            <option key={table.tableName} value={table.tableName}>
                              {table.label} ({table.tableName})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="panel-field">
                        <label>Modo de importação</label>
                        <select className="panel-select" value={csvImportMode} onChange={(event) => setCsvImportMode(event.target.value as DataTableCsvImportMode)} disabled={saving}>
                          <option value="append">Append</option>
                          <option value="upsert">Upsert</option>
                        </select>
                      </div>
                    </div>
                    {selectedDatabaseTable ? (
                      <div className="panel-data-csv-meta">
                        <div className="panel-data-csv-meta__header">
                          <strong>{selectedDatabaseTable.label}</strong>
                          <span className={`panel-badge ${selectedDatabaseTable.source === 'database' ? 'panel-badge-neutral' : 'panel-badge-success'}`}>
                            {selectedDatabaseTable.source === 'database' ? 'base física' : 'mapeada no sistema'}
                          </span>
                        </div>
                        <p className="panel-muted">{selectedDatabaseTable.description}</p>
                        <div className="panel-data-csv-tags">
                          <span className="panel-link-chip">{selectedDatabaseTable.schema}.{selectedDatabaseTable.tableName}</span>
                          <span className="panel-link-chip">{formatInteger(selectedDatabaseTable.columns.length)} colunas</span>
                          <span className="panel-link-chip">{selectedDatabaseTable.primaryKey.length ? `PK: ${selectedDatabaseTable.primaryKey.join(', ')}` : 'Sem PK detectada'}</span>
                        </div>
                        <div className="panel-data-csv-columns">
                          {selectedDatabaseTable.columns.map((column) => (
                            <div key={column.name} className="panel-data-csv-column">
                              <div className="panel-inline-between panel-inline-wrap">
                                <strong>{column.name}</strong>
                                <span className="panel-muted">{column.dataType}</span>
                              </div>
                              <small>
                                {column.primaryKey ? 'PK · ' : ''}
                                {column.nullable ? 'Aceita vazio' : 'Obrigatória'}
                                {column.defaultValue ? ` · default ${column.defaultValue}` : ''}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="panel-data-connection-status">
                        <strong>Nenhuma tabela selecionada</strong>
                        <small>{databaseTablesAvailable ? 'Escolha uma tabela para exportar ou importar CSV.' : 'Banco indisponível ou sem tabelas acessíveis no ambiente atual.'}</small>
                      </div>
                    )}
                    <div className="panel-actions">
                      <button type="button" className="panel-btn panel-btn-primary" onClick={handleExportTableCsv} disabled={saving || !selectedDatabaseTable}>
                        Gerar CSV da tabela
                      </button>
                    </div>
                    {csvPreview ? (
                      <div className="panel-data-connection-status">
                        <strong>Última exportação</strong>
                        <span>{csvPreview.fileName} · {formatInteger(csvPreview.rowCount)} linhas</span>
                        <small>Gerado em {formatDateTime(csvPreview.generatedAt)}</small>
                      </div>
                    ) : null}
                    {csvImportSummary ? (
                      <div className="panel-data-connection-status">
                        <strong>Última importação</strong>
                        <span>{csvImportSummary.tableName} · {csvImportSummary.mode}</span>
                        <small>
                          {formatInteger(csvImportSummary.processedRows)} linhas processadas, {formatInteger(csvImportSummary.insertedRows)} inseridas e {formatInteger(csvImportSummary.updatedRows)} atualizadas em {formatDateTime(csvImportSummary.importedAt)}
                        </small>
                      </div>
                    ) : null}
                  </article>
                  <article className="panel-card">
                    <div className="panel-inline-between panel-inline-wrap">
                      <div>
                        <h3>Conteúdo CSV</h3>
                        <p className="panel-muted">Cole o conteúdo ou carregue um arquivo para importar na tabela selecionada.</p>
                      </div>
                      <label className="panel-btn panel-btn-secondary panel-btn-sm">
                        Carregar arquivo CSV
                        <input type="file" accept=".csv,text/csv" hidden onChange={handleLoadCsvFile} />
                      </label>
                    </div>
                    <textarea className="panel-textarea panel-data-codearea" value={csvImportText} onChange={(event) => setCsvImportText(event.target.value)} disabled={saving} placeholder="id,email,name&#10;usr_1,cliente@exemplo.com,Cliente Exemplo" />
                    <div className="panel-actions">
                      <button type="button" className="panel-btn panel-btn-primary" onClick={handleImportTableCsv} disabled={saving || !selectedDatabaseTable || !csvImportText.trim()}>
                        Importar CSV na tabela
                      </button>
                      {csvPreview ? (
                        <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setCsvImportText(csvPreview.csv)} disabled={saving}>
                          Usar último CSV exportado
                        </button>
                      ) : null}
                    </div>
                    {csvPreview ? (
                      <div className="panel-data-code-shell">
                        <div className="panel-data-code-toolbar">
                          <strong>Prévia do último CSV gerado</strong>
                          <div className="panel-actions">
                            <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => navigator.clipboard.writeText(csvPreview.csv)}>
                              Copiar
                            </button>
                          </div>
                        </div>
                        <pre className="panel-data-code-pre">{csvPreview.csv}</pre>
                      </div>
                    ) : null}
                  </article>
                </div>
              ) : null}

              {currentDataModule === 'bundle' ? (
                <div className="panel-data-import-grid">
                  <article className="panel-card">
                    <div className="panel-inline-between">
                      <div>
                        <h3>Arquivos do pacote</h3>
                        <p className="panel-muted">Atualize, selecione e baixe os arquivos gerados para bootstrap do ambiente.</p>
                      </div>
                      <div className="panel-actions">
                        <span className="panel-muted">Gerado em {formatDateTime(bundle.generatedAt)}</span>
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={handleGenerateBundle} disabled={saving || (!canManageEntities && !canManageBootstrap)}>
                          Atualizar pacote
                        </button>
                      </div>
                    </div>
                    <div className="panel-segmented-links">
                      {bundle.files.map((file) => (
                        <button key={file.path} type="button" className={`panel-link-chip ${activeBundlePath === file.path ? 'is-active' : ''}`} onClick={() => setActiveBundlePath(file.path)}>
                          {file.path.split('/').pop()}
                        </button>
                      ))}
                    </div>
                    {activeBundleFile ? (
                      <div className="panel-data-code-shell">
                        <div className="panel-data-code-toolbar">
                          <strong>{activeBundleFile.path}</strong>
                          <div className="panel-actions">
                            <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => downloadTextFile(activeBundleFile)}>
                              Baixar
                            </button>
                            <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => navigator.clipboard.writeText(activeBundleFile.content)}>
                              Copiar
                            </button>
                          </div>
                        </div>
                        <pre className="panel-data-code-pre">{activeBundleFile.content}</pre>
                      </div>
                    ) : null}
                  </article>

                  <article className="panel-card">
                    <div className="panel-inline-between panel-inline-wrap">
                      <div>
                        <h3>Backup geral do Data Studio</h3>
                        <p className="panel-muted">Exporta entidades, imports e registros reais das tabelas modeladas em um único JSON restaurável.</p>
                      </div>
                      <div className="panel-actions">
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={handleGenerateBackup} disabled={saving || (!canManageEntities && !canManageRecords)}>
                          Gerar backup
                        </button>
                        {backupDraftText ? (
                          <button
                            type="button"
                            className="panel-btn panel-btn-secondary panel-btn-sm"
                            onClick={() => downloadNamedTextFile(backupFileName || `artmeta-panel-backup-${Date.now()}.json`, backupDraftText, 'application/json;charset=utf-8')}
                          >
                            Baixar JSON
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <label className="panel-field">
                      <span>Carregar backup salvo</span>
                      <input
                        className="panel-input"
                        type="file"
                        accept="application/json,.json"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setBackupFileName(file.name);
                          setBackupDraftText(await file.text());
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>

                    <textarea
                      className="panel-textarea panel-data-codearea"
                      value={backupDraftText}
                      onChange={(event) => setBackupDraftText(event.target.value)}
                      placeholder='{"snapshot": {...}, "recordsByEntity": {...}}'
                    />

                    <div className="panel-data-connection-status">
                      <strong>Modo do backup</strong>
                      <small>
                        Se o runtime de banco estiver indisponível, o painel gera um backup estrutural com <code>snapshot</code> e <code>imports</code>.
                        Quando houver conexão ativa, ele inclui também os registros em <code>recordsByEntity</code>.
                      </small>
                    </div>

                    <div className="panel-actions">
                      <button
                        type="button"
                        className="panel-btn panel-btn-primary"
                        onClick={handleRestoreBackup}
                        disabled={saving || !backupDraftText.trim() || (!canManageEntities && !canManageRecords)}
                      >
                        Restaurar backup
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}
            </div>
        </section>
      ) : null}

      {isEntityViewerOpen && selectedEntity ? (
        <div className="panel-editor-modal" role="dialog" aria-modal="true" aria-labelledby="panel-entity-viewer-title">
          <div className="panel-editor-modal__content">
            <div className="panel-editor-modal__header">
              <div>
                <p className="panel-kicker">Entidade</p>
                <h2 id="panel-entity-viewer-title">{selectedEntity.label}</h2>
                <p>Visualização estrutural da entidade em formato mais compacto, com metadados e tabela de campos.</p>
              </div>
              <button type="button" className="panel-editor-modal__close" onClick={() => setIsEntityViewerOpen(false)} aria-label="Fechar detalhes da entidade">
                ×
              </button>
            </div>

            <div className="panel-data-editor-modal__body">
              <article className="panel-card panel-data-entity-modal-card">
                <div className="panel-data-entity-overview__meta">
                  <div>
                    <span className="panel-muted">Nome</span>
                    <strong>{selectedEntity.label}</strong>
                  </div>
                  <div>
                    <span className="panel-muted">Slug</span>
                    <strong>{selectedEntity.slug}</strong>
                  </div>
                  <div>
                    <span className="panel-muted">Tabela</span>
                    <strong>{selectedEntity.tableName}</strong>
                  </div>
                  <div>
                    <span className="panel-muted">Status</span>
                    <strong>{selectedEntity.status === 'ready' ? 'Pronto' : 'Rascunho'}</strong>
                  </div>
                  <div>
                    <span className="panel-muted">Tabela física</span>
                    <strong>{buildRuntimeTableStatus(selectedEntityRuntime)}</strong>
                  </div>
                  <div>
                    <span className="panel-muted">Linhas atuais</span>
                    <strong>{formatInteger(selectedEntityRuntime?.rowCount || 0)}</strong>
                  </div>
                </div>

                <div className="panel-data-entity-overview__description">
                  <span className="panel-muted">Descrição</span>
                  <p>{selectedEntity.description || 'Sem descrição cadastrada.'}</p>
                </div>

                {selectedEntityRuntime ? (
                  <div className="panel-data-entity-overview__description">
                    <span className="panel-muted">Schema, API e permissões</span>
                    <div className="panel-data-csv-tags">
                      <span className="panel-link-chip">{selectedEntityRuntime.schemaPath}</span>
                      <span className="panel-link-chip">{selectedEntityRuntime.internalCollectionPath}</span>
                      <span className="panel-link-chip">{selectedEntityRuntime.integrationCollectionPath}</span>
                      <span className="panel-link-chip">{selectedEntityRuntime.readScope}</span>
                      <span className="panel-link-chip">{selectedEntityRuntime.writeScope}</span>
                    </div>
                    {selectedEntityRuntime.missingColumns.length || selectedEntityRuntime.extraColumns.length ? (
                      <p className="panel-muted">
                        {selectedEntityRuntime.missingColumns.length
                          ? `Faltando no banco: ${selectedEntityRuntime.missingColumns.join(', ')}. `
                          : ''}
                        {selectedEntityRuntime.extraColumns.length
                          ? `Extras na tabela: ${selectedEntityRuntime.extraColumns.join(', ')}.`
                          : ''}
                      </p>
                    ) : (
                      <p className="panel-muted">Schema lógico e tabela física estão alinhados.</p>
                    )}
                  </div>
                ) : null}

                <div className="panel-actions">
                  {canManageEntities ? (
                    <>
                      <button
                        type="button"
                        className="panel-btn panel-btn-secondary panel-btn-sm"
                        onClick={handleSyncSelectedEntityStructure}
                      >
                        Sincronizar tabela
                      </button>
                      <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => {
                        setIsEntityViewerOpen(false);
                        openEntityEditor(selectedEntity.id);
                      }}>
                        Editar estrutura
                      </button>
                      <button
                        type="button"
                        className="panel-btn panel-btn-secondary panel-btn-sm"
                        onClick={() => handleSetEntityStatus(selectedEntity.status === 'ready' ? 'draft' : 'ready')}
                      >
                        {selectedEntity.status === 'ready' ? 'Mover para rascunho' : 'Marcar como pronta'}
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="panel-data-fields-table">
                  <div className="panel-data-fields-table__head">
                    <span>Campo</span>
                    <span>Rótulo</span>
                    <span>Tipo</span>
                    <span>Regras</span>
                    <span>Lista</span>
                  </div>
                  {selectedEntity.fields.map((field) => (
                    <div key={field.id} className="panel-data-fields-table__row">
                      <div>
                        <strong>{field.name}</strong>
                        {field.description ? <small className="panel-muted">{field.description}</small> : null}
                      </div>
                      <div>{field.label || '-'}</div>
                      <div>{field.type}</div>
                      <div>{describeFieldRules(field)}</div>
                      <div>{field.listVisible ? 'Sim' : 'Não'}</div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : null}

      {isEntityEditorOpen ? (
        <div className="panel-editor-modal" role="dialog" aria-modal="true" aria-labelledby="panel-entity-editor-title">
          <div className="panel-editor-modal__content">
            <div className="panel-editor-modal__header">
              <div>
                <p className="panel-kicker">Modelagem da entidade</p>
                <h2 id="panel-entity-editor-title">{entityForm.id ? `Editar ${entityForm.label || 'entidade'}` : 'Nova entidade'}</h2>
                <p>Preencha a estrutura principal e expanda apenas os campos que precisar detalhar.</p>
              </div>
              <button type="button" className="panel-editor-modal__close" onClick={() => setIsEntityEditorOpen(false)} aria-label="Fechar editor">
                ×
              </button>
            </div>

            <div className="panel-data-editor-modal__body">
              <form className="panel-form" onSubmit={handleSaveEntity}>
                <div className="panel-form-grid panel-form-grid--three">
                  <div className="panel-field">
                    <label htmlFor="data-entity-label">Nome</label>
                    <input
                      id="data-entity-label"
                      className="panel-input"
                      value={entityForm.label}
                      onChange={(event) => {
                        const nextLabel = event.target.value;
                        setEntityForm((prev) => ({
                          ...prev,
                          label: nextLabel,
                          slug: prev.id ? prev.slug : slugify(nextLabel),
                          tableName: prev.id ? prev.tableName : tableize(`app_${slugify(nextLabel).replace(/-/g, '_')}`),
                        }));
                      }}
                      disabled={!canManageEntities}
                      required
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="data-entity-slug">Slug</label>
                    <input
                      id="data-entity-slug"
                      className="panel-input"
                      value={entityForm.slug}
                      onChange={(event) => setEntityForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
                      disabled={!canManageEntities}
                      required
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="data-entity-table">Tabela</label>
                    <input
                      id="data-entity-table"
                      className="panel-input"
                      value={entityForm.tableName}
                      onChange={(event) => setEntityForm((prev) => ({ ...prev, tableName: tableize(event.target.value) }))}
                      disabled={!canManageEntities}
                      required
                    />
                  </div>
                </div>

                <div className="panel-form-grid panel-form-grid--three">
                  <div className="panel-field panel-field-full">
                    <label htmlFor="data-entity-description">Descrição</label>
                    <textarea
                      id="data-entity-description"
                      className="panel-textarea"
                      value={entityForm.description}
                      onChange={(event) => setEntityForm((prev) => ({ ...prev, description: event.target.value }))}
                      disabled={!canManageEntities}
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="data-entity-status">Status</label>
                    <select
                      id="data-entity-status"
                      className="panel-select"
                      value={entityForm.status}
                      onChange={(event) => setEntityForm((prev) => ({ ...prev, status: event.target.value as EntityForm['status'] }))}
                      disabled={!canManageEntities}
                    >
                      <option value="draft">Rascunho</option>
                      <option value="ready">Pronto</option>
                    </select>
                  </div>
                </div>

                <section className="panel-form-section">
                  <div className="panel-inline-between">
                    <div>
                      <h3>Campos</h3>
                      <p className="panel-muted">Linhas compactas, com detalhes só quando necessário.</p>
                    </div>
                    {canManageEntities ? (
                      <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addField}>
                        Adicionar campo
                      </button>
                    ) : null}
                  </div>

                  <div className="panel-data-field-table">
                    <div className="panel-data-field-table__head">
                      <span>Nome técnico</span>
                      <span>Rótulo</span>
                      <span>Tipo</span>
                      <span>Valor padrão</span>
                      <span>Regras</span>
                      <span>Ações</span>
                    </div>

                    {entityForm.fields.map((field, index) => {
                      const isExpanded = expandedFieldId === field.id;

                      return (
                        <div key={field.id} className={`panel-data-field-row ${isExpanded ? 'is-expanded' : ''}`}>
                          <div className="panel-data-field-row__grid">
                            <div className="panel-field">
                              <input
                                className="panel-input"
                                value={field.name}
                                onChange={(event) => updateField(field.id, 'name', fieldize(event.target.value))}
                                disabled={!canManageEntities}
                                placeholder={`campo_${index + 1}`}
                              />
                            </div>
                            <div className="panel-field">
                              <input
                                className="panel-input"
                                value={field.label}
                                onChange={(event) => updateField(field.id, 'label', event.target.value)}
                                disabled={!canManageEntities}
                                placeholder="Rótulo"
                              />
                            </div>
                            <div className="panel-field">
                              <select
                                className="panel-select"
                                value={field.type}
                                onChange={(event) => updateField(field.id, 'type', event.target.value as DataFieldType)}
                                disabled={!canManageEntities}
                              >
                                {DATA_FIELD_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="panel-field">
                              <input
                                className="panel-input"
                                value={field.defaultValue || ''}
                                onChange={(event) => updateField(field.id, 'defaultValue', event.target.value)}
                                disabled={!canManageEntities}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="panel-data-field-row__chips">
                              <label className="panel-role-item">
                                <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, 'required', event.target.checked)} disabled={!canManageEntities} />
                                <span>Obrig.</span>
                              </label>
                              <label className="panel-role-item">
                                <input type="checkbox" checked={field.unique} onChange={(event) => updateField(field.id, 'unique', event.target.checked)} disabled={!canManageEntities} />
                                <span>Único</span>
                              </label>
                              <label className="panel-role-item">
                                <input type="checkbox" checked={field.indexed} onChange={(event) => updateField(field.id, 'indexed', event.target.checked)} disabled={!canManageEntities} />
                                <span>Índice</span>
                              </label>
                              <label className="panel-role-item">
                                <input type="checkbox" checked={field.listVisible} onChange={(event) => updateField(field.id, 'listVisible', event.target.checked)} disabled={!canManageEntities} />
                                <span>Lista</span>
                              </label>
                            </div>
                            <div className="panel-actions">
                              <button
                                type="button"
                                className="panel-btn panel-btn-secondary panel-btn-xs"
                                onClick={() => setExpandedFieldId((current) => (current === field.id ? null : field.id))}
                              >
                                {isExpanded ? 'Menos' : 'Detalhes'}
                              </button>
                              {canManageEntities ? (
                                <button type="button" className="panel-btn panel-btn-danger panel-btn-xs" onClick={() => removeField(field.id)}>
                                  Remover
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="panel-data-field-row__details">
                              <div className="panel-field">
                                <label>Descrição</label>
                                <textarea
                                  className="panel-textarea"
                                  value={field.description}
                                  onChange={(event) => updateField(field.id, 'description', event.target.value)}
                                  disabled={!canManageEntities}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="panel-actions">
                  <button type="submit" className="panel-btn panel-btn-primary" disabled={saving || !canManageEntities}>
                    {saving ? 'Salvando...' : entityForm.id ? 'Salvar entidade' : 'Criar entidade'}
                  </button>
                  <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setIsEntityEditorOpen(false)}>
                    Fechar editor
                  </button>
                  <button type="button" className="panel-btn panel-btn-danger" onClick={handleDeleteEntity} disabled={saving || !canManageEntities}>
                    {entityForm.id ? 'Excluir entidade' : 'Limpar rascunho'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
