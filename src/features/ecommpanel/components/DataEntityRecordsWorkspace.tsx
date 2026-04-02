'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { DataEntityDefinition } from '@/features/ecommpanel/types/dataStudio';
import PanelModal from '@/features/ecommpanel/components/PanelModal';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';

type Props = {
  entities: DataEntityDefinition[];
  csrfToken?: string;
  canManageRecords: boolean;
  initialEntityId?: string | null;
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

function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value?: string): string {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Inválido';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function buildJsonTemplate(entity?: DataEntityDefinition | null): string {
  if (!entity) {
    return '[\n  {\n    "id": "rec_1"\n  }\n]';
  }

  const draftRow: Record<string, string | number | boolean | null> = {};

  entity.fields.forEach((field, index) => {
    if (!field.name) return;

    switch (field.type) {
      case 'integer':
      case 'number':
      case 'currency':
        draftRow[field.name] = index + 1;
        break;
      case 'boolean':
        draftRow[field.name] = false;
        break;
      case 'date':
        draftRow[field.name] = new Date().toISOString().slice(0, 10);
        break;
      case 'datetime':
        draftRow[field.name] = new Date().toISOString();
        break;
      case 'json':
        draftRow[field.name] = null;
        break;
      default:
        draftRow[field.name] = '';
        break;
    }
  });

  if (!Object.keys(draftRow).length) {
    draftRow.id = 'rec_1';
  }

  return JSON.stringify([draftRow], null, 2);
}

