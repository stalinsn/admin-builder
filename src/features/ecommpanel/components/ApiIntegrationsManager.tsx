'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  API_INTEGRATION_SCOPES,
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

const SCOPE_COPY: Record<
  ApiIntegrationScope,
  {
    label: string;
    description: string;
    availability: 'active' | 'reserved';
  }
> = {
  'catalog.read': {
    label: 'Catálogo',
    description: 'Produtos, categorias e coleções para apps, headless e parceiros.',
    availability: 'active',
  },
  'content.read': {
    label: 'Conteúdo',
    description: 'Páginas dinâmicas e blog publicados para apps e integrações externas.',
    availability: 'active',
  },
  'logistics.read': {
    label: 'Logística',
    description: 'Simulação de prazo, cobertura, retirada e malha operacional para apps e parceiros.',
    availability: 'active',
  },
  'health.read': {
    label: 'Health',
    description: 'Snapshot de saúde do ecossistema para monitoramento autenticado.',
    availability: 'active',
  },
  'orders.public.read': {
    label: 'Pedidos públicos',
    description: 'Consulta de rastreio por token público em contexto autenticado.',
    availability: 'active',
  },
  'customers.read': {
    label: 'Clientes',
    description: 'Reservado para integrações futuras de CRM e app autenticado.',
    availability: 'reserved',
  },
  'data.records.read': {
    label: 'Registros modelados',
    description: 'Leitura de contratos, entidades modeladas e registros do Data Studio para apps externos.',
    availability: 'active',
  },
  'data.records.write': {
    label: 'Escrita de registros',
    description: 'Criação, atualização e remoção autenticada de registros modelados via API de integração.',
    availability: 'active',
  },
};

