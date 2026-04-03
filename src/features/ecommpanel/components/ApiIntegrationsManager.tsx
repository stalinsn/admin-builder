'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PanelModal from '@/features/ecommpanel/components/PanelModal';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';
import type { DataFieldDefinition } from '@/features/ecommpanel/types/dataStudio';

import {
  type ApiIntegrationScopeOption,
  type ApiIntegrationScope,
  type ApiReferenceItem,
} from '@/features/public-api/integration';

type ApiClientRecord = {
  id: string;
  keyId: string;
  name: string;
  description?: string;
  scopes: ApiIntegrationScope[];
  allowedIps: string[];
  active: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  secretHint?: string;
};

type ApiRequestLogItem = {
  id: string;
  clientId?: string;
  keyId?: string;
  route: string;
  method: string;
  statusCode: number;
  scope?: string;
  authMode: string;
  createdAt: string;
};

type ApiClientResponse = {
  client?: ApiClientRecord;
  secret?: {
    keyId: string;
    value: string;
  };
  error?: string;
};

type ApiClientsResponse = {
  clients?: ApiClientRecord[];
  error?: string;
};

type ApiLogsResponse = {
  logs?: ApiRequestLogItem[];
  error?: string;
};

type MeResponse = {
  csrfToken?: string;
};

type ApiIntegrationsManagerProps = {
  initialClients: ApiClientRecord[];
  initialLogs: ApiRequestLogItem[];
  referenceItems: ApiReferenceItem[];
  entityFieldsBySlug: Record<string, DataFieldDefinition[]>;
  availableScopes: ApiIntegrationScopeOption[];
  canManage: boolean;
};

type ClientFormState = {
  clientId?: string;
  name: string;
  description: string;
  scopes: ApiIntegrationScope[];
  allowedIpsText: string;
  active: boolean;
  expiresAt: string;
};

type IntegrationView = 'keys' | 'scopes' | 'reference' | 'logs';

function buildEmptyForm(availableScopes: ApiIntegrationScope[]): ClientFormState {
  return {
    name: '',
    description: '',
    scopes: availableScopes.includes('data.records.read') ? ['data.records.read'] : availableScopes.slice(0, 1),
    allowedIpsText: '',
    active: true,
    expiresAt: '',
  };
}

function toDatetimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function mapClientToForm(client: ApiClientRecord): ClientFormState {
  return {
    clientId: client.id,
    name: client.name,
    description: client.description || '',
    scopes: client.scopes,
    allowedIpsText: client.allowedIps.join('\n'),
    active: client.active,
    expiresAt: toDatetimeInput(client.expiresAt),
  };
}

function buildCurlCommand(method: string, route: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const lines = [`curl -X ${method.toUpperCase()} '${origin}${route}'`, "  -H 'Authorization: Bearer <TOKEN>'"];

  if (method.toUpperCase() !== 'GET') {
    lines.push("  -H 'Content-Type: application/json'");
  }

  if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
    lines.push("  -d '{\"example\":\"value\"}'");
  }

  return lines.join(' \\\n');
}

function resolveExampleValue(field: DataFieldDefinition): unknown {
  switch (field.type) {
    case 'slug':
      return `example-${field.name}`;
    case 'email':
      return 'player@example.com';
    case 'url':
      return 'https://example.com/resource';
    case 'integer':
      return 1;
    case 'number':
    case 'currency':
      return 1.5;
    case 'boolean':
      return true;
    case 'date':
      return '2026-04-03';
    case 'datetime':
      return '2026-04-03T12:00:00.000Z';
    case 'json':
      return { example: true };
    case 'reference':
      return '<REFERENCE_ID>';
    case 'rich_text':
      return `Conteudo de ${field.label}`;
    case 'text':
    default:
      return `Exemplo de ${field.label}`;
  }
}

