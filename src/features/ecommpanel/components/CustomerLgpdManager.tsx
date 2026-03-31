'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  CustomerAdminSummary,
  CustomerLgpdExportPackage,
  CustomerLgpdRequestRecord,
  CustomerRetentionPolicyRecord,
} from '@/features/ecommerce/types/account';

type RequestsResponse = {
  requests?: CustomerLgpdRequestRecord[];
  policies?: CustomerRetentionPolicyRecord[];
  capabilities?: {
    canManageRetention?: boolean;
  };
  error?: string;
};

type ExportResponse = {
  ok?: boolean;
  data?: CustomerLgpdExportPackage;
  error?: string;
};

type ActionResponse = {
  ok?: boolean;
  request?: CustomerLgpdRequestRecord;
  error?: string;
};

type PolicyResponse = {
  ok?: boolean;
  policy?: CustomerRetentionPolicyRecord;
  error?: string;
};

type Props = {
  initialCustomers: CustomerAdminSummary[];
  initialRequests: CustomerLgpdRequestRecord[];
  initialPolicies: CustomerRetentionPolicyRecord[];
  capabilities: {
    canRequest: boolean;
    canApprove: boolean;
    canExecute: boolean;
    canManageRetention: boolean;
  };
};

type PolicyDraftMap = Record<
  string,
  {
    action: CustomerRetentionPolicyRecord['action'];
    retentionDays: number;
    legalBasis: string;
    enabled: boolean;
  }
>;