export default function DataEntityRecordsWorkspace({
  entities,
  csrfToken,
  canManageRecords,
  initialEntityId,
}: Props) {
  const router = useRouter();
  const [csrfTokenValue, setCsrfTokenValue] = useState(csrfToken || '');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialEntityId || entities[0]?.id || null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [recordDraft, setRecordDraft] = useState<Record<string, string>>({});
  const [jsonRowsText, setJsonRowsText] = useState(() => buildJsonTemplate(entities[0] || null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) || null,
    [entities, selectedEntityId],
  );

  const visibleFields = useMemo(
    () => selectedEntity?.fields.filter((field) => field.listVisible).slice(0, 5) || selectedEntity?.fields.slice(0, 5) || [],
    [selectedEntity],
  );

  const selectedRecord = useMemo(
    () => records.find((record) => String(record.id || '') === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  useEffect(() => {
    if (csrfToken) {
      setCsrfTokenValue(csrfToken);
      return;
    }

    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as { csrfToken?: string } | null;
      })
      .then((payload) => {
        if (payload?.csrfToken) setCsrfTokenValue(payload.csrfToken);
      })
      .catch(() => undefined);
  }, [csrfToken]);

  useEffect(() => {
    if (!entities.length) {
      setSelectedEntityId(null);
      return;
    }

    if (!selectedEntityId || !entities.some((entity) => entity.id === selectedEntityId)) {
      setSelectedEntityId(entities[0].id);
    }
  }, [entities, selectedEntityId]);

  useEffect(() => {
    if (!selectedEntity) {
      setRecordDraft({});
      return;
    }

    setJsonRowsText(buildJsonTemplate(selectedEntity));

    if (!selectedRecord) {
      setRecordDraft(
        Object.fromEntries(
          selectedEntity.fields.map((field) => [field.name, normalizeInputValue(field.defaultValue ?? '', field.type)]),
        ),
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
    void loadRecords(selectedEntity.slug);
  }, [selectedEntity?.slug]);

  async function loadRecords(entitySlug: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ecommpanel/data-studio/entities/${encodeURIComponent(entitySlug)}/records?limit=200`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as RecordsResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar os registros.');
      }

      const nextRecords = payload?.records || [];
      setRecords(nextRecords);
      setSelectedRecordId((current) => (current && nextRecords.some((record) => String(record.id || '') === current) ? current : String(nextRecords[0]?.id || '') || null));
      setLastSyncAt(new Date().toISOString());
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao carregar registros.');
    } finally {
      setLoading(false);
    }
  }

  async function saveRecord() {
    if (!selectedEntity || !csrfTokenValue) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const record = Object.fromEntries(
        selectedEntity.fields.map((field) => [field.name, parseFieldValue(field.type, recordDraft[field.name] || '')]),
      );
      const isEditing = Boolean(selectedRecordId);
      const endpoint = isEditing
        ? `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records/${encodeURIComponent(selectedRecordId!)}`
        : `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records`;
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfTokenValue,
        },
        body: JSON.stringify({ record }),
      });
      const payload = (await response.json().catch(() => null)) as RecordResponse | null;
      if (!response.ok || !payload?.record) {
        throw new Error(payload?.error || 'Não foi possível salvar o registro.');
      }

      setSelectedRecordId(String(payload.record.id || ''));
      await loadRecords(selectedEntity.slug);
      setSuccess(isEditing ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.');
      setIsEditorOpen(false);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar o registro.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedRecord() {
    if (!selectedEntity || !selectedRecordId || !csrfTokenValue) return;
    const confirmed = window.confirm('Remover este registro da entidade selecionada?');
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/ecommpanel/data-studio/entities/${encodeURIComponent(selectedEntity.slug)}/records/${encodeURIComponent(selectedRecordId)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            'x-csrf-token': csrfTokenValue,
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível remover o registro.');
      }

      setSelectedRecordId(null);
      await loadRecords(selectedEntity.slug);
      setSuccess('Registro removido com sucesso.');
      setIsEditorOpen(false);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao remover o registro.');
    } finally {
      setSaving(false);
    }
  }

  async function importJsonRows() {
    if (!selectedEntity || !csrfTokenValue) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const rows = JSON.parse(jsonRowsText) as unknown;
      if (!Array.isArray(rows)) throw new Error('O JSON precisa ser uma lista de objetos.');

      const response = await fetch('/api/ecommpanel/data-studio', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfTokenValue,
        },
        body: JSON.stringify({
          action: 'importRows',
          entityId: selectedEntity.id,
          sourceLabel: 'records-workspace-json',
          rows,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível importar os registros.');
      }

      await loadRecords(selectedEntity.slug);
      setSuccess(`Entidade ${selectedEntity.label} populada com sucesso via JSON.`);
      setIsImportOpen(false);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao importar o JSON.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedEntity) {
    return (
      <article className="panel-card panel-records-empty-state">
        <div className="panel-records-empty-state__hero">
          <div className="panel-records-empty-state__icon" aria-hidden="true" />
          <strong>Nenhuma entidade disponível</strong>
          <p className="panel-muted">Modele ao menos uma entidade antes de operar registros, editar conteúdo ou popular dados no painel.</p>
          <button
            type="button"
            className="panel-btn panel-btn-primary"
            onClick={() => router.push('/ecommpanel/admin/data?module=modeling&create=1')}
          >
            + Criar primeira entidade
          </button>
        </div>
        <div className="panel-records-empty-state__tips">
          <article className="panel-card panel-card-subtle">
            <strong>O que são entidades?</strong>
            <p className="panel-muted">Entidades representam tabelas e coleções operacionais do sistema. Depois de modeladas, você pode listar, editar e integrar registros.</p>
          </article>
          <article className="panel-card panel-card-subtle">
            <strong>Como começar?</strong>
            <p className="panel-muted">Crie a entidade no módulo de modelagem e depois volte a este workspace para operar os dados em tabela e modais compactos.</p>
          </article>
        </div>
      </article>
    );
  }

  return (
    <div className="panel-grid panel-data-records-workspace">
      <PanelPageHeader
        eyebrow="Entidades & Dados"
        title="Registros por entidade"
        description="Selecione a entidade ativa, leia os registros em tabela e abra a edição só quando precisar alterar o conteúdo."
        actions={
          <div className="panel-inline panel-inline-wrap">
            <label className="panel-field panel-field--toolbar">
              <span>Entidade</span>
              <select
                className="panel-select"
                value={selectedEntityId || ''}
                onChange={(event) => setSelectedEntityId(event.target.value || null)}
                disabled={!entities.length}
              >
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.label} ({entity.tableName})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => loadRecords(selectedEntity.slug)} disabled={loading}>
              Recarregar
            </button>
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => {
                setSelectedRecordId(null);
                setSuccess(null);
                setError(null);
                setIsEditorOpen(true);
              }}
            >
              Novo registro
            </button>
            <button type="button" className="panel-btn panel-btn-primary panel-btn-sm" onClick={() => setIsImportOpen(true)}>
              + Popular entidade
            </button>
          </div>
        }
        meta={
          <div className="panel-inline panel-inline-wrap">
            <span className="panel-link-chip">{selectedEntity.tableName}</span>
            <span className="panel-link-chip">{selectedEntity.status === 'ready' ? 'pronta' : 'rascunho'}</span>
            <span className="panel-link-chip">{formatInteger(records.length)} registros</span>
            <span className="panel-link-chip">sync {formatDateTime(lastSyncAt || undefined)}</span>
          </div>
        }
      />

      {(error || success) && (
        <div className={`panel-feedback ${error ? 'panel-feedback-error' : 'panel-feedback-success'}`}>{error || success}</div>
      )}

      <article className="panel-card">
        <div className="panel-section-heading">
          <div>
            <h3>Leitura rápida dos registros</h3>
            <p className="panel-muted">Tabela compacta para revisar o que já foi cadastrado e abrir a edição do conteúdo.</p>
          </div>
        </div>
        <div className="panel-data-records-table">
          <div className="panel-data-records-table__head">
            <span>ID</span>
            {visibleFields.map((field) => (
              <span key={field.id}>{field.label}</span>
            ))}
            <span>Atualização</span>
            <span>Ações</span>
          </div>
          {records.map((record) => {
            const recordId = String(record.id || '');
            return (
              <div key={recordId} className={`panel-data-records-row ${selectedRecordId === recordId ? 'is-active' : ''}`}>
                <span className="panel-data-records-row__id">{recordId}</span>
                {visibleFields.map((field) => (
                  <span key={field.id} className="panel-data-records-row__cell">
                    {String(record[field.name] ?? '-')}
                  </span>
                ))}
                <span className="panel-data-records-row__cell">
                  {formatDateTime(typeof record.updated_at === 'string' ? record.updated_at : typeof record.created_at === 'string' ? record.created_at : undefined)}
                </span>
                <div className="panel-actions panel-data-inline-actions">
                  <button
                    type="button"
                    className="panel-btn panel-btn-secondary panel-btn-xs panel-table-action is-primary"
                    onClick={() => {
                      setSelectedRecordId(recordId);
                      setIsEditorOpen(true);
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
          {!records.length && !loading ? (
            <div className="panel-data-records-empty">
              <strong>Nenhum registro disponível</strong>
              <small>Use o editor abaixo ou a carga JSON para popular esta entidade.</small>
            </div>
          ) : null}
          {loading ? (
            <div className="panel-data-records-empty">
              <strong>Carregando registros...</strong>
              <small>O painel está consultando a entidade selecionada.</small>
            </div>
          ) : null}
        </div>
      </article>

      <PanelModal
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={selectedRecordId ? 'Editar registro' : 'Novo registro'}
        description={`Os campos abaixo seguem o schema modelado para ${selectedEntity.label}.`}
        size="xl"
        footer={
          <div className="panel-actions">
            {selectedRecordId ? (
              <button type="button" className="panel-btn panel-btn-danger" onClick={deleteSelectedRecord} disabled={saving || !canManageRecords}>
                Excluir registro
              </button>
            ) : null}
            <button type="button" className="panel-btn panel-btn-primary" onClick={saveRecord} disabled={saving || !canManageRecords}>
              {saving ? 'Salvando...' : selectedRecordId ? 'Salvar alterações' : 'Criar registro'}
            </button>
          </div>
        }
      >
        <div className="panel-form-grid panel-form-grid--two">
          {selectedEntity.fields.map((field) => (
            <label key={field.id} className={`panel-field ${field.type === 'json' || field.type === 'rich_text' ? 'panel-field--span-2' : ''}`}>
              <span>{field.label}</span>
              {field.type === 'boolean' ? (
                <select
                  className="panel-select"
                  value={recordDraft[field.name] || ''}
                  onChange={(event) => setRecordDraft((current) => ({ ...current, [field.name]: event.target.value }))}
                  disabled={!canManageRecords}
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
                  disabled={!canManageRecords}
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
                  disabled={!canManageRecords}
                />
              )}
              <small className="panel-muted">{field.name} · {field.type}</small>
            </label>
          ))}
        </div>
      </PanelModal>

      <PanelModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Popular entidade por JSON"
        description={`Use um array JSON alinhado ao schema de ${selectedEntity.label} para carga rápida.`}
        size="lg"
        footer={
          <div className="panel-actions">
            <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setJsonRowsText(buildJsonTemplate(selectedEntity))}>
              Gerar exemplo do schema
            </button>
            <button type="button" className="panel-btn panel-btn-primary" onClick={importJsonRows} disabled={saving || !canManageRecords}>
              {saving ? 'Importando...' : 'Importar JSON nesta entidade'}
            </button>
          </div>
        }
      >
        <textarea
          className="panel-textarea panel-data-codearea"
          value={jsonRowsText}
          onChange={(event) => setJsonRowsText(event.target.value)}
          disabled={!canManageRecords}
        />
        <div className="panel-data-connection-status">
          <strong>Feedback de população</strong>
          <small>Depois da importação, a listagem acima é recarregada para mostrar imediatamente os registros inseridos.</small>
        </div>
      </PanelModal>
    </div>
  );
}