function buildExamplePayload(fields: DataFieldDefinition[]): string {
  const payload = Object.fromEntries(
    fields.map((field) => [field.name, field.defaultValue || resolveExampleValue(field)]),
  );
  return JSON.stringify(payload, null, 2);
}

function resolveEntitySlugFromRoute(route: string): string | null {
  const routeMatch = route.match(/\/entities\/([^/]+)\/records/);
  return routeMatch?.[1] || null;
}

export default function ApiIntegrationsManager({
  initialClients,
  initialLogs,
  referenceItems,
  entityFieldsBySlug,
  availableScopes,
  canManage,
}: ApiIntegrationsManagerProps) {
  const searchParams = useSearchParams();
  const scopeIds = useMemo(() => availableScopes.map((scope) => scope.scope), [availableScopes]);
  const [csrfToken, setCsrfToken] = useState('');
  const [clients, setClients] = useState<ApiClientRecord[]>(initialClients);
  const [logs, setLogs] = useState<ApiRequestLogItem[]>(initialLogs);
  const [form, setForm] = useState<ClientFormState>(buildEmptyForm(scopeIds));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClients[0]?.id || null);
  const [logClientFilter, setLogClientFilter] = useState<string>('all');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [scopeQuery, setScopeQuery] = useState('');
  const [scopeEntityFilter, setScopeEntityFilter] = useState<string>('all');
  const [referenceQuery, setReferenceQuery] = useState('');
  const [referenceDomainFilter, setReferenceDomainFilter] = useState<'all' | 'system' | 'data' | 'entity'>('all');
  const [copiedReferenceId, setCopiedReferenceId] = useState<string | null>(null);
  const [copiedReferencePayloadId, setCopiedReferencePayloadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ keyId: string; value: string } | null>(null);
  const activeView = (searchParams.get('view') as IntegrationView | null) || 'keys';

  useEffect(() => {
    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar o token CSRF.');
        return response.json() as Promise<MeResponse>;
      })
      .then((payload) => {
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setForm((current) => (current.clientId ? buildEmptyForm(scopeIds) : current));
      return;
    }
    const selected = clients.find((item) => item.id === selectedClientId);
    if (selected) setForm(mapClientToForm(selected));
  }, [clients, selectedClientId, scopeIds]);

  const stats = useMemo(() => {
    const activeClients = clients.filter((client) => client.active).length;
    const reservedScopes = availableScopes.filter((scope) => scope.availability === 'reserved').length;
    const entityScopes = availableScopes.filter((scope) => scope.group === 'entity').length;
    return {
      totalClients: clients.length,
      activeClients,
      totalLogs: logs.length,
      totalRoutes: referenceItems.length,
      reservedScopes,
      entityScopes,
    };
  }, [availableScopes, clients, logs.length, referenceItems.length]);

  async function copyReferenceCurl(item: ApiReferenceItem) {
    try {
      await navigator.clipboard.writeText(buildCurlCommand(item.method, item.route));
      setCopiedReferenceId(item.id);
      window.setTimeout(() => {
        setCopiedReferenceId((current) => (current === item.id ? null : current));
      }, 1600);
    } catch {
      setCopiedReferenceId(null);
    }
  }

  async function copyReferencePayload(item: ApiReferenceItem) {
    const entitySlug = resolveEntitySlugFromRoute(item.route);
    if (!entitySlug) return;
    const fields = entityFieldsBySlug[entitySlug];
    if (!fields?.length) return;

    try {
      await navigator.clipboard.writeText(buildExamplePayload(fields));
      setCopiedReferencePayloadId(item.id);
      window.setTimeout(() => {
        setCopiedReferencePayloadId((current) => (current === item.id ? null : current));
      }, 1600);
    } catch {
      setCopiedReferencePayloadId(null);
    }
  }

  const entityScopes = useMemo(
    () => availableScopes.filter((scope) => scope.group === 'entity'),
    [availableScopes],
  );

  const filteredEntityScopes = useMemo(() => {
    const query = scopeQuery.trim().toLowerCase();

    return entityScopes.filter((scope) => {
      if (scopeEntityFilter !== 'all' && scope.entitySlug !== scopeEntityFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [scope.label, scope.description, scope.scope, scope.entitySlug || '']
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [entityScopes, scopeEntityFilter, scopeQuery]);

  const scopeEntityOptions = useMemo(() => {
    return Array.from(
      new Map(entityScopes.filter((scope) => scope.entitySlug).map((scope) => [scope.entitySlug!, scope.label.replace(/: leitura|: escrita/g, '')])).entries(),
    ).map(([slug, label]) => ({ slug, label }));
  }, [entityScopes]);

  const focusIds: Record<IntegrationView, string> = {
    keys: 'panel-integrations-clients',
    scopes: 'panel-integrations-scopes',
    reference: 'panel-integrations-reference',
    logs: 'panel-integrations-logs',
  };

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === (selectedClientId || form.clientId)) || null,
    [clients, form.clientId, selectedClientId],
  );

  const referenceStats = useMemo(() => {
    return {
      system: referenceItems.filter((item) => item.domain === 'system').length,
      data: referenceItems.filter((item) => item.domain === 'data').length,
      entity: referenceItems.filter((item) => item.domain === 'entity').length,
    };
  }, [referenceItems]);

  const filteredReferenceItems = useMemo(() => {
    const query = referenceQuery.trim().toLowerCase();

    return referenceItems.filter((item) => {
      if (referenceDomainFilter !== 'all' && item.domain !== referenceDomainFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [item.method, item.route, item.description, item.domain, item.scope || 'token valido']
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [referenceDomainFilter, referenceItems, referenceQuery]);

  async function loadClients() {
    const response = await fetch('/api/ecommpanel/integrations/clients', { cache: 'no-store', credentials: 'same-origin' });
    const payload = (await response.json().catch(() => null)) as ApiClientsResponse | null;
    if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os clientes de API.');
    setClients(payload?.clients || []);
  }

  async function loadLogs(nextClientId?: string) {
    setLoadingLogs(true);
    try {
      const search = new URLSearchParams();
      search.set('limit', '60');
      if (nextClientId && nextClientId !== 'all') search.set('clientId', nextClientId);
      const response = await fetch(`/api/ecommpanel/integrations/logs?${search.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as ApiLogsResponse | null;
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os logs de integração.');
      setLogs(payload?.logs || []);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setRevealedSecret(null);

    try {
      const endpoint = form.clientId
        ? `/api/ecommpanel/integrations/clients/${encodeURIComponent(form.clientId)}`
        : '/api/ecommpanel/integrations/clients';
      const method = form.clientId ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          client: {
            name: form.name,
            description: form.description,
            scopes: form.scopes,
            active: form.active,
            allowedIpsText: form.allowedIpsText,
            expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiClientResponse | null;
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar o cliente de API.');

      await loadClients();
      await loadLogs(logClientFilter);
      if (payload?.client) {
        setSelectedClientId(payload.client.id);
      }
      if (payload?.secret) {
        setRevealedSecret(payload.secret);
        setSuccess('Cliente criado. Guarde o secret agora: ele não será exibido novamente.');
      } else {
        setSuccess('Cliente de integração atualizado.');
      }
      setIsEditorOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar o cliente de integração.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateSecret() {
    if (!selectedClient || !csrfToken || rotatingSecret) return;
    setRotatingSecret(true);
    setError(null);
    setSuccess(null);
    setRevealedSecret(null);

    try {
      const response = await fetch(
        `/api/ecommpanel/integrations/clients/${encodeURIComponent(selectedClient.id)}/rotate`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'x-csrf-token': csrfToken,
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as ApiClientResponse | null;
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível rotacionar o secret.');

      await loadClients();
      await loadLogs(logClientFilter);
      if (payload?.secret) {
        setRevealedSecret(payload.secret);
      }
      setSuccess('Secret rotacionado. Atualize as integrações externas antes de descartar o valor antigo.');
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Erro ao rotacionar o secret.');
    } finally {
      setRotatingSecret(false);
    }
  }

  function handleCreateNew() {
    setSelectedClientId(null);
    setForm(buildEmptyForm(scopeIds));
    setError(null);
    setSuccess(null);
    setRevealedSecret(null);
    setIsEditorOpen(true);
  }

  return (
    <section className="panel-grid panel-manager-page panel-integrations-page" aria-labelledby="api-integrations-title">
      <PanelPageHeader
        title="API & Integrações"
        titleId="api-integrations-title"
        description="Gere chaves, emita tokens e distribua escopos por entidade para integrações externas."
        actions={
          <div className="panel-inline panel-inline-wrap">
            {canManage ? (
              <button type="button" className="panel-btn panel-btn-primary panel-btn-sm panel-manager-primary-button" onClick={handleCreateNew}>
                + Novo Token
              </button>
            ) : null}
          </div>
        }
      />

      <nav className="panel-section-tabs panel-section-tabs--integrations" aria-label="Superfícies de integração">
        <Link href="/ecommpanel/admin/integrations?view=keys" className={`panel-section-tab ${activeView === 'keys' ? 'is-active' : ''}`}>
          Chaves & Tokens
        </Link>
        <Link href="/ecommpanel/admin/integrations?view=scopes" className={`panel-section-tab ${activeView === 'scopes' ? 'is-active' : ''}`}>
          Escopos por Entidade
        </Link>
        <Link href="/ecommpanel/admin/integrations?view=reference" className={`panel-section-tab ${activeView === 'reference' ? 'is-active' : ''}`}>
          Referência
        </Link>
        <Link href="/ecommpanel/admin/integrations?view=logs" className={`panel-section-tab ${activeView === 'logs' ? 'is-active' : ''}`}>
          Logs de Acesso
        </Link>
      </nav>

      <div className="panel-manager-feature-grid panel-manager-feature-grid--three">
        <article className={`panel-manager-feature-card panel-manager-feature-card--blue ${activeView === 'keys' ? 'is-focused' : ''}`}>
          <div className="panel-manager-feature-card__icon" aria-hidden="true" />
          <div>
            <h2>Clientes de API</h2>
            <p>Use credenciais e escopos para controlar o acesso à base.</p>
            <strong>{stats.totalClients}</strong>
            <small>{stats.activeClients} ativos</small>
          </div>
        </article>
        <article className={`panel-manager-feature-card panel-manager-feature-card--green ${activeView === 'scopes' ? 'is-focused' : ''}`}>
          <div className="panel-manager-feature-card__icon" aria-hidden="true" />
          <div>
            <h2>Integrações autenticadas</h2>
            <p>Rotas com token e escopos dinâmicos por entidade.</p>
            <strong>{stats.totalRoutes}</strong>
            <small>{stats.entityScopes} escopos por entidade</small>
          </div>
        </article>
        <article className={`panel-manager-feature-card panel-manager-feature-card--purple ${activeView === 'reference' || activeView === 'logs' ? 'is-focused' : ''}`}>
          <div className="panel-manager-feature-card__icon" aria-hidden="true" />
          <div>
            <h2>Documentação viva</h2>
            <p>Contratos e logs prontos para integrar apps externos.</p>
            <strong>{stats.totalLogs}</strong>
            <small>{stats.reservedScopes} escopos reservados</small>
          </div>
        </article>
      </div>

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

      <div className="panel-integrations-layout">
        <div className="panel-integrations-layout__main">
          {revealedSecret ? (
            <article className="panel-card panel-feedback panel-feedback-warning panel-integrations-secret-card">
              <strong>Secret disponível uma única vez</strong>
              <span>
                Key ID: <code>{revealedSecret.keyId}</code>
              </span>
              <span>
                Secret: <code>{revealedSecret.value}</code>
              </span>
            </article>
          ) : null}

          <article id={focusIds.keys} className={`panel-manager-card panel-manager-card--clients ${activeView === 'keys' ? 'is-focused' : ''}`}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Clientes cadastrados</h2>
                <p className="panel-muted">Selecione uma credencial para editar, rotacionar o secret ou reaproveitar os scopes de entidades já modeladas.</p>
              </div>
            </div>
            <div className="panel-table-wrap">
              <table className="panel-table panel-manager-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Escopos</th>
                    <th>Status</th>
                    <th>Último uso</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length ? (
                    clients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div className="panel-api-client-cell">
                            <strong>{client.name}</strong>
                            <div className="panel-table-muted">
                              <code>{client.keyId}</code>
                              {client.secretHint ? ` • termina em ${client.secretHint}` : ''}
                            </div>
                          </div>
                        </td>
                        <td>{client.scopes.join(', ') || '-'}</td>
                        <td>
                          <span className={`panel-badge ${client.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                            {client.active ? 'ativo' : 'inativo'}
                          </span>
                        </td>
                        <td>{formatDateTime(client.lastUsedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="panel-btn panel-btn-secondary panel-btn-sm"
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setIsEditorOpen(true);
                            }}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="panel-table-empty">
                        Nenhum cliente de API cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id={focusIds.scopes} className={`panel-manager-card ${activeView === 'scopes' ? 'is-focused' : ''}`}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Escopos por entidade</h2>
                <p className="panel-muted">Toda entidade criada no painel gera scopes de leitura e escrita para a camada de integração.</p>
              </div>
              <span className="panel-link-chip">{entityScopes.length} disponíveis</span>
            </div>
            <div className="panel-api-reference-toolbar">
              <label className="panel-search panel-manager-search">
                <span className="panel-search__icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={scopeQuery}
                  onChange={(event) => setScopeQuery(event.target.value)}
                  placeholder="Buscar por entidade, scope ou descrição"
                />
              </label>
              <div className="panel-filter-row">
                <button
                  type="button"
                  className={`panel-filter-chip ${scopeEntityFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setScopeEntityFilter('all')}
                >
                  Todas ({entityScopes.length})
                </button>
                {scopeEntityOptions.map((option) => (
                  <button
                    key={option.slug}
                    type="button"
                    className={`panel-filter-chip ${scopeEntityFilter === option.slug ? 'is-active' : ''}`}
                    onClick={() => setScopeEntityFilter(option.slug)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-api-scope-summary">
              {filteredEntityScopes.length ? (
                filteredEntityScopes.map((scope) => (
                  <article key={scope.scope} className="panel-api-scope-summary__item">
                    <strong>{scope.label}</strong>
                    <span>{scope.description}</span>
                    <small>
                      <code>{scope.scope}</code>
                    </small>
                  </article>
                ))
              ) : (
                <div className="panel-table-empty panel-table-empty--card">
                  {entityScopes.length
                    ? 'Nenhum escopo encontrado com esse filtro.'
                    : 'Nenhuma entidade modelada ainda. Assim que você criar uma entidade, os scopes `read` e `write` aparecem aqui.'}
                </div>
              )}
            </div>
          </article>

          <article id={focusIds.reference} className={`panel-manager-card ${activeView === 'reference' ? 'is-focused' : ''}`}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Referência da API de Integração</h2>
                <p className="panel-muted">Endpoints disponíveis para integração externa.</p>
              </div>
              <a href="/api/integration/v1/data/contracts" target="_blank" rel="noreferrer" className="panel-link-chip">
                Documentação
              </a>
            </div>
            <div className="panel-api-reference-toolbar">
              <label className="panel-search panel-manager-search">
                <span className="panel-search__icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={referenceQuery}
                  onChange={(event) => setReferenceQuery(event.target.value)}
                  placeholder="Buscar por rota, método, scope ou descrição"
                />
              </label>
              <div className="panel-filter-row">
                <button
                  type="button"
                  className={`panel-filter-chip ${referenceDomainFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setReferenceDomainFilter('all')}
                >
                  Tudo ({referenceItems.length})
                </button>
                <button
                  type="button"
                  className={`panel-filter-chip ${referenceDomainFilter === 'system' ? 'is-active' : ''}`}
                  onClick={() => setReferenceDomainFilter('system')}
                >
                  Sistema ({referenceStats.system})
                </button>
                <button
                  type="button"
                  className={`panel-filter-chip ${referenceDomainFilter === 'data' ? 'is-active' : ''}`}
                  onClick={() => setReferenceDomainFilter('data')}
                >
                  Dados ({referenceStats.data})
                </button>
                <button
                  type="button"
                  className={`panel-filter-chip ${referenceDomainFilter === 'entity' ? 'is-active' : ''}`}
                  onClick={() => setReferenceDomainFilter('entity')}
                >
                  Entidades ({referenceStats.entity})
                </button>
              </div>
            </div>
            <div className="panel-api-reference-list">
              {filteredReferenceItems.length ? filteredReferenceItems.map((item) => (
                <div key={item.id} className="panel-api-reference-list__item">
                  <div className="panel-api-reference-list__meta">
                    <span className={`panel-badge ${item.method === 'GET' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>{item.method}</span>
                    <code>{item.route}</code>
                    <button type="button" className="panel-api-reference-list__copy-btn" onClick={() => void copyReferenceCurl(item)}>
                      {copiedReferenceId === item.id ? 'Copiado' : 'Copiar curl'}
                    </button>
                    {(item.method === 'POST' || item.method === 'PUT') && resolveEntitySlugFromRoute(item.route) ? (
                      <button type="button" className="panel-api-reference-list__copy-btn" onClick={() => void copyReferencePayload(item)}>
                        {copiedReferencePayloadId === item.id ? 'JSON copiado' : 'Copiar JSON'}
                      </button>
                    ) : null}
                  </div>
                  <div className="panel-api-reference-list__copy">
                    <strong>{item.description}</strong>
                    <small>
                      {item.domain} · {item.scope || 'token válido'}
                    </small>
                  </div>
                </div>
              )) : (
                <div className="panel-table-empty panel-table-empty--card">
                  Nenhum endpoint encontrado com esse filtro. Tente buscar por `cards`, `records`, `GET` ou pelo nome da entidade.
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="panel-integrations-layout__side">
          <article id={focusIds.logs} className={`panel-manager-card ${activeView === 'logs' ? 'is-focused' : ''}`}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Logs de acesso</h2>
                <p className="panel-muted">Últimas chamadas à API em tempo real.</p>
              </div>
              <div className="panel-toolbar__filters">
                <select
                  className="panel-select"
                  value={logClientFilter}
                  onChange={(event) => {
                    const next = event.target.value;
                    setLogClientFilter(next);
                    void loadLogs(next);
                  }}
                >
                  <option value="all">Todos os clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="panel-table-wrap">
              <table className="panel-table panel-manager-table">
                <thead>
                  <tr>
                    <th>Rota</th>
                    <th>Status</th>
                    <th>Cliente</th>
                    <th>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length ? (
                    logs.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.method}</strong> <code>{item.route}</code>
                        </td>
                        <td>
                          <span className="panel-badge panel-badge-success">{item.statusCode}</span>
                        </td>
                        <td>{item.keyId || item.clientId || item.authMode || '-'}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="panel-table-empty">
                        {loadingLogs ? 'Carregando logs...' : 'Nenhuma chamada registrada ainda.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>

      <PanelModal
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={form.clientId ? 'Editar cliente de API' : 'Novo cliente de API'}
        description="Distribua escopos por entidade ou por domínio técnico, limite IPs quando fizer sentido e defina se a credencial expira."
        size="xl"
        footer={
          <div className="panel-actions">
            <button className="panel-btn panel-btn-primary" type="submit" form="panel-api-client-form" disabled={!canManage || saving}>
              {saving ? 'Salvando...' : form.clientId ? 'Salvar cliente' : 'Criar cliente'}
            </button>
            {selectedClient ? (
              <button
                type="button"
                className="panel-btn panel-btn-secondary"
                onClick={() => void handleRotateSecret()}
                disabled={!canManage || rotatingSecret}
              >
                {rotatingSecret ? 'Rotacionando...' : 'Rotacionar secret'}
              </button>
            ) : null}
          </div>
        }
      >
        <form className="panel-form" id="panel-api-client-form" onSubmit={handleSubmit}>
            <div className="panel-form-grid panel-form-grid--two">
              <div className="panel-field">
                <label htmlFor="api-client-name">Nome operacional</label>
                <input
                  id="api-client-name"
                  className="panel-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={!canManage}
                  placeholder="App mobile, ERP, middleware headless..."
                />
              </div>
              <div className="panel-field">
                <label htmlFor="api-client-expires">Expira em</label>
                <input
                  id="api-client-expires"
                  className="panel-input"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="panel-field">
              <label htmlFor="api-client-description">Descrição</label>
              <textarea
                id="api-client-description"
                className="panel-textarea"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                disabled={!canManage}
                rows={3}
                placeholder="Explique o contexto dessa integração e quem consome a credencial."
              />
            </div>

            <div className="panel-field">
              <span className="panel-field-label">Escopos</span>
              <div className="panel-api-scope-grid">
                {availableScopes.map((scopeOption) => {
                  const checked = form.scopes.includes(scopeOption.scope);
                  const groupLabel =
                    scopeOption.group === 'entity'
                      ? `entidade • ${scopeOption.entitySlug}`
                      : scopeOption.group === 'data'
                        ? 'dados'
                        : 'sistema';
                  return (
                    <label key={scopeOption.scope} className={`panel-api-scope-card ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            scopes: event.target.checked
                              ? Array.from(new Set([...current.scopes, scopeOption.scope]))
                              : current.scopes.filter((entry) => entry !== scopeOption.scope),
                          }))
                        }
                        disabled={!canManage}
                      />
                      <div>
                        <strong>{scopeOption.label}</strong>
                        <span>{scopeOption.description}</span>
                        <small>
                          <code>{scopeOption.scope}</code>
                          {` • ${groupLabel}`}
                          {scopeOption.availability === 'reserved' ? ' • reservado' : ' • disponível agora'}
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="panel-form-grid panel-form-grid--two">
              <div className="panel-field">
                <label htmlFor="api-client-ips">Allowlist de IPs</label>
                <textarea
                  id="api-client-ips"
                  className="panel-textarea"
                  rows={5}
                  value={form.allowedIpsText}
                  onChange={(event) => setForm((current) => ({ ...current, allowedIpsText: event.target.value }))}
                  disabled={!canManage}
                  placeholder={'31.97.247.139\n10.0.0.14'}
                />
              </div>
              <div className="panel-card panel-card-subtle">
                <strong>Fluxo de autenticação</strong>
                <ol className="panel-api-flow">
                  <li>Crie o cliente e guarde o `keyId` e o `secret`.</li>
                  <li>Troque essas credenciais por um bearer token em `POST /api/integration/v1/auth/token`.</li>
                  <li>Use o bearer token nas chamadas seguintes para rotas com escopo permitido.</li>
                </ol>
                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    disabled={!canManage}
                  />
                  <span>Cliente ativo para emissão de token</span>
                </label>
              </div>
            </div>
        </form>
      </PanelModal>
    </section>
  );
}