function buildEmptyForm(): ClientFormState {
  return {
    name: '',
    description: '',
    scopes: ['catalog.read'],
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

export default function ApiIntegrationsManager({
  initialClients,
  initialLogs,
  referenceItems,
  canManage,
}: ApiIntegrationsManagerProps) {
  const [csrfToken, setCsrfToken] = useState('');
  const [clients, setClients] = useState<ApiClientRecord[]>(initialClients);
  const [logs, setLogs] = useState<ApiRequestLogItem[]>(initialLogs);
  const [form, setForm] = useState<ClientFormState>(buildEmptyForm());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClients[0]?.id || null);
  const [logClientFilter, setLogClientFilter] = useState<string>('all');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ keyId: string; value: string } | null>(null);

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
      setForm((current) => (current.clientId ? buildEmptyForm() : current));
      return;
    }
    const selected = clients.find((item) => item.id === selectedClientId);
    if (selected) setForm(mapClientToForm(selected));
  }, [clients, selectedClientId]);

  const stats = useMemo(() => {
    const activeClients = clients.filter((client) => client.active).length;
    const reservedScopes = API_INTEGRATION_SCOPES.filter((scope) => SCOPE_COPY[scope].availability === 'reserved').length;
    return {
      totalClients: clients.length,
      activeClients,
      totalLogs: logs.length,
      totalRoutes: referenceItems.length,
      reservedScopes,
    };
  }, [clients, logs.length, referenceItems.length]);

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === (selectedClientId || form.clientId)) || null,
    [clients, form.clientId, selectedClientId],
  );

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
    setForm(buildEmptyForm());
    setError(null);
    setSuccess(null);
    setRevealedSecret(null);
  }

  return (
    <section className="panel-grid" aria-labelledby="api-integrations-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">APIs e integrações</p>
        <h1 id="api-integrations-title">Controle de acesso da camada headless</h1>
        <p className="panel-muted">
          Gere clientes de API, distribua escopos por domínio, rotacione segredos, acompanhe chamadas autenticadas e documente o contrato usado por apps e integrações externas.
        </p>
        <div className="panel-catalog-architecture">
          <div>
            <strong>Separação de superfícies</strong>
            <span>`/api/v1` continua pública e cacheável. `/api/integration/v1` exige autenticação e deixa trilha operacional.</span>
          </div>
          <div>
            <strong>Fluxo recomendado</strong>
            <span>Key ID + secret emitem um bearer token temporário. As requisições seguintes usam somente o token.</span>
          </div>
        </div>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Clientes de API</span>
          <strong>{stats.totalClients}</strong>
          <span>{stats.activeClients} ativos</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Rotas autenticadas</span>
          <strong>{stats.totalRoutes}</strong>
          <span>Contrato disponível para integração</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Logs recentes</span>
          <strong>{stats.totalLogs}</strong>
          <span>Últimas chamadas rastreadas</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Escopos reservados</span>
          <strong>{stats.reservedScopes}</strong>
          <span>Preparados para módulos futuros</span>
        </article>
      </div>

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

      {revealedSecret ? (
        <article className="panel-card panel-feedback panel-feedback-warning">
          <strong>Secret disponível uma única vez</strong>
          <span>
            Key ID: <code>{revealedSecret.keyId}</code>
          </span>
          <span>
            Secret: <code>{revealedSecret.value}</code>
          </span>
        </article>
      ) : null}

      <div className="panel-dashboard-layout">
        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>{form.clientId ? 'Editar cliente de API' : 'Novo cliente de API'}</h2>
              <p className="panel-muted">Distribua escopos por domínio, limite IPs quando fizer sentido e defina se a credencial expira.</p>
            </div>
            <button type="button" className="panel-button panel-button-secondary" onClick={handleCreateNew}>
              Novo cliente
            </button>
          </div>

          <form className="panel-form" onSubmit={handleSubmit}>
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
                {API_INTEGRATION_SCOPES.map((scope) => {
                  const copy = SCOPE_COPY[scope];
                  const checked = form.scopes.includes(scope);
                  return (
                    <label key={scope} className={`panel-api-scope-card ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            scopes: event.target.checked
                              ? Array.from(new Set([...current.scopes, scope]))
                              : current.scopes.filter((entry) => entry !== scope),
                          }))
                        }
                        disabled={!canManage}
                      />
                      <div>
                        <strong>{copy.label}</strong>
                        <span>{copy.description}</span>
                        <small>
                          <code>{scope}</code>
                          {copy.availability === 'reserved' ? ' • reservado' : ' • disponível agora'}
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

            <div className="panel-form-actions">
              <button type="submit" className="panel-button" disabled={!canManage || saving}>
                {saving ? 'Salvando...' : form.clientId ? 'Salvar cliente' : 'Criar cliente'}
              </button>
              {selectedClient ? (
                <button
                  type="button"
                  className="panel-button panel-button-secondary"
                  onClick={() => void handleRotateSecret()}
                  disabled={!canManage || rotatingSecret}
                >
                  {rotatingSecret ? 'Rotacionando...' : 'Rotacionar secret'}
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Clientes cadastrados</h2>
              <p className="panel-muted">Selecione uma credencial para editar ou revisar o último uso.</p>
            </div>
          </div>
          <div className="panel-table-wrap">
            <table className="panel-table">
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
                        <strong>{client.name}</strong>
                        <div className="panel-table-muted">
                          <code>{client.keyId}</code>
                          {client.secretHint ? ` • termina em ${client.secretHint}` : ''}
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
                          className="panel-button panel-button-secondary"
                          onClick={() => setSelectedClientId(client.id)}
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
      </div>

      <div className="panel-dashboard-layout">
        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Referência da API de integração</h2>
              <p className="panel-muted">Contrato autenticado atualmente disponível para apps, middlewares e parceiros técnicos.</p>
            </div>
          </div>
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Rota</th>
                  <th>Domínio</th>
                  <th>Escopo</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {referenceItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.method}</td>
                    <td>
                      <code>{item.route}</code>
                    </td>
                    <td>{item.domain}</td>
                    <td>{item.scope || 'token válido'}</td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-toolbar">
            <div className="panel-toolbar__top">
              <div className="panel-toolbar__copy">
                <h2>Logs de acesso</h2>
                <p className="panel-muted">Chamadas autenticadas por chave ou token começam a formar a trilha de auditoria da camada headless.</p>
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
          </div>

          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Rota</th>
                  <th>Status</th>
                  <th>Autenticação</th>
                  <th>Escopo</th>
                  <th>Cliente</th>
                </tr>
              </thead>
              <tbody>
                {logs.length ? (
                  logs.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>
                        <strong>{item.method}</strong> <code>{item.route}</code>
                      </td>
                      <td>{item.statusCode}</td>
                      <td>{item.authMode}</td>
                      <td>{item.scope || '-'}</td>
                      <td>{item.keyId || item.clientId || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="panel-table-empty">
                      {loadingLogs ? 'Carregando logs...' : 'Nenhuma chamada registrada ainda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
