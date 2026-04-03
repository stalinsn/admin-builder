'use client';

import { useEffect, useMemo, useState } from 'react';

import CustomerOperationsManager from '@/features/ecommpanel/components/CustomerOperationsManager';
import type { AdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import type { DataEntityDefinition } from '@/features/ecommpanel/types/dataStudio';

type Props = {
  initialSettings: AdminBuilderSettings;
  entities: DataEntityDefinition[];
};

type RecordsResponse = {
  ok?: boolean;
  records?: Record<string, unknown>[];
  total?: number;
  error?: string;
};

type RecordResponse = {
  ok?: boolean;
  record?: Record<string, unknown>;
  error?: string;
};

type CsvExportResponse = {
  ok?: boolean;
  csvExport?: {
    fileName: string;
    csv: string;
    rowCount: number;
    generatedAt: string;
  };
  error?: string;
};

type CsvImportResponse = {
  ok?: boolean;
  csvImportResult?: {
    processedRows: number;
    insertedRows: number;
    updatedRows: number;
    importedAt: string;
  };
  error?: string;
};

type MeResponse = {
  csrfToken?: string;
};

type WorkspaceMode = AdminBuilderSettings['accountWorkspace']['mode'];

function normalizeInputValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (type === 'date' || type === 'datetime') {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return type === 'date' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 16);
    }
  }
  return String(value);
}

function parseFieldValue(type: string, value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (type === 'boolean') return ['1', 'true', 'sim', 'yes', 'on'].includes(trimmed.toLowerCase());
  if (type === 'integer') return Number.parseInt(trimmed, 10);
  if (type === 'number' || type === 'currency') return Number.parseFloat(trimmed);
  if (type === 'json') return JSON.parse(trimmed);
  return value;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildEntityAcronym(entity: DataEntityDefinition): string {
  const source = (entity.label || entity.slug).replace(/[_-]+/g, ' ').trim();
  if (!source) return 'ENT';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 3).map((part) => part[0]).join('').toUpperCase();
  }
  return source.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ENT';
}

function getDefaultVisibleFieldNames(entity: DataEntityDefinition | null): string[] {
  if (!entity) return [];
  const preferredFields = entity.fields.filter((field) => field.listVisible);
  const source = preferredFields.length ? preferredFields : entity.fields;
  return source.slice(0, 6).map((field) => field.name);
}

function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  const stringValue = String(value);
  return stringValue.length > 96 ? `${stringValue.slice(0, 93)}...` : stringValue;
}

