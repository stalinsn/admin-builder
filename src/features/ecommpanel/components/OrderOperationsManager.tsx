'use client';

import { useEffect, useMemo, useState } from 'react';

import { resolveSelectedShippingOption } from '@/features/ecommerce/lib/logisticsClient';
import type {
  CommerceOrderEventRecord,
  CommerceOrderFinancialStatus,
  CommerceOrderFulfillmentStatus,
  CommerceOrderRecord,
  CommerceOrderStatus,
} from '@/features/ecommerce/types/commerceOrder';
import type { Address, ClientProfileData } from '@/features/ecommerce/types/orderForm';

type OrdersResponse = {
  items?: CommerceOrderRecord[];
  total?: number;
  error?: string;
};

type OrderDetailResponse = {
  order?: CommerceOrderRecord & { events: CommerceOrderEventRecord[] };
  error?: string;
};

type LogisticsFormState = {
  dockLabel: string;
  carrierLabel: string;
  trackingCode: string;
  promisedWindowLabel: string;
  operationalNote: string;
};

const STATUS_OPTIONS: Array<{ value: CommerceOrderStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'review', label: 'Em revisão' },
  { value: 'preparing', label: 'Em separação' },
  { value: 'partially_updated', label: 'Ajustado' },
  { value: 'ready_to_ship', label: 'Pronto para envio' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

const FINANCIAL_OPTIONS: Array<{ value: CommerceOrderFinancialStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'authorized', label: 'Autorizado' },
  { value: 'paid', label: 'Pago' },
  { value: 'partially_refunded', label: 'Parcialmente estornado' },
  { value: 'refunded', label: 'Estornado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const FULFILLMENT_OPTIONS: Array<{ value: CommerceOrderFulfillmentStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'allocating', label: 'Alocando' },
  { value: 'picking', label: 'Separando' },
  { value: 'packed', label: 'Embalado' },
  { value: 'dispatched', label: 'Despachado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function formatMoney(value?: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function statusLabel<T extends string>(value: T, source: Array<{ value: T; label: string }>): string {
  return source.find((item) => item.value === value)?.label || value;
}

function badgeClass(value: string) {
  if (value === 'paid' || value === 'confirmed' || value === 'delivered') return 'panel-badge panel-badge-success';
  if (value === 'cancelled' || value === 'pending' || value === 'review') return 'panel-badge panel-badge-neutral';
  return 'panel-badge';
}

export default function OrderOperationsManager() {
  const [orders, setOrders] = useState<CommerceOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<(CommerceOrderRecord & { events: CommerceOrderEventRecord[] }) | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerForm, setCustomerForm] = useState<ClientProfileData>({});
  const [shippingForm, setShippingForm] = useState<Address>({});
  const [logisticsForm, setLogisticsForm] = useState<LogisticsFormState>({
    dockLabel: '',
    carrierLabel: '',
    trackingCode: '',
    promisedWindowLabel: '',
    operationalNote: '',
  });
  const [statusForm, setStatusForm] = useState<{
    status: CommerceOrderStatus;
    financialStatus: CommerceOrderFinancialStatus;
    fulfillmentStatus: CommerceOrderFulfillmentStatus;
    note: string;
  }>({
    status: 'pending',
    financialStatus: 'pending',
    fulfillmentStatus: 'pending',
    note: '',
  });

  async function loadOrders() {
    setLoadingList(true);
    setError(null);
    setFeedback(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '50');

      const response = await fetch(`/api/ecommpanel/orders?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as OrdersResponse | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível carregar a fila de pedidos.');
        return;
      }

      const nextOrders = payload?.items || [];
      setOrders(nextOrders);
      setTotal(Number(payload?.total || 0));
      setSelectedId((current) => current || nextOrders[0]?.id || null);
    } catch {
      setError('Erro de rede ao carregar a fila de pedidos.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadOrderDetail(orderId: string) {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`/api/ecommpanel/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as OrderDetailResponse | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível carregar o pedido.');
        return;
      }
      const order = payload?.order || null;
      setSelectedOrder(order);
      setCustomerForm((order?.customerSnapshot as ClientProfileData) || {});
      setShippingForm(order?.shippingSnapshot?.selectedAddress || {});
      const logistics = order?.logistics && typeof order.logistics === 'object' ? order.logistics : {};
      setLogisticsForm({
        dockLabel: typeof logistics?.dockLabel === 'string' ? logistics.dockLabel : '',
        carrierLabel: typeof logistics?.carrierLabel === 'string' ? logistics.carrierLabel : '',
        trackingCode: typeof logistics?.trackingCode === 'string' ? logistics.trackingCode : '',
        promisedWindowLabel: typeof logistics?.promisedWindowLabel === 'string' ? logistics.promisedWindowLabel : '',
        operationalNote: typeof logistics?.operationalNote === 'string' ? logistics.operationalNote : '',
      });
      setStatusForm({
        status: order?.status || 'pending',
        financialStatus: order?.financialStatus || 'pending',
        fulfillmentStatus: order?.fulfillmentStatus || 'pending',
        note: '',
      });
    } catch {
      setError('Erro de rede ao carregar o detalhe do pedido.');
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [query, statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedOrder(null);
      return;
    }
    void loadOrderDetail(selectedId);
  }, [selectedId]);

  const stats = useMemo(() => {
    return {
      pending: orders.filter((order) => order.status === 'pending' || order.status === 'review').length,
      inProgress: orders.filter((order) => ['confirmed', 'preparing', 'partially_updated', 'ready_to_ship', 'shipped'].includes(order.status)).length,
      delivered: orders.filter((order) => order.status === 'delivered').length,
      paid: orders.filter((order) => order.financialStatus === 'paid').length,
    };
  }, [orders]);

  const selectedShippingOption = useMemo(
    () =>
      selectedOrder?.shippingSnapshot
        ? resolveSelectedShippingOption({
            countries: [],
            availableAddresses: [],
            selectedAddress: selectedOrder.shippingSnapshot.selectedAddress || null,
            deliveryOptions: selectedOrder.shippingSnapshot.deliveryOptions || [],
            pickupOptions: selectedOrder.shippingSnapshot.pickupOptions || [],
            selectedOptionId: selectedOrder.shippingSnapshot.selectedOptionId || null,
            selectedMode: selectedOrder.shippingSnapshot.selectedMode || null,
            isValid: true,
          })
        : null,
    [selectedOrder],
  );

  async function saveOperationalUpdate() {
    if (!selectedOrder) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/ecommpanel/orders/${encodeURIComponent(selectedOrder.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.cookie
            .split('; ')
            .find((item) => item.startsWith('ecommpanel_csrf='))
            ?.split('=')[1] || '',
        },
        body: JSON.stringify({
          status: statusForm.status,
          financialStatus: statusForm.financialStatus,
          fulfillmentStatus: statusForm.fulfillmentStatus,
          customerSnapshot: customerForm,
          shippingSnapshot: {
            ...(selectedOrder.shippingSnapshot || { deliveryOptions: [], pickupOptions: [] }),
            selectedAddress: shippingForm,
          },
          logistics: {
            ...(selectedOrder.logistics || {}),
            dockLabel: logisticsForm.dockLabel.trim() || null,
            carrierLabel: logisticsForm.carrierLabel.trim() || null,
            trackingCode: logisticsForm.trackingCode.trim() || null,
            promisedWindowLabel: logisticsForm.promisedWindowLabel.trim() || null,
            operationalNote: logisticsForm.operationalNote.trim() || null,
            selectedMode: selectedShippingOption?.mode || selectedOrder.shippingSnapshot?.selectedMode || null,
            optionLabel: selectedShippingOption?.name || null,
            estimate: selectedShippingOption?.estimate || null,
            estimateDaysMin: selectedShippingOption?.estimateDaysMin ?? null,
            estimateDaysMax: selectedShippingOption?.estimateDaysMax ?? null,
            originIds: selectedShippingOption?.originIds || [],
            originNames: selectedShippingOption?.originNames || [],
            policyIds: selectedShippingOption?.policyIds || [],
          },
          title: statusForm.note.trim() ? 'Atualização operacional do pedido' : undefined,
          description: statusForm.note.trim() || undefined,
          visibility: 'customer',
          eventKind: 'operations_update',
          payload: {
            addressChanged: true,
            contactChanged: true,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as OrderDetailResponse & { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível atualizar o pedido.');
        return;
      }

      if (payload.order) {
        setSelectedOrder(payload.order);
        setOrders((current) => current.map((item) => (item.id === payload.order?.id ? payload.order : item)));
      }
      setStatusForm((current) => ({ ...current, note: '' }));
      setFeedback('Pedido atualizado com sucesso.');
      void loadOrders();
    } catch {
      setError('Erro de rede ao salvar a atualização do pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="orders-operations-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Pedidos</p>
        <h1 id="orders-operations-title">Fila operacional de pedidos</h1>
        <p className="panel-muted">
          Acompanhe o andamento comercial, ajuste dados sensíveis do pedido com segurança e mantenha a trilha logística atualizada sem sair do painel.
        </p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Fila ativa</span>
          <strong>{stats.pending}</strong>
          <span>Pedidos pendentes ou em revisão</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Em andamento</span>
          <strong>{stats.inProgress}</strong>
          <span>Separação, ajuste, envio ou preparo</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Pagos</span>
          <strong>{stats.paid}</strong>
          <span>Status financeiro conciliado</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Entregues</span>
          <strong>{stats.delivered}</strong>
          <span>Pedidos já concluídos para o cliente</span>
        </article>
      </div>

      <div className="panel-workspace panel-workspace--wide-sidebar panel-workspace--orders">
        <aside className="panel-workspace__sidebar">
          <article className="panel-card panel-orders-queue-card">
            <div className="panel-toolbar">
              <div className="panel-toolbar__top">
                <div className="panel-toolbar__copy">
                  <h2>Fila de pedidos</h2>
                  <p className="panel-muted">Pedidos reais consolidados. Draft de carrinho só vira registro depois de 20 minutos de sessão e expira 5 dias após abandono.</p>
                </div>
              </div>
              <div className="panel-toolbar__filters">
                <input
                  className="panel-search"
                  type="search"
                  placeholder="Buscar por número do pedido ou e-mail"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select className="panel-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Todos os status</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingList ? <p className="panel-muted">Carregando fila...</p> : null}
            {!loadingList && !orders.length ? <p className="panel-table-empty">Nenhum pedido encontrado no filtro atual.</p> : null}

            <div className="panel-order-list">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`panel-order-list__item ${selectedId === order.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(order.id)}
                >
                  <div className="panel-order-list__head">
                    <strong>{order.id}</strong>
                    <span className={badgeClass(order.status)}>{statusLabel(order.status, STATUS_OPTIONS)}</span>
                  </div>
                  <div className="panel-order-list__meta">
                    <span>{order.customerEmail}</span>
                    <span>{formatMoney(order.totals.value)}</span>
                    <span>{formatDate(order.placedAt)}</span>
                  </div>
                  <div className="panel-order-list__meta">
                    <span>{order.groupOrderId ? `grupo ${order.groupOrderId}` : 'pedido simples'}</span>
                    <span>{statusLabel(order.financialStatus, FINANCIAL_OPTIONS)}</span>
                    <span>{statusLabel(order.fulfillmentStatus, FULFILLMENT_OPTIONS)}</span>
                    <span>{order.totals.itemsCount} item(ns)</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="panel-muted">Total no recorte atual: {total}</p>
          </article>
        </aside>

        <div className="panel-workspace__main">
          <article className="panel-card panel-orders-detail-card">
            <div className="panel-card-header panel-card-header--orders">
              <div className="panel-card-header__copy">
                <p className="panel-kicker">Operação do pedido</p>
                <h2>Pedido em foco</h2>
                <p className="panel-muted">Atualize status, observações e dados operacionais do pedido selecionado.</p>
              </div>
              <div className="panel-orders-detail-card__meta">
                <span className="panel-badge panel-badge-neutral">{selectedOrder?.groupOrderId ? 'Compra fracionada' : 'Pedido único'}</span>
                <small>{selectedOrder ? formatMoney(selectedOrder.totals.value) : 'Selecione um pedido'}</small>
              </div>
            </div>

            {error ? <div className="panel-feedback panel-feedback-error">{error}</div> : null}
            {feedback ? <div className="panel-feedback panel-feedback-success">{feedback}</div> : null}

            {!selectedOrder && !loadingDetail ? <p className="panel-table-empty">Selecione um pedido na fila para abrir o detalhe.</p> : null}
            {loadingDetail ? <p className="panel-muted">Carregando detalhe do pedido...</p> : null}

            {selectedOrder ? (
              <div className="panel-form panel-orders-detail-form">
                <section className="panel-form-section panel-orders-section">
                  <h3>Resumo do pedido</h3>
                  <div className="panel-form-grid panel-form-grid--three">
                    <div className="panel-field">
                      <label>Número</label>
                      <input className="panel-input" value={selectedOrder.id} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Token público</label>
                      <input className="panel-input" value={selectedOrder.publicToken} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Origem</label>
                      <input className="panel-input" value={selectedOrder.source} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Grupo operacional</label>
                      <input className="panel-input" value={selectedOrder.groupOrderId || 'Pedido simples'} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Fatia logística</label>
                      <input
                        className="panel-input"
                        value={selectedOrder.splitTotal > 1 ? `${selectedOrder.splitSequence}/${selectedOrder.splitTotal}` : 'Única'}
                        readOnly
                      />
                    </div>
                    <div className="panel-field">
                      <label>Valor total</label>
                      <input className="panel-input" value={formatMoney(selectedOrder.totals.value)} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Frete</label>
                      <input className="panel-input" value={formatMoney(selectedOrder.totals.shippingValue)} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Atualizado em</label>
                      <input className="panel-input" value={formatDate(selectedOrder.updatedAt)} readOnly />
                    </div>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Status e andamento</h3>
                  <div className="panel-form-grid panel-form-grid--three">
                    <div className="panel-field">
                      <label htmlFor="order-status">Status geral</label>
                      <select id="order-status" className="panel-select" value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value as CommerceOrderStatus }))}>
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-financial-status">Status financeiro</label>
                      <select id="order-financial-status" className="panel-select" value={statusForm.financialStatus} onChange={(event) => setStatusForm((current) => ({ ...current, financialStatus: event.target.value as CommerceOrderFinancialStatus }))}>
                        {FINANCIAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-fulfillment-status">Logística</label>
                      <select id="order-fulfillment-status" className="panel-select" value={statusForm.fulfillmentStatus} onChange={(event) => setStatusForm((current) => ({ ...current, fulfillmentStatus: event.target.value as CommerceOrderFulfillmentStatus }))}>
                        {FULFILLMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="panel-field panel-field--span-2">
                      <label htmlFor="order-note">Nota operacional</label>
                      <textarea
                        id="order-note"
                        className="panel-textarea"
                        value={statusForm.note}
                        onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Descreva a atualização, ajuste de item, mudança de entrega ou observação ao cliente."
                      />
                    </div>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Contato do cliente</h3>
                  <div className="panel-form-grid panel-form-grid--three">
                    <div className="panel-field">
                      <label htmlFor="order-customer-first-name">Nome</label>
                      <input id="order-customer-first-name" className="panel-input" value={customerForm.firstName || ''} onChange={(event) => setCustomerForm((current) => ({ ...current, firstName: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-customer-last-name">Sobrenome</label>
                      <input id="order-customer-last-name" className="panel-input" value={customerForm.lastName || ''} onChange={(event) => setCustomerForm((current) => ({ ...current, lastName: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-customer-email">E-mail</label>
                      <input id="order-customer-email" className="panel-input" value={customerForm.email || ''} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-customer-phone">Telefone</label>
                      <input id="order-customer-phone" className="panel-input" value={customerForm.phone || ''} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-customer-document">Documento</label>
                      <input id="order-customer-document" className="panel-input" value={customerForm.document || ''} onChange={(event) => setCustomerForm((current) => ({ ...current, document: event.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Entrega e endereço</h3>
                  <div className="panel-form-grid panel-form-grid--three">
                    <div className="panel-field">
                      <label htmlFor="order-address-postal">CEP</label>
                      <input id="order-address-postal" className="panel-input" value={shippingForm.postalCode || ''} onChange={(event) => setShippingForm((current) => ({ ...current, postalCode: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-street">Rua</label>
                      <input id="order-address-street" className="panel-input" value={shippingForm.street || ''} onChange={(event) => setShippingForm((current) => ({ ...current, street: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-number">Número</label>
                      <input id="order-address-number" className="panel-input" value={shippingForm.number || ''} onChange={(event) => setShippingForm((current) => ({ ...current, number: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-complement">Complemento</label>
                      <input id="order-address-complement" className="panel-input" value={shippingForm.complement || ''} onChange={(event) => setShippingForm((current) => ({ ...current, complement: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-neighborhood">Bairro</label>
                      <input id="order-address-neighborhood" className="panel-input" value={shippingForm.neighborhood || ''} onChange={(event) => setShippingForm((current) => ({ ...current, neighborhood: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-city">Cidade</label>
                      <input id="order-address-city" className="panel-input" value={shippingForm.city || ''} onChange={(event) => setShippingForm((current) => ({ ...current, city: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-state">UF</label>
                      <input id="order-address-state" className="panel-input" value={shippingForm.state || ''} onChange={(event) => setShippingForm((current) => ({ ...current, state: event.target.value }))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-address-country">País</label>
                      <input id="order-address-country" className="panel-input" value={shippingForm.country || ''} onChange={(event) => setShippingForm((current) => ({ ...current, country: event.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Malha logística</h3>
                  <div className="panel-form-grid panel-form-grid--three">
                    <div className="panel-field">
                      <label>Modo selecionado</label>
                      <input
                        className="panel-input"
                        value={
                          selectedShippingOption?.mode === 'pickup'
                            ? 'Retirada'
                            : selectedShippingOption?.mode === 'delivery'
                              ? 'Entrega'
                              : '-'
                        }
                        readOnly
                      />
                    </div>
                    <div className="panel-field panel-field--span-2">
                      <label>Oferta escolhida</label>
                      <input className="panel-input" value={selectedShippingOption?.name || '-'} readOnly />
                    </div>
                    <div className="panel-field">
                      <label>Prazo prometido</label>
                      <input className="panel-input" value={selectedShippingOption?.estimate || '-'} readOnly />
                    </div>
                    <div className="panel-field panel-field--span-2">
                      <label>Origens alocadas</label>
                      <input className="panel-input" value={selectedShippingOption?.originNames?.join(', ') || '-'} readOnly />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-logistics-dock">Doca / operação</label>
                      <input
                        id="order-logistics-dock"
                        className="panel-input"
                        value={logisticsForm.dockLabel}
                        onChange={(event) => setLogisticsForm((current) => ({ ...current, dockLabel: event.target.value }))}
                        placeholder="Ex.: Doca Centro"
                      />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-logistics-carrier">Transportadora</label>
                      <input
                        id="order-logistics-carrier"
                        className="panel-input"
                        value={logisticsForm.carrierLabel}
                        onChange={(event) => setLogisticsForm((current) => ({ ...current, carrierLabel: event.target.value }))}
                        placeholder="Ex.: Frota própria"
                      />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="order-logistics-tracking">Rastreio</label>
                      <input
                        id="order-logistics-tracking"
                        className="panel-input"
                        value={logisticsForm.trackingCode}
                        onChange={(event) => setLogisticsForm((current) => ({ ...current, trackingCode: event.target.value }))}
                        placeholder="Código ou referência de coleta"
                      />
                    </div>
                    <div className="panel-field panel-field--span-2">
                      <label htmlFor="order-logistics-window">Janela prometida</label>
                      <input
                        id="order-logistics-window"
                        className="panel-input"
                        value={logisticsForm.promisedWindowLabel}
                        onChange={(event) => setLogisticsForm((current) => ({ ...current, promisedWindowLabel: event.target.value }))}
                        placeholder="Ex.: hoje até 18h / retirada a partir das 14h"
                      />
                    </div>
                    <div className="panel-field panel-field--span-2">
                      <label htmlFor="order-logistics-note">Observação logística</label>
                      <textarea
                        id="order-logistics-note"
                        className="panel-textarea"
                        value={logisticsForm.operationalNote}
                        onChange={(event) => setLogisticsForm((current) => ({ ...current, operationalNote: event.target.value }))}
                        placeholder="Restrições, troca de janela, informação de separação ou coleta."
                      />
                    </div>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Itens do pedido</h3>
                  <div className="panel-table-wrap">
                    <table className="panel-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Quantidade</th>
                          <th>Preço</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item) => (
                          <tr key={`${item.id}-${item.name}`}>
                            <td>
                              <strong>{item.name}</strong>
                              <div className="panel-muted">{item.id}</div>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatMoney(item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel-form-section panel-orders-section">
                  <h3>Timeline do pedido</h3>
                  <div className="panel-order-timeline">
                    {selectedOrder.events.length ? (
                      selectedOrder.events.map((event) => (
                        <article key={event.id} className="panel-order-timeline__item">
                          <div className="panel-order-timeline__head">
                            <strong>{event.title}</strong>
                            <span className="panel-muted">{formatDate(event.createdAt)}</span>
                          </div>
                          <div className="panel-order-timeline__meta">
                            <span className={badgeClass(event.visibility)}>{event.visibility}</span>
                            <span className="panel-badge">{event.kind}</span>
                            <span className="panel-badge">{event.actorType}</span>
                          </div>
                          {event.description ? <p className="panel-muted">{event.description}</p> : null}
                        </article>
                      ))
                    ) : (
                      <p className="panel-table-empty">Nenhuma atualização operacional registrada ainda.</p>
                    )}
                  </div>
                </section>

                <div className="panel-form-actions">
                  <button type="button" className="panel-btn panel-btn-primary" onClick={() => void saveOperationalUpdate()} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar atualização'}
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}
