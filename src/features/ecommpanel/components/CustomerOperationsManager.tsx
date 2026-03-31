'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  CustomerAdminRecord,
  CustomerAdminSummary,
  CustomerAccountAddress,
  CustomerAccountKind,
  CustomerDocumentType,
} from '@/features/ecommerce/types/account';

type CustomersResponse = {
  customers?: CustomerAdminSummary[];
  error?: string;
};

type CustomerDetailResponse = {
  customer?: CustomerAdminRecord;
  error?: string;
};

type CustomerFormState = {
  kind: CustomerAccountKind;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  alternatePhone: string;
  birthDate: string;
  taxDocumentType: CustomerDocumentType;
  taxDocument: string;
  secondaryDocument: string;
  companyName: string;
  tradeName: string;
  stateRegistration: string;
  marketingOptIn: boolean;
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
  active: boolean;
  addresses: Array<
    Omit<CustomerAccountAddress, 'updatedAt' | 'createdAt'> & {
      id?: string;
    }
  >;
};

const EMPTY_ADDRESS = {
  id: '',
  label: 'Casa',
  recipient: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'BRA',
  reference: '',
  phone: '',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  kind: 'individual',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  alternatePhone: '',
  birthDate: '',
  taxDocumentType: 'cpf',
  taxDocument: '',
  secondaryDocument: '',
  companyName: '',
  tradeName: '',
  stateRegistration: '',
  marketingOptIn: false,
  acceptedPrivacy: false,
  acceptedTerms: false,
  active: true,
  addresses: [{ ...EMPTY_ADDRESS }],
};

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function maskCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskCEP(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

function maskUF(value: string) {
  return value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function buildForm(customer: CustomerAdminRecord | null): CustomerFormState {
  if (!customer) return EMPTY_CUSTOMER_FORM;
  return {
    kind: customer.profile.kind,
    email: customer.profile.email || '',
    firstName: customer.profile.firstName || '',
    lastName: customer.profile.lastName || '',
    phone: customer.profile.phone || '',
    alternatePhone: customer.profile.alternatePhone || '',
    birthDate: customer.profile.birthDate || '',
    taxDocumentType: customer.profile.taxDocumentType,
    taxDocument: customer.profile.taxDocument || '',
    secondaryDocument: customer.profile.secondaryDocument || '',
    companyName: customer.profile.companyName || '',
    tradeName: customer.profile.tradeName || '',
    stateRegistration: customer.profile.stateRegistration || '',
    marketingOptIn: Boolean(customer.profile.marketingOptIn),
    acceptedPrivacy: Boolean(customer.profile.acceptedPrivacyAt),
    acceptedTerms: Boolean(customer.profile.acceptedTermsAt),
    active: Boolean(customer.active),
    addresses: customer.addresses.length
      ? customer.addresses.map((address) => ({
          id: address.id,
          label: address.label,
          recipient: address.recipient || '',
          postalCode: address.postalCode || '',
          street: address.street || '',
          number: address.number || '',
          complement: address.complement || '',
          neighborhood: address.neighborhood || '',
          city: address.city || '',
          state: address.state || '',
          country: address.country || 'BRA',
          reference: address.reference || '',
          phone: address.phone || '',
          isDefaultShipping: Boolean(address.isDefaultShipping),
          isDefaultBilling: Boolean(address.isDefaultBilling),
        }))
      : [{ ...EMPTY_ADDRESS }],
  };
}

function displayCustomerName(customer: CustomerAdminSummary | CustomerAdminRecord | null): string {
  if (!customer) return '';
  if ('profile' in customer) {
    return customer.profile.kind === 'company'
      ? customer.profile.companyName || customer.profile.tradeName || customer.profile.email
      : customer.profile.fullName || [customer.profile.firstName, customer.profile.lastName].filter(Boolean).join(' ') || customer.profile.email;
  }
  return customer.name;
}

export default function CustomerOperationsManager() {
  const [customers, setCustomers] = useState<CustomerAdminSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAdminRecord | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [query, setQuery] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadCsrf() {
    const response = await fetch('/api/ecommpanel/auth/me', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as { csrfToken?: string } | null;
    if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
  }

  async function loadCustomers() {
    setLoadingList(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`/api/ecommpanel/customers?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CustomersResponse | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível carregar os clientes.');
        return;
      }
      const nextCustomers = payload?.customers || [];
      setCustomers(nextCustomers);
      setSelectedId((current) => current || nextCustomers[0]?.id || null);
    } catch {
      setError('Erro de rede ao carregar os clientes.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadCustomerDetail(customerId: string) {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`/api/ecommpanel/customers/${encodeURIComponent(customerId)}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CustomerDetailResponse | null;
      if (!response.ok || !payload?.customer) {
        setError(payload?.error || 'Não foi possível carregar o cliente.');
        return;
      }
      setSelectedCustomer(payload.customer);
      setForm(buildForm(payload.customer));
    } catch {
      setError('Erro de rede ao carregar o detalhe do cliente.');
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void loadCsrf();
    void loadCustomers();
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCustomer(null);
      setForm(EMPTY_CUSTOMER_FORM);
      return;
    }
    void loadCustomerDetail(selectedId);
  }, [selectedId]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((customer) => customer.active).length,
      withOrders: customers.filter((customer) => customer.ordersCount > 0).length,
      withErasure: customers.filter((customer) => Boolean(customer.erasureRequestedAt)).length,
    };
  }, [customers]);

  function createNewCustomer() {
    setSelectedId(null);
    setSelectedCustomer(null);
    setForm({
      ...EMPTY_CUSTOMER_FORM,
      addresses: [{ ...EMPTY_ADDRESS }],
    });
    setSuccess(null);
    setError(null);
  }

  function updateAddress(index: number, patch: Partial<CustomerFormState['addresses'][number]>) {
    setForm((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => {
        if (addressIndex !== index) return address;
        return { ...address, ...patch };
      }),
    }));
  }

  function addAddress() {
    setForm((current) => ({
      ...current,
      addresses: [...current.addresses, { ...EMPTY_ADDRESS, label: `Endereço ${current.addresses.length + 1}` }],
    }));
  }

  function removeAddress(index: number) {
    setForm((current) => {
      const nextAddresses = current.addresses.filter((_, addressIndex) => addressIndex !== index);
      return {
        ...current,
        addresses: nextAddresses.length ? nextAddresses : [{ ...EMPTY_ADDRESS }],
      };
    });
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(selectedCustomer ? `/api/ecommpanel/customers/${selectedCustomer.profile.id}` : '/api/ecommpanel/customers', {
        method: selectedCustomer ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as CustomerDetailResponse & { error?: string } | null;
      if (!response.ok || !payload?.customer) {
        setError(payload?.error || 'Não foi possível salvar o cliente.');
        return;
      }
      setSelectedCustomer(payload.customer);
      setSelectedId(payload.customer.profile.id);
      setForm(buildForm(payload.customer));
      setSuccess(selectedCustomer ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
      void loadCustomers();
    } catch {
      setError('Erro de rede ao salvar o cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="customers-operations-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Clientes</p>
        <h1 id="customers-operations-title">Cadastro operacional de clientes</h1>
        <p className="panel-muted">
          Cadastre cliente completo direto pelo painel, com dados pessoais ou empresariais, consentimentos e múltiplos endereços prontos para a operação da loja.
        </p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Total</span>
          <strong>{stats.total}</strong>
          <span>Clientes carregados neste recorte</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Ativos</span>
          <strong>{stats.active}</strong>
          <span>Contas liberadas para autenticação</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Com pedidos</span>
          <strong>{stats.withOrders}</strong>
          <span>Clientes já ligados à operação comercial</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">LGPD pendente</span>
          <strong>{stats.withErasure}</strong>
          <span>Solicitações de apagamento registradas</span>
        </article>
      </div>

      <div className="panel-workspace panel-workspace--wide-sidebar">
        <aside className="panel-workspace__sidebar">
          <article className="panel-card">
            <div className="panel-toolbar">
              <div className="panel-toolbar__top">
                <div className="panel-toolbar__copy">
                  <h2>Base de clientes</h2>
                  <p className="panel-muted">Use esta área para cadastrar conta completa sem depender do fluxo do ecommerce.</p>
                </div>
                <button type="button" className="panel-btn panel-btn-secondary" onClick={createNewCustomer}>
                  Novo cliente
                </button>
              </div>
              <div className="panel-toolbar__filters">
                <input
                  className="panel-search"
                  type="search"
                  placeholder="Buscar por nome, e-mail ou telefone"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            {loadingList ? <p className="panel-muted">Carregando clientes...</p> : null}
            {!loadingList && !customers.length ? <p className="panel-table-empty">Nenhum cliente encontrado.</p> : null}

            <div className="panel-order-list">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className={`panel-order-list__item ${selectedId === customer.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(customer.id)}
                >
                  <div className="panel-order-list__head">
                    <strong>{displayCustomerName(customer)}</strong>
                    <span className={`panel-badge ${customer.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                      {customer.active ? 'ativo' : 'inativo'}
                    </span>
                  </div>
                  <div className="panel-order-list__meta">
                    <span>{customer.email}</span>
                    <span>{customer.kind === 'company' ? 'PJ' : 'PF'}</span>
                    <span>{customer.phone || 'Sem telefone'}</span>
                  </div>
                  <div className="panel-order-list__meta">
                    <span>{customer.ordersCount} pedido(s)</span>
                    <span>{customer.addressesCount} endereço(s)</span>
                    <span>Atualizado {formatDate(customer.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        </aside>

        <div className="panel-workspace__main">
          <article className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>{selectedCustomer ? 'Editar cliente' : 'Cadastrar novo cliente'}</h2>
                <p className="panel-muted">Esta estrutura cobre os campos necessários para operação real de cliente, inclusive PF/PJ e múltiplos endereços.</p>
              </div>
            </div>

            {error ? <div className="panel-feedback panel-feedback-error">{error}</div> : null}
            {success ? <div className="panel-feedback panel-feedback-success">{success}</div> : null}
            {loadingDetail ? <p className="panel-muted">Carregando detalhe do cliente...</p> : null}

            <form className="panel-form" onSubmit={saveCustomer}>
              <section className="panel-form-section">
                <h3>Tipo de cadastro</h3>
                <div className="panel-filter-row">
                  <button type="button" className={`panel-filter-chip ${form.kind === 'individual' ? 'is-active' : ''}`} onClick={() => setForm((current) => ({ ...current, kind: 'individual', taxDocumentType: 'cpf' }))}>
                    Pessoa física
                  </button>
                  <button type="button" className={`panel-filter-chip ${form.kind === 'company' ? 'is-active' : ''}`} onClick={() => setForm((current) => ({ ...current, kind: 'company', taxDocumentType: 'cnpj' }))}>
                    Pessoa jurídica
                  </button>
                </div>
              </section>

              <section className="panel-form-section">
                <h3>Dados principais</h3>
                <div className="panel-form-grid panel-form-grid--three">
                  <div className="panel-field">
                    <label htmlFor="customer-email">E-mail</label>
                    <input id="customer-email" className="panel-input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="customer-phone">Telefone</label>
                    <input id="customer-phone" className="panel-input" value={maskPhone(form.phone)} onChange={(event) => setForm((current) => ({ ...current, phone: maskPhone(event.target.value) }))} />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="customer-alt-phone">Telefone alternativo</label>
                    <input id="customer-alt-phone" className="panel-input" value={maskPhone(form.alternatePhone)} onChange={(event) => setForm((current) => ({ ...current, alternatePhone: maskPhone(event.target.value) }))} />
                  </div>

                  {form.kind === 'individual' ? (
                    <>
                      <div className="panel-field">
                        <label htmlFor="customer-first-name">Primeiro nome</label>
                        <input id="customer-first-name" className="panel-input" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-last-name">Sobrenome</label>
                        <input id="customer-last-name" className="panel-input" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-birth-date">Data de nascimento</label>
                        <input id="customer-birth-date" className="panel-input" type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-cpf">CPF</label>
                        <input id="customer-cpf" className="panel-input" value={maskCpfCnpj(form.taxDocument)} onChange={(event) => setForm((current) => ({ ...current, taxDocument: maskCpfCnpj(event.target.value), taxDocumentType: 'cpf' }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-rg">RG</label>
                        <input id="customer-rg" className="panel-input" value={form.secondaryDocument} onChange={(event) => setForm((current) => ({ ...current, secondaryDocument: event.target.value }))} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="panel-field">
                        <label htmlFor="customer-company-name">Razão social</label>
                        <input id="customer-company-name" className="panel-input" value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-trade-name">Nome fantasia</label>
                        <input id="customer-trade-name" className="panel-input" value={form.tradeName} onChange={(event) => setForm((current) => ({ ...current, tradeName: event.target.value }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-cnpj">CNPJ</label>
                        <input id="customer-cnpj" className="panel-input" value={maskCpfCnpj(form.taxDocument)} onChange={(event) => setForm((current) => ({ ...current, taxDocument: maskCpfCnpj(event.target.value), taxDocumentType: 'cnpj' }))} />
                      </div>
                      <div className="panel-field">
                        <label htmlFor="customer-state-registration">Inscrição estadual</label>
                        <input id="customer-state-registration" className="panel-input" value={form.stateRegistration} onChange={(event) => setForm((current) => ({ ...current, stateRegistration: event.target.value }))} />
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="panel-form-section">
                <h3>Consentimentos e status</h3>
                <div className="panel-form-grid panel-form-grid--three">
                  <label className="panel-check-card">
                    <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                    <span>Conta ativa para autenticação do cliente.</span>
                  </label>
                  <label className="panel-check-card">
                    <input type="checkbox" checked={form.acceptedPrivacy} onChange={(event) => setForm((current) => ({ ...current, acceptedPrivacy: event.target.checked }))} />
                    <span>Privacidade aceita e registrada.</span>
                  </label>
                  <label className="panel-check-card">
                    <input type="checkbox" checked={form.acceptedTerms} onChange={(event) => setForm((current) => ({ ...current, acceptedTerms: event.target.checked }))} />
                    <span>Termos de uso aceitos.</span>
                  </label>
                  <label className="panel-check-card panel-field--span-2">
                    <input type="checkbox" checked={form.marketingOptIn} onChange={(event) => setForm((current) => ({ ...current, marketingOptIn: event.target.checked }))} />
                    <span>Permissão para marketing e contato promocional.</span>
                  </label>
                </div>
              </section>

              <section className="panel-form-section">
                <div className="panel-card-header">
                  <div className="panel-card-header__copy">
                    <h3>Endereços</h3>
                    <p className="panel-muted">Cadastre múltiplos endereços para entrega, cobrança e apoio operacional.</p>
                  </div>
                  <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addAddress}>
                    Adicionar endereço
                  </button>
                </div>

                <div className="panel-order-timeline">
                  {form.addresses.map((address, index) => (
                    <article key={`${address.id || 'new'}-${index}`} className="panel-order-timeline__item">
                      <div className="panel-card-header">
                        <div className="panel-card-header__copy">
                          <strong>{address.label || `Endereço ${index + 1}`}</strong>
                        </div>
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => removeAddress(index)}>
                          Remover
                        </button>
                      </div>
                      <div className="panel-form-grid panel-form-grid--three">
                        <div className="panel-field">
                          <label>Rótulo</label>
                          <input className="panel-input" value={address.label} onChange={(event) => updateAddress(index, { label: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Destinatário</label>
                          <input className="panel-input" value={address.recipient || ''} onChange={(event) => updateAddress(index, { recipient: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Telefone</label>
                          <input className="panel-input" value={maskPhone(address.phone || '')} onChange={(event) => updateAddress(index, { phone: maskPhone(event.target.value) })} />
                        </div>
                        <div className="panel-field">
                          <label>CEP</label>
                          <input className="panel-input" value={maskCEP(address.postalCode || '')} onChange={(event) => updateAddress(index, { postalCode: maskCEP(event.target.value) })} />
                        </div>
                        <div className="panel-field">
                          <label>Rua</label>
                          <input className="panel-input" value={address.street || ''} onChange={(event) => updateAddress(index, { street: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Número</label>
                          <input className="panel-input" value={address.number || ''} onChange={(event) => updateAddress(index, { number: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Complemento</label>
                          <input className="panel-input" value={address.complement || ''} onChange={(event) => updateAddress(index, { complement: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Bairro</label>
                          <input className="panel-input" value={address.neighborhood || ''} onChange={(event) => updateAddress(index, { neighborhood: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Cidade</label>
                          <input className="panel-input" value={address.city || ''} onChange={(event) => updateAddress(index, { city: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>UF</label>
                          <input className="panel-input" value={maskUF(address.state || '')} onChange={(event) => updateAddress(index, { state: maskUF(event.target.value) })} />
                        </div>
                        <div className="panel-field">
                          <label>País</label>
                          <input className="panel-input" value={address.country || 'BRA'} onChange={(event) => updateAddress(index, { country: event.target.value })} />
                        </div>
                        <div className="panel-field">
                          <label>Referência</label>
                          <input className="panel-input" value={address.reference || ''} onChange={(event) => updateAddress(index, { reference: event.target.value })} />
                        </div>
                        <label className="panel-check-card">
                          <input type="checkbox" checked={Boolean(address.isDefaultShipping)} onChange={(event) => updateAddress(index, { isDefaultShipping: event.target.checked })} />
                          <span>Endereço padrão de entrega.</span>
                        </label>
                        <label className="panel-check-card">
                          <input type="checkbox" checked={Boolean(address.isDefaultBilling)} onChange={(event) => updateAddress(index, { isDefaultBilling: event.target.checked })} />
                          <span>Endereço padrão de cobrança.</span>
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {selectedCustomer ? (
                <section className="panel-form-section">
                  <h3>Sinais operacionais</h3>
                  <div className="panel-summary-grid">
                    <div className="panel-summary-item">
                      <span>Pedidos vinculados</span>
                      <strong>{selectedCustomer.ordersCount}</strong>
                    </div>
                    <div className="panel-summary-item">
                      <span>Endereços ativos</span>
                      <strong>{selectedCustomer.addressesCount}</strong>
                    </div>
                    <div className="panel-summary-item">
                      <span>Último login</span>
                      <strong>{formatDate(selectedCustomer.profile.lastLoginAt)}</strong>
                    </div>
                    <div className="panel-summary-item">
                      <span>LGPD</span>
                      <strong>{selectedCustomer.erasureRequestedAt ? 'Solicitação pendente' : 'Sem pendência'}</strong>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="panel-form-actions">
                <button type="submit" className="panel-btn panel-btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : selectedCustomer ? 'Salvar cliente' : 'Criar cliente'}
                </button>
              </div>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}