export default function AccountWorkspaceManager({ initialSettings, entities }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [mode, setMode] = useState<WorkspaceMode>(initialSettings.accountWorkspace.mode);
  const [entitySlug, setEntitySlug] = useState(initialSettings.accountWorkspace.entitySlug || entities[0]?.slug || '');
  const [entityListFieldNames, setEntityListFieldNames] = useState<Record<string, string[]>>(
    initialSettings.accountWorkspace.entityListFieldNames || {},
  );
  const [csrfToken, setCsrfToken] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [recordDraft, setRecordDraft] = useState<Record<string, string>>({});
  const [jsonRowsText, setJsonRowsText] = useState('[\n  {\n    "slug": "starter-account",\n    "name": "Conta inicial"\n  }\n]');
  const [csvText, setCsvText] = useState('');
  const [csvMode, setCsvMode] = useState<'append' | 'upsert'>('upsert');
  const [fieldSelectionDirty, setFieldSelectionDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.slug === entitySlug) || null,
    [entities, entitySlug],
  );

  const selectedFieldNames = useMemo(() => {
    if (!selectedEntity) return [];
    const allowedFieldNames = new Set(selectedEntity.fields.map((field) => field.name));
    const savedFieldNames = entityListFieldNames[selectedEntity.slug] || [];
    const normalizedFieldNames = savedFieldNames.filter((fieldName) => allowedFieldNames.has(fieldName));
    return normalizedFieldNames.length ? normalizedFieldNames.slice(0, 8) : getDefaultVisibleFieldNames(selectedEntity);
  }, [entityListFieldNames, selectedEntity]);

  const visibleFields = useMemo(() => {
    if (!selectedEntity) return [];
    const selectedFieldNameSet = new Set(selectedFieldNames);
    return selectedFieldNames
      .map((fieldName) => selectedEntity.fields.find((field) => field.name === fieldName) || null)
      .filter((field): field is DataEntityDefinition['fields'][number] => Boolean(field))
      .filter((field) => selectedFieldNameSet.has(field.name));
  }, [selectedEntity, selectedFieldNames]);

  const selectedRecord = useMemo(
    () => records.find((record) => String(record.id || '') === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const recordTableTemplate = useMemo(() => {
    const columns = ['minmax(220px, 1.45fr)', ...visibleFields.map(() => 'minmax(160px, 1fr)')];
    return columns.join(' ');
  }, [visibleFields]);

  useEffect(() => {
    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as MeResponse | null;
      })
      .then((payload) => {
        if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mode !== 'entity' || !selectedEntity) return;
    void loadRecords(selectedEntity.slug);
  }, [mode, selectedEntity?.slug]);

  useEffect(() => {
    if (!selectedEntity) {
      setRecordDraft({});
      return;
    }

    if (!selectedRecord) {
      setRecordDraft(
        Object.fromEntries(selectedEntity.fields.map((field) => [field.name, normalizeInputValue(field.defaultValue ?? '', field.type)])),
      );
      return;
    }

    setRecordDraft(
      Object.fromEntries(
        selectedEntity.fields.map((field) => [field.name, normalizeInputValue(selectedRecord[field.name], field.type)]),
      ),
    );
  }, [selectedEntity, selectedRecord]);

  useEffect(() => {
    if (!selectedEntity) return;
    if ((entityListFieldNames[selectedEntity.slug] || []).length) return;
    setEntityListFieldNames((current) => ({
      ...current,
      [selectedEntity.slug]: getDefaultVisibleFieldNames(selectedEntity),
    }));
  }, [entityListFieldNames, selectedEntity]);

  async function loadRecords(nextEntitySlug: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/ecommpanel/data-studio/entities/${encodeURIComponent(nextEntitySlug)}/records?limit=200`,
        { cache: 'no-store', credentials: 'same-origin' },
      );
      const payload = (await response.json().catch(() => null)) as RecordsResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar os registros da entidade.');
      }
      const nextRecords = payload?.records || [];
      setRecords(nextRecords);
      setSelectedRecordId((current) => (current && nextRecords.some((record) => String(record.id || '') === current) ? current : String(nextRecords[0]?.id || '') || null));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao carregar registros.');
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkspaceSettings(
    overrides?: Partial<AdminBuilderSettings['accountWorkspace']>,
    successMessage = 'Workspace de contas atualizado.',
  ) {
    if (!csrfToken) return;
    const nextMode = overrides?.mode ?? mode;
    const nextEntitySlug = overrides?.entitySlug ?? entitySlug;
    const nextEntityListFieldNames = overrides?.entityListFieldNames ?? entityListFieldNames;

    setSavingSettings(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommpanel/settings/admin-builder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          settings: {
            accountWorkspace: {
              mode: nextMode,
              entitySlug: nextEntitySlug,
              entityListFieldNames: nextEntityListFieldNames,
            },
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { settings?: AdminBuilderSettings; error?: string } | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error || 'Não foi possível atualizar o workspace de contas.');
      }
      setSettings(payload.settings);
      setMode(payload.settings.accountWorkspace.mode);
      setEntitySlug(payload.settings.accountWorkspace.entitySlug || entities[0]?.slug || '');
      setEntityListFieldNames(payload.settings.accountWorkspace.entityListFieldNames || {});
      setFieldSelectionDirty(false);
      setSuccess(successMessage);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar as preferências.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveRecord() {
    if (!selectedEntity || !csrfToken) return;
    setSavingRecord(true);
    setError(null);
    setSuccess(null);
    try {
      const record = Object.fromEntries(
        selectedEntity.fields.map((field) => [field.name, parseFieldValue(field.type, recordDraft[field.name] || '')]),
      );
      const isEditing = Boolean(selectedRecordId);
      const endpoint = isEditing
        ? `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records/${encodeURIComponent(selectedRecordId || '')}`
        : `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records`;
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ record }),
      });
      const payload = (await response.json().catch(() => null)) as RecordResponse | null;
      if (!response.ok || !payload?.record) {
        throw new Error(payload?.error || 'Não foi possível salvar o registro.');
      }
      setSelectedRecordId(String(payload.record.id || ''));
      await loadRecords(selectedEntity.slug);
      setSuccess(isEditing ? 'Registro atualizado.' : 'Registro criado.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar o registro.');
    } finally {
      setSavingRecord(false);
    }
  }

  async function deleteSelectedRecord() {
    if (!selectedEntity || !selectedRecordId || !csrfToken) return;
    const confirmed = window.confirm('Remover este registro?');
    if (!confirmed) return;

    setSavingRecord(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records/${encodeURIComponent(selectedRecordId)}`,
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': csrfToken,
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível remover o registro.');
      }
      setSelectedRecordId(null);
      await loadRecords(selectedEntity.slug);
      setSuccess('Registro removido.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao remover o registro.');
    } finally {
      setSavingRecord(false);
    }
  }

  async function importJsonRows() {
    if (!selectedEntity || !csrfToken) return;
    setSavingRecord(true);
    setError(null);
    setSuccess(null);
    try {
      const rows = JSON.parse(jsonRowsText) as unknown;
      if (!Array.isArray(rows)) throw new Error('O JSON precisa ser uma lista de objetos.');
      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action: 'importRows',
          entityId: selectedEntity.id,
          sourceLabel: 'account-workspace-manual',
          rows,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível importar os registros JSON.');
      }
      await loadRecords(selectedEntity.slug);
      setSuccess('Registros importados via JSON.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha na importação JSON.');
    } finally {
      setSavingRecord(false);
    }
  }

  async function exportCsv() {
    if (!selectedEntity) return;
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/csv`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as CsvExportResponse | null;
      if (!response.ok || !payload?.csvExport) {
        throw new Error(payload?.error || 'Não foi possível exportar o CSV.');
      }
      downloadTextFile(payload.csvExport.fileName, payload.csvExport.csv, 'text/csv;charset=utf-8');
      setCsvText(payload.csvExport.csv);
      setSuccess('CSV gerado com sucesso.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao exportar CSV.');
    }
  }

  async function importCsv() {
    if (!selectedEntity || !csrfToken) return;
    setSavingRecord(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          csvContent: csvText,
          mode: csvMode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as CsvImportResponse | null;
      if (!response.ok || !payload?.csvImportResult) {
        throw new Error(payload?.error || 'Não foi possível importar o CSV.');
      }
      await loadRecords(selectedEntity.slug);
      setSuccess(
        `CSV importado: ${payload.csvImportResult.processedRows} linhas, ${payload.csvImportResult.insertedRows} inseridas e ${payload.csvImportResult.updatedRows} atualizadas.`,
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao importar CSV.');
    } finally {
      setSavingRecord(false);
    }
  }

  function handleSelectEntity(nextEntitySlug: string) {
    setEntitySlug(nextEntitySlug);
    setSelectedRecordId(null);
    setSuccess(null);
    setError(null);
  }

  function toggleVisibleField(fieldName: string) {
    if (!selectedEntity) return;

    setEntityListFieldNames((current) => {
      const currentFields = current[selectedEntity.slug] || getDefaultVisibleFieldNames(selectedEntity);
      const nextFields = currentFields.includes(fieldName)
        ? currentFields.filter((currentFieldName) => currentFieldName !== fieldName)
        : [...currentFields, fieldName].slice(0, 8);

      setFieldSelectionDirty(true);

      return {
        ...current,
        [selectedEntity.slug]: nextFields.length ? nextFields : getDefaultVisibleFieldNames(selectedEntity),
      };
    });
  }

  function resetVisibleFields() {
    if (!selectedEntity) return;
    setEntityListFieldNames((current) => ({
      ...current,
      [selectedEntity.slug]: getDefaultVisibleFieldNames(selectedEntity),
    }));
    setFieldSelectionDirty(true);
  }

  if (mode === 'native' && settings.accountWorkspace.mode === 'native') {
    return (
      <section className="panel-grid">
        <article className="panel-card panel-card-hero panel-card-hero--compact">
          <p className="panel-kicker">Contas</p>
          <h1>Workspace de contas</h1>
          <p className="panel-muted">Escolha se este painel opera as contas nativas do auth-kit ou uma entidade modelada no Data Studio.</p>
          <div className="panel-inline-actions">
            <label className="panel-field">
              <span>Modo</span>
              <select className="panel-select" value={mode} onChange={(event) => setMode(event.target.value as WorkspaceMode)}>
                <option value="native">Contas nativas</option>
                <option value="entity">Entidade do Data Studio</option>
              </select>
            </label>
            <div className="panel-actions">
              <button type="button" className="panel-btn panel-btn-primary" onClick={() => void saveWorkspaceSettings()} disabled={savingSettings}>
                Aplicar
              </button>
            </div>
          </div>
          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}
        </article>

        <CustomerOperationsManager />
      </section>
    );
  }

  return (
    <section className="panel-grid">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Contas</p>
        <h1>Workspace de contas por entidade</h1>
        <p className="panel-muted">Use uma entidade modelada no Data Studio como fonte principal de contas, perfis ou membros do sistema.</p>
        <div className="panel-inline-actions">
          <label className="panel-field">
            <span>Modo</span>
            <select className="panel-select" value={mode} onChange={(event) => setMode(event.target.value as WorkspaceMode)}>
              <option value="native">Contas nativas</option>
              <option value="entity">Entidade do Data Studio</option>
            </select>
          </label>
          <button
            type="button"
            className="panel-btn panel-btn-primary"
            onClick={() => void saveWorkspaceSettings(undefined, 'Preferências do workspace salvas.')}
            disabled={savingSettings || !entitySlug}
          >
            Salvar preferências
          </button>
        </div>
        <div className="panel-grid panel-grid-2">
          <article className="panel-note">
            <strong>Contrato da entidade</strong>
            <p className="panel-muted">JSON Schema e OpenAPI continuam vindo de `/api/ecommpanel/data-studio/contracts` para a entidade selecionada.</p>
          </article>
          <article className="panel-note">
            <strong>Uso externo</strong>
            <p className="panel-muted">Depois de gerar a chave, você poderá operar essa entidade por `/api/integration/v1/data/entities/{'{entitySlug}'}/records`.</p>
          </article>
        </div>
        {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
        {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}
      </article>

      {!selectedEntity ? (
        <article className="panel-card">
          <h2>Nenhuma entidade disponível</h2>
          <p className="panel-muted">Modele uma entidade no Data Studio antes de usar o workspace de contas por entidade.</p>
        </article>
      ) : (
        <>
          <article className="panel-card">
            <div className="panel-section-heading">
              <div>
                <h2>Entidade base</h2>
                <p className="panel-muted">Troque a entidade por uma grade visual em vez do select clássico.</p>
              </div>
              <div className="panel-data-connection-status">
                <strong>{selectedEntity.label}</strong>
                <span>{selectedEntity.tableName}</span>
                <small>{selectedEntity.fields.length} campos modelados</small>
              </div>
            </div>
            <div className="panel-workspace-entity-grid">
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className={`panel-workspace-entity-card ${entity.slug === entitySlug ? 'is-active' : ''}`}
                  onClick={() => handleSelectEntity(entity.slug)}
                >
                  <span className="panel-workspace-entity-card__badge">{buildEntityAcronym(entity)}</span>
                  <span className="panel-workspace-entity-card__content">
                    <strong>{entity.label}</strong>
                    <small>{entity.slug}</small>
                  </span>
                  <span className="panel-workspace-entity-card__meta">{entity.fields.length} campos</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-section-heading">
              <div>
                <h2>Colunas da tabela</h2>
                <p className="panel-muted">Escolha quais campos principais aparecem na grade de leitura rápida.</p>
              </div>
              <div className="panel-inline-actions">
                <button type="button" className="panel-btn panel-btn-secondary" onClick={resetVisibleFields} disabled={savingSettings}>
                  Usar padrão
                </button>
                <button
                  type="button"
                  className="panel-btn panel-btn-primary"
                  onClick={() =>
                    void saveWorkspaceSettings(
                      {
                        entityListFieldNames,
                      },
                      'Colunas visíveis da entidade salvas.',
                    )
                  }
                  disabled={savingSettings || !fieldSelectionDirty}
                >
                  Salvar grade
                </button>
              </div>
            </div>
            <div className="panel-workspace-filter-bar">
              {selectedEntity.fields.map((field) => {
                const isActive = selectedFieldNames.includes(field.name);
                return (
                  <button
                    key={field.id}
                    type="button"
                    className={`panel-workspace-filter-chip ${isActive ? 'is-active' : ''}`}
                    onClick={() => toggleVisibleField(field.name)}
                  >
                    <span>{field.label}</span>
                    <small>{field.name}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-section-heading">
              <div>
                <h2>Registros de {selectedEntity.label}</h2>
                <p className="panel-muted">{selectedEntity.tableName} · {records.length} registros carregados</p>
              </div>
              <div className="panel-inline-actions">
                <button
                  type="button"
                  className="panel-btn panel-btn-secondary"
                  onClick={() => {
                    setSelectedRecordId(null);
                    setSuccess(null);
                    setError(null);
                  }}
                >
                  Novo registro
                </button>
                <button type="button" className="panel-btn panel-btn-secondary" onClick={exportCsv}>
                  Exportar CSV
                </button>
              </div>
            </div>
            {loading ? <p className="panel-muted">Carregando registros...</p> : null}
            <div className="panel-workspace-records-table">
              <div className="panel-workspace-records-table__head" style={{ gridTemplateColumns: recordTableTemplate }}>
                <span>Registro</span>
                {visibleFields.map((field) => (
                  <span key={field.id}>{field.label}</span>
                ))}
              </div>
              {records.map((record) => (
                <button
                  key={String(record.id || '')}
                  type="button"
                  className={`panel-workspace-records-row ${selectedRecordId === String(record.id || '') ? 'is-active' : ''}`}
                  style={{ gridTemplateColumns: recordTableTemplate }}
                  onClick={() => setSelectedRecordId(String(record.id || ''))}
                >
                  <span className="panel-workspace-records-row__identity">
                    <strong>{String(record.id || '')}</strong>
                    <small>
                      Atualizado em {String(record.updated_at || record.created_at || 'sem histórico')}
                    </small>
                  </span>
                  {visibleFields.map((field) => (
                    <span key={field.id} className="panel-workspace-records-row__cell" title={formatRecordValue(record[field.name])}>
                      {formatRecordValue(record[field.name])}
                    </span>
                  ))}
                </button>
              ))}
              {!records.length && !loading ? <p className="panel-muted">Nenhum registro disponível ainda.</p> : null}
            </div>
          </article>

          <article className="panel-card panel-workspace-editor-card">
            <div className="panel-section-heading">
              <div>
                <h2>{selectedRecordId ? 'Editar registro' : 'Novo registro'}</h2>
                <p className="panel-muted">Leitura mais clara, com superfície mais próxima da experiência de modelagem.</p>
              </div>
              {selectedRecordId ? (
                <button type="button" className="panel-btn panel-btn-danger" onClick={deleteSelectedRecord} disabled={savingRecord}>
                  Remover
                </button>
              ) : null}
            </div>
            <div className="panel-workspace-editor-surface">
              <div className="panel-form-grid">
                {selectedEntity.fields.map((field) => (
                  <label key={field.id} className="panel-field">
                    <span>{field.label}</span>
                    {field.type === 'boolean' ? (
                      <select
                        className="panel-select"
                        value={recordDraft[field.name] || ''}
                        onChange={(event) => setRecordDraft((current) => ({ ...current, [field.name]: event.target.value }))}
                      >
                        <option value="">Selecione</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    ) : field.type === 'json' || field.type === 'rich_text' ? (
                      <textarea
                        className="panel-textarea"
                        value={recordDraft[field.name] || ''}
                        onChange={(event) => setRecordDraft((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    ) : (
                      <input
                        className="panel-input"
                        type={
                          field.type === 'date'
                            ? 'date'
                            : field.type === 'datetime'
                              ? 'datetime-local'
                              : field.type === 'integer' || field.type === 'number' || field.type === 'currency'
                                ? 'number'
                                : 'text'
                        }
                        value={recordDraft[field.name] || ''}
                        onChange={(event) => setRecordDraft((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="panel-inline-actions">
              <button type="button" className="panel-btn panel-btn-primary" onClick={saveRecord} disabled={savingRecord}>
                {selectedRecordId ? 'Salvar alterações' : 'Criar registro'}
              </button>
            </div>
          </article>

          <article className="panel-card">
            <h2>Popular registros</h2>
            <p className="panel-muted">Você pode popular a entidade por JSON no painel, por CSV via planilha ou externamente por API autenticada.</p>
            <div className="panel-grid panel-grid-2">
              <div>
                <h3>Importação JSON</h3>
                <textarea className="panel-textarea panel-data-codearea" value={jsonRowsText} onChange={(event) => setJsonRowsText(event.target.value)} />
                <div className="panel-inline-actions">
                  <button type="button" className="panel-btn panel-btn-secondary" onClick={importJsonRows} disabled={savingRecord}>
                    Importar JSON
                  </button>
                </div>
              </div>
              <div>
                <h3>Importação CSV</h3>
                <label className="panel-field">
                  <span>Modo</span>
                  <select className="panel-select" value={csvMode} onChange={(event) => setCsvMode(event.target.value as 'append' | 'upsert')}>
                    <option value="upsert">Atualizar por id (upsert)</option>
                    <option value="append">Somente inserir</option>
                  </select>
                </label>
                <textarea className="panel-textarea panel-data-codearea" value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="id,name,slug" />
                <div className="panel-inline-actions">
                  <button type="button" className="panel-btn panel-btn-secondary" onClick={importCsv} disabled={savingRecord || !csvText.trim()}>
                    Importar CSV
                  </button>
                </div>
              </div>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