function formatDateTime(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function buildPolicyDrafts(policies: CustomerRetentionPolicyRecord[]): PolicyDraftMap {
  return Object.fromEntries(
    policies.map((policy) => [
      policy.entityKey,
      {
        action: policy.action,
        retentionDays: policy.retentionDays,
        legalBasis: policy.legalBasis,
        enabled: policy.enabled,
      },
    ]),
  );
}

export default function CustomerLgpdManager({
  initialCustomers,
  initialRequests,
  initialPolicies,
  capabilities: initialCapabilities,
}: Props) {
  const [customers] = useState(initialCustomers);
  const [requests, setRequests] = useState(initialRequests);
  const [policies, setPolicies] = useState(initialPolicies);
  const [selectedId, setSelectedId] = useState<string | null>(initialCustomers[0]?.id || null);
  const [csrfToken, setCsrfToken] = useState('');
  const [exportData, setExportData] = useState<CustomerLgpdExportPackage | null>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [acting, setActing] = useState(false);
  const [policySavingKey, setPolicySavingKey] = useState<string | null>(null);
  const [policyDrafts, setPolicyDrafts] = useState<PolicyDraftMap>(() => buildPolicyDrafts(initialPolicies));
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ecommpanel/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as { csrfToken?: string } | null;
      })
      .then((payload) => {
        if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedId) || null,
    [customers, selectedId],
  );

  const selectedRequest = useMemo(
    () =>
      requests.find(
        (request) =>
          request.accountId === selectedId &&
          request.type === 'erasure_request' &&
          request.status === 'open',
      ) || null,
    [requests, selectedId],
  );

  const stats = useMemo(
    () => ({
      openRequests: requests.filter((request) => request.status === 'open').length,
      awaitingApproval: requests.filter((request) => request.reviewStatus === 'pending_review').length,
      executable: requests.filter((request) => request.executionEligible).length,
      customersWithRequest: new Set(requests.filter((request) => request.accountId).map((request) => request.accountId)).size,
    }),
    [requests],
  );

  async function refreshDashboard() {
    const response = await fetch('/api/ecommpanel/customers/lgpd', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as RequestsResponse | null;
    if (!response.ok) return;
    setRequests(payload?.requests || []);
    if (payload?.policies) {
      setPolicies(payload.policies);
      setPolicyDrafts(buildPolicyDrafts(payload.policies));
    }
    if (payload?.capabilities?.canManageRetention !== undefined) {
      setCapabilities((current) => ({ ...current, canManageRetention: Boolean(payload.capabilities?.canManageRetention) }));
    }
  }

  async function exportCustomerData() {
    if (!selectedCustomer) return;
    setLoadingExport(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/ecommpanel/customers/${encodeURIComponent(selectedCustomer.id)}/lgpd`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as ExportResponse | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'Não foi possível exportar os dados do cliente.');
      }
      setExportData(payload.data);
      setSuccess('Pacote de exportação carregado para revisão.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Erro ao exportar os dados do cliente.');
    } finally {
      setLoadingExport(false);
    }
  }

  async function runCustomerAction(
    action: 'request-erasure' | 'approve-erasure' | 'reject-erasure' | 'execute-anonymization',
    options?: { customerId?: string; requestId?: string; notes?: string },
  ) {
    const customerId = options?.customerId || selectedCustomer?.id;
    if (!customerId || !csrfToken) return;

    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/ecommpanel/customers/${encodeURIComponent(customerId)}/lgpd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action,
          requestId: options?.requestId,
          notes: options?.notes,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ActionResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível executar a ação LGPD.');
      }
      await refreshDashboard();
      if (action === 'request-erasure') setSuccess('Solicitação de exclusão registrada na fila operacional.');
      if (action === 'approve-erasure') setSuccess('Solicitação aprovada. A conta já pode seguir para anonimização.');
      if (action === 'reject-erasure') setSuccess('Solicitação rejeitada e retirada da fila de execução.');
      if (action === 'execute-anonymization') setSuccess('Anonimização concluída com desvinculação da conta do fluxo operacional.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha na ação LGPD.');
    } finally {
      setActing(false);
    }
  }

  async function savePolicy(entityKey: string) {
    if (!csrfToken) return;
    const draft = policyDrafts[entityKey];
    if (!draft) return;
    setPolicySavingKey(entityKey);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommpanel/customers/lgpd/policies', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          entityKey,
          action: draft.action,
          retentionDays: draft.retentionDays,
          legalBasis: draft.legalBasis,
          enabled: draft.enabled,
        }),
      });
      const payload = (await response.json().catch(() => null)) as PolicyResponse | null;
      if (!response.ok || !payload?.policy) {
        throw new Error(payload?.error || 'Não foi possível salvar a política de retenção.');
      }
      setPolicies((current) => current.map((policy) => (policy.entityKey === entityKey ? payload.policy! : policy)));
      setSuccess(`Política de retenção atualizada para ${payload.policy.label}.`);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha ao salvar a política.');
    } finally {
      setPolicySavingKey(null);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="customer-lgpd-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Clientes</p>
        <h1 id="customer-lgpd-title">Centro LGPD</h1>
        <p className="panel-muted">Centralize exportação, exclusão, aprovação e retenção com trilha operacional controlada.</p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Solicitações abertas</span>
          <strong>{stats.openRequests}</strong>
          <span>Fila total de privacidade em andamento</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Aguardando aprovação</span>
          <strong>{stats.awaitingApproval}</strong>
          <span>Demandas pendentes de revisão formal</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Prontas para executar</span>
          <strong>{stats.executable}</strong>
          <span>Contas com revisão aprovada</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Clientes impactados</span>
          <strong>{stats.customersWithRequest}</strong>
          <span>Contas com trilha LGPD registrada</span>
        </article>
      </div>

      {error ? <div className="panel-feedback panel-feedback-error">{error}</div> : null}
      {success ? <div className="panel-feedback panel-feedback-success">{success}</div> : null}

      <div className="panel-dashboard-layout panel-dashboard-layout--lgpd">
        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Conta em foco</h2>
              <p className="panel-muted">Selecione uma conta para revisar o pacote exportado e o estado atual do tratamento.</p>
            </div>
          </div>
          <div className="panel-form-grid">
            <div className="panel-field">
              <label htmlFor="lgpd-customer-select">Cliente</label>
              <select
                id="lgpd-customer-select"
                className="panel-select"
                value={selectedId || ''}
                onChange={(event) => {
                  setSelectedId(event.target.value || null);
                  setExportData(null);
                }}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} • {customer.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-card panel-card-subtle">
              <strong>Governança aplicada</strong>
              <span className="panel-muted">
                Exclusão passa por revisão formal antes da execução. Pedidos podem ser retidos de forma sanitizada quando houver obrigação operacional ou legal.
              </span>
            </div>
          </div>

          <div className="panel-stats panel-stats--inside">
            <article className="panel-stat">
              <span className="panel-muted">Conta</span>
              <strong>{selectedCustomer?.name || '-'}</strong>
              <span>{selectedCustomer?.email || 'Selecione uma conta'}</span>
            </article>
            <article className="panel-stat">
              <span className="panel-muted">Solicitação aberta</span>
              <strong>{selectedRequest ? selectedRequest.type : 'Nenhuma'}</strong>
              <span>
                {selectedRequest
                  ? `${selectedRequest.reviewStatus === 'approved' ? 'Aprovada' : selectedRequest.reviewStatus === 'pending_review' ? 'Em revisão' : selectedRequest.reviewStatus} • ${formatDateTime(selectedRequest.createdAt)}`
                  : 'Sem solicitação pendente'}
              </span>
            </article>
          </div>

          <div className="panel-form-actions">
            <button type="button" className="panel-button" onClick={() => void exportCustomerData()} disabled={loadingExport}>
              {loadingExport ? 'Exportando...' : 'Exportar dados'}
            </button>
            <button
              type="button"
              className="panel-button panel-button-secondary"
              onClick={() => void runCustomerAction('request-erasure')}
              disabled={acting || !capabilities.canRequest}
            >
              Registrar solicitação
            </button>
            <button
              type="button"
              className="panel-button panel-button-secondary"
              onClick={() => selectedRequest && void runCustomerAction('approve-erasure', { requestId: selectedRequest.id })}
              disabled={acting || !capabilities.canApprove || !selectedRequest || selectedRequest.reviewStatus !== 'pending_review'}
            >
              Aprovar solicitação
            </button>
            <button
              type="button"
              className="panel-button panel-button-secondary"
              onClick={() => selectedRequest && void runCustomerAction('reject-erasure', { requestId: selectedRequest.id })}
              disabled={acting || !capabilities.canApprove || !selectedRequest || selectedRequest.reviewStatus !== 'pending_review'}
            >
              Rejeitar solicitação
            </button>
            <button
              type="button"
              className="panel-button panel-button-danger"
              onClick={() => selectedRequest && void runCustomerAction('execute-anonymization', { requestId: selectedRequest.id })}
              disabled={acting || !capabilities.canExecute || !selectedRequest?.executionEligible}
            >
              {acting ? 'Processando...' : 'Executar anonimização'}
            </button>
          </div>

          {exportData ? (
            <div className="panel-field">
              <label htmlFor="lgpd-export-json">Pacote exportado</label>
              <textarea id="lgpd-export-json" className="panel-textarea" rows={16} readOnly value={JSON.stringify(exportData, null, 2)} />
            </div>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Fila operacional</h2>
              <p className="panel-muted">Acompanhe o estágio de cada solicitação: registrada, em revisão, aprovada para execução ou concluída.</p>
            </div>
          </div>
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Conta</th>
                  <th>Tipo</th>
                  <th>Revisão</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.length ? (
                  requests.map((request) => (
                    <tr key={request.id}>
                      <td>{formatDateTime(request.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="panel-link-button"
                          onClick={() => setSelectedId(request.accountId || null)}
                        >
                          {request.accountEmail || request.accountId || '-'}
                        </button>
                      </td>
                      <td>{request.type}</td>
                      <td>{request.reviewStatus}</td>
                      <td>{request.status}</td>
                      <td>
                        <div className="panel-inline-actions">
                          {request.type === 'erasure_request' && request.reviewStatus === 'pending_review' && capabilities.canApprove ? (
                            <>
                              <button type="button" className="panel-button panel-button-small" onClick={() => void runCustomerAction('approve-erasure', { customerId: request.accountId, requestId: request.id })}>
                                Aprovar
                              </button>
                              <button type="button" className="panel-button panel-button-small panel-button-secondary" onClick={() => void runCustomerAction('reject-erasure', { customerId: request.accountId, requestId: request.id })}>
                                Rejeitar
                              </button>
                            </>
                          ) : null}
                          {request.executionEligible && capabilities.canExecute ? (
                            <button type="button" className="panel-button panel-button-small panel-button-danger" onClick={() => void runCustomerAction('execute-anonymization', { customerId: request.accountId, requestId: request.id })}>
                              Executar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="panel-table-empty">
                      Nenhuma solicitação LGPD registrada até agora.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-header__copy">
            <h2>Política de retenção</h2>
            <p className="panel-muted">Define o prazo, a ação padrão e a base legal operacional de cada categoria de dado do cliente.</p>
          </div>
        </div>
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Ação</th>
                <th>Prazo</th>
                <th>Base legal / motivo</th>
                <th>Ativa</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => {
                const draft = policyDrafts[policy.entityKey] || {
                  action: policy.action,
                  retentionDays: policy.retentionDays,
                  legalBasis: policy.legalBasis,
                  enabled: policy.enabled,
                };
                return (
                  <tr key={policy.id}>
                    <td>
                      <strong>{policy.label}</strong>
                      <div className="panel-table-caption">{policy.description}</div>
                    </td>
                    <td>
                      <select
                        className="panel-select"
                        value={draft.action}
                        disabled={!capabilities.canManageRetention}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.entityKey]: {
                              ...draft,
                              action: event.target.value as CustomerRetentionPolicyRecord['action'],
                            },
                          }))
                        }
                      >
                        <option value="delete">Excluir</option>
                        <option value="anonymize">Anonimizar</option>
                        <option value="retain_minimum">Reter mínimo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="panel-input"
                        type="number"
                        min={1}
                        value={draft.retentionDays}
                        disabled={!capabilities.canManageRetention}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.entityKey]: {
                              ...draft,
                              retentionDays: Math.max(1, Number(event.target.value || 1)),
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="panel-input"
                        value={draft.legalBasis}
                        disabled={!capabilities.canManageRetention}
                        onChange={(event) =>
                          setPolicyDrafts((current) => ({
                            ...current,
                            [policy.entityKey]: {
                              ...draft,
                              legalBasis: event.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <label className="panel-checkbox">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          disabled={!capabilities.canManageRetention}
                          onChange={(event) =>
                            setPolicyDrafts((current) => ({
                              ...current,
                              [policy.entityKey]: {
                                ...draft,
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{draft.enabled ? 'Ativa' : 'Desativada'}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="panel-button panel-button-small"
                        disabled={!capabilities.canManageRetention || policySavingKey === policy.entityKey}
                        onClick={() => void savePolicy(policy.entityKey)}
                      >
                        {policySavingKey === policy.entityKey ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
