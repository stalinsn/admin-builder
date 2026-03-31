'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  LogisticsDock,
  LogisticsEffectiveOffer,
  LogisticsManualOffer,
  LogisticsOperationalSummary,
  LogisticsOrigin,
  LogisticsPolicy,
  LogisticsSettings,
  LogisticsZone,
} from '@/features/ecommerce/types/logistics';

type SnapshotResponse = {
  settings?: LogisticsSettings;
  effectiveOffers?: LogisticsEffectiveOffer[];
  summary?: LogisticsOperationalSummary;
  error?: string;
};

function formatMoney(value?: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCsv(value: string[]): string {
  return value.join(', ');
}

function defaultOrigin(index = 0): LogisticsOrigin {
  return {
    id: `origin-new-${Date.now()}-${index}`,
    code: `NOVA-${index + 1}`,
    name: 'Nova origem',
    type: 'store',
    active: true,
    priority: index + 1,
    supportsDelivery: true,
    supportsPickup: true,
    inventoryLocationIds: [],
    address: {
      label: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: 'SP',
      postalCode: '',
      country: 'BR',
      reference: '',
    },
    postalCodePrefixes: [],
    tags: [],
  };
}

function defaultDock(originId = ''): LogisticsDock {
  return {
    id: `dock-new-${Date.now()}`,
    originId,
    name: 'Nova doca',
    active: true,
    serviceModes: ['delivery'],
    handlingHours: 4,
  };
}

function defaultZone(index = 0): LogisticsZone {
  return {
    id: `zone-new-${Date.now()}-${index}`,
    name: 'Nova zona',
    active: true,
    priority: index + 1,
    serviceModes: ['delivery'],
    postalCodePrefixes: [],
    states: [],
    cities: [],
    feeAdjustment: 0,
    leadTimeAdjustmentDays: 0,
    sameDayEligible: false,
  };
}

function defaultPolicy(index = 0): LogisticsPolicy {
  return {
    id: `policy-new-${Date.now()}-${index}`,
    name: 'Nova política',
    active: true,
    serviceMode: 'delivery',
    shippingClass: 'standard',
    basePrice: 0,
    pricePerItem: 0,
    minDeliveryDays: 1,
    maxDeliveryDays: 2,
    extraLeadDays: 0,
    sameDayEligible: false,
  };
}

function defaultManualOffer(productId = '', originId = ''): LogisticsManualOffer {
  return {
    id: `offer-new-${Date.now()}`,
    productId,
    originId,
    active: true,
    priority: 1,
    zoneIds: [],
    policyIds: [],
    serviceModes: ['delivery'],
    allowSubstitution: false,
  };
}

function uniqueProducts(offers: LogisticsEffectiveOffer[]) {
  const map = new Map<string, { id: string; name: string }>();
  for (const offer of offers) {
    if (!map.has(offer.productId)) {
      map.set(offer.productId, { id: offer.productId, name: offer.productName });
    }
  }
  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export default function LogisticsOperationsManager() {
  const [csrfToken, setCsrfToken] = useState('');
  const [settings, setSettings] = useState<LogisticsSettings | null>(null);
  const [effectiveOffers, setEffectiveOffers] = useState<LogisticsEffectiveOffer[]>([]);
  const [summary, setSummary] = useState<LogisticsOperationalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [offerQuery, setOfferQuery] = useState('');

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [meReq, snapshotReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/logistics', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as { csrfToken?: string } | null;
      const snapshot = (await snapshotReq.json().catch(() => null)) as SnapshotResponse | null;

      setCsrfToken(mePayload?.csrfToken || '');
      if (!snapshotReq.ok || !snapshot?.settings) {
        setError(snapshot?.error || 'Não foi possível carregar a central logística.');
        return;
      }

      setSettings(snapshot.settings);
      setEffectiveOffers(snapshot.effectiveOffers || []);
      setSummary(snapshot.summary || null);
      setSelectedOriginId((current) => current || snapshot.settings?.origins[0]?.id || null);
      setSelectedZoneId((current) => current || snapshot.settings?.zones[0]?.id || null);
      setSelectedPolicyId((current) => current || snapshot.settings?.policies[0]?.id || null);
      setSelectedOfferId((current) => current || snapshot.settings?.manualOffers[0]?.id || null);
    } catch {
      setError('Erro de rede ao carregar a central logística.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const selectedOrigin = useMemo(
    () => settings?.origins.find((origin) => origin.id === selectedOriginId) || null,
    [selectedOriginId, settings?.origins],
  );
  const selectedZone = useMemo(
    () => settings?.zones.find((zone) => zone.id === selectedZoneId) || null,
    [selectedZoneId, settings?.zones],
  );
  const selectedPolicy = useMemo(
    () => settings?.policies.find((policy) => policy.id === selectedPolicyId) || null,
    [selectedPolicyId, settings?.policies],
  );
  const selectedOffer = useMemo(
    () => settings?.manualOffers.find((offer) => offer.id === selectedOfferId) || null,
    [selectedOfferId, settings?.manualOffers],
  );
  const docksForSelectedOrigin = useMemo(
    () => settings?.docks.filter((dock) => dock.originId === selectedOriginId) || [],
    [selectedOriginId, settings?.docks],
  );
  const productOptions = useMemo(() => uniqueProducts(effectiveOffers), [effectiveOffers]);

  const filteredOffers = useMemo(() => {
    const term = offerQuery.trim().toLowerCase();
    return effectiveOffers.filter((offer) => {
      if (!term) return true;
      return (
        offer.productName.toLowerCase().includes(term) ||
        offer.originName.toLowerCase().includes(term) ||
        offer.productId.toLowerCase().includes(term)
      );
    });
  }, [effectiveOffers, offerQuery]);

  function updateSettings(next: LogisticsSettings) {
    setSettings(next);
  }

  function updateOrigin(patch: Partial<LogisticsOrigin>) {
    if (!settings || !selectedOrigin) return;
    updateSettings({
      ...settings,
      origins: settings.origins.map((origin) => (origin.id === selectedOrigin.id ? { ...origin, ...patch } : origin)),
    });
  }

  function updateOriginAddress(key: keyof LogisticsOrigin['address'], value: string) {
    if (!selectedOrigin) return;
    updateOrigin({ address: { ...selectedOrigin.address, [key]: value } });
  }

  function updateDock(dockId: string, patch: Partial<LogisticsDock>) {
    if (!settings) return;
    updateSettings({
      ...settings,
      docks: settings.docks.map((dock) => (dock.id === dockId ? { ...dock, ...patch } : dock)),
    });
  }

  function updateZone(patch: Partial<LogisticsZone>) {
    if (!settings || !selectedZone) return;
    updateSettings({
      ...settings,
      zones: settings.zones.map((zone) => (zone.id === selectedZone.id ? { ...zone, ...patch } : zone)),
    });
  }

  function updatePolicy(patch: Partial<LogisticsPolicy>) {
    if (!settings || !selectedPolicy) return;
    updateSettings({
      ...settings,
      policies: settings.policies.map((policy) => (policy.id === selectedPolicy.id ? { ...policy, ...patch } : policy)),
    });
  }

  function updateOffer(patch: Partial<LogisticsManualOffer>) {
    if (!settings || !selectedOffer) return;
    updateSettings({
      ...settings,
      manualOffers: settings.manualOffers.map((offer) => (offer.id === selectedOffer.id ? { ...offer, ...patch } : offer)),
    });
  }

  function addOrigin() {
    if (!settings) return;
    const next = defaultOrigin(settings.origins.length);
    updateSettings({ ...settings, origins: [...settings.origins, next] });
    setSelectedOriginId(next.id);
  }

  function removeOrigin() {
    if (!settings || !selectedOrigin) return;
    const remainingOrigins = settings.origins.filter((origin) => origin.id !== selectedOrigin.id);
    updateSettings({
      ...settings,
      origins: remainingOrigins,
      docks: settings.docks.filter((dock) => dock.originId !== selectedOrigin.id),
      manualOffers: settings.manualOffers.filter((offer) => offer.originId !== selectedOrigin.id),
    });
    setSelectedOriginId(remainingOrigins[0]?.id || null);
  }

  function addDock() {
    if (!settings || !selectedOrigin) return;
    updateSettings({
      ...settings,
      docks: [...settings.docks, defaultDock(selectedOrigin.id)],
    });
  }

  function removeDock(dockId: string) {
    if (!settings) return;
    updateSettings({
      ...settings,
      docks: settings.docks.filter((dock) => dock.id !== dockId),
      manualOffers: settings.manualOffers.map((offer) => (offer.dockId === dockId ? { ...offer, dockId: undefined } : offer)),
    });
  }

  function addZone() {
    if (!settings) return;
    const next = defaultZone(settings.zones.length);
    updateSettings({ ...settings, zones: [...settings.zones, next] });
    setSelectedZoneId(next.id);
  }

  function removeZone() {
    if (!settings || !selectedZone) return;
    const remainingZones = settings.zones.filter((zone) => zone.id !== selectedZone.id);
    updateSettings({
      ...settings,
      zones: remainingZones,
      manualOffers: settings.manualOffers.map((offer) => ({
        ...offer,
        zoneIds: offer.zoneIds.filter((zoneId) => zoneId !== selectedZone.id),
      })),
    });
    setSelectedZoneId(remainingZones[0]?.id || null);
  }

  function addPolicy() {
    if (!settings) return;
    const next = defaultPolicy(settings.policies.length);
    updateSettings({ ...settings, policies: [...settings.policies, next] });
    setSelectedPolicyId(next.id);
  }

  function removePolicy() {
    if (!settings || !selectedPolicy) return;
    const remainingPolicies = settings.policies.filter((policy) => policy.id !== selectedPolicy.id);
    updateSettings({
      ...settings,
      policies: remainingPolicies,
      manualOffers: settings.manualOffers.map((offer) => ({
        ...offer,
        policyIds: offer.policyIds.filter((policyId) => policyId !== selectedPolicy.id),
      })),
    });
    setSelectedPolicyId(remainingPolicies[0]?.id || null);
  }

  function addOffer() {
    if (!settings) return;
    const defaultProductId = productOptions[0]?.id || '';
    const defaultOriginId = settings.origins[0]?.id || '';
    const next = defaultManualOffer(defaultProductId, defaultOriginId);
    updateSettings({ ...settings, manualOffers: [next, ...settings.manualOffers] });
    setSelectedOfferId(next.id);
  }

  function removeOffer() {
    if (!settings || !selectedOffer) return;
    const remainingOffers = settings.manualOffers.filter((offer) => offer.id !== selectedOffer.id);
    updateSettings({ ...settings, manualOffers: remainingOffers });
    setSelectedOfferId(remainingOffers[0]?.id || null);
  }

  async function saveSettings() {
    if (!settings || !csrfToken || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/logistics', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(settings),
      });

      const payload = (await response.json().catch(() => null)) as SnapshotResponse | null;
      if (!response.ok || !payload?.settings) {
        setError(payload?.error || 'Não foi possível salvar a configuração logística.');
        return;
      }

      setSettings(payload.settings);
      setEffectiveOffers(payload.effectiveOffers || []);
      setSummary(payload.summary || null);
      setSuccess('Configuração logística publicada com sucesso.');
    } catch {
      setError('Erro de rede ao salvar a central logística.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid panel-logistics" aria-labelledby="logistics-operations-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Logística</p>
        <h1 id="logistics-operations-title">Central logística operacional</h1>
        <p className="panel-muted">
          Configure origens, docas, cobertura, SLA e ofertas por produto para que PDP, carrinho, checkout e pedidos passem a operar a mesma decisão logística.
        </p>
        <div className="panel-inline-actions">
          <button type="button" className="panel-btn panel-btn-primary" onClick={saveSettings} disabled={!settings || saving}>
            {saving ? 'Salvando...' : 'Salvar logística'}
          </button>
          <button type="button" className="panel-btn panel-btn-secondary" onClick={() => void loadSnapshot()} disabled={loading}>
            Recarregar
          </button>
        </div>
        {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
        {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}
      </article>

      {!loading && settings ? (
        <article className="panel-card panel-card-subtle">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Modo operacional da loja</h2>
              <p className="panel-muted">Defina se a vitrine trabalha com sortimento único ou se já deve filtrar produtos por regionalização antes da compra.</p>
            </div>
          </div>
          <div className="panel-form-grid">
            <div className="panel-form-row">
              <div className="panel-field">
                <label>Sortimento da vitrine</label>
                <select
                  className="panel-select"
                  value={settings.operation.assortmentMode}
                  onChange={(event) =>
                    updateSettings({
                      ...settings,
                      operation: {
                        ...settings.operation,
                        assortmentMode: event.target.value as LogisticsSettings['operation']['assortmentMode'],
                      },
                    })
                  }
                >
                  <option value="single_assortment">Sortimento único</option>
                  <option value="regionalized_assortment">Sortimento regionalizado</option>
                </select>
              </div>
              <div className="panel-field">
                <label>Seleção de entrega antes da compra</label>
                <select
                  className="panel-select"
                  value={settings.operation.deliverySelectionMode}
                  onChange={(event) =>
                    updateSettings({
                      ...settings,
                      operation: {
                        ...settings.operation,
                        deliverySelectionMode: event.target.value as LogisticsSettings['operation']['deliverySelectionMode'],
                      },
                    })
                  }
                >
                  <option value="optional">Opcional</option>
                  <option value="required">Obrigatória</option>
                </select>
              </div>
              <div className="panel-field">
                <label>Modelo de atendimento</label>
                <select
                  className="panel-select"
                  value={settings.operation.fulfillmentModel}
                  onChange={(event) =>
                    updateSettings({
                      ...settings,
                      operation: {
                        ...settings.operation,
                        fulfillmentModel: event.target.value as LogisticsSettings['operation']['fulfillmentModel'],
                      },
                    })
                  }
                >
                  <option value="single_origin">Origem única</option>
                  <option value="multi_origin">Múltiplas origens</option>
                </select>
              </div>
            </div>
          </div>
        </article>
      ) : null}

      {summary ? (
        <div className="panel-stats">
          <article className="panel-stat">
            <span className="panel-muted">Origens ativas</span>
            <strong>{summary.activeOrigins}</strong>
            <span>{summary.deliveryEnabledOrigins} com entrega • {summary.pickupEnabledOrigins} com retirada</span>
          </article>
          <article className="panel-stat">
            <span className="panel-muted">Docas e políticas</span>
            <strong>{summary.activeDocks}</strong>
            <span>{summary.activePolicies} políticas ativas</span>
          </article>
          <article className="panel-stat">
            <span className="panel-muted">Cobertura</span>
            <strong>{summary.productsWithCoverage}</strong>
            <span>{summary.productsWithoutCoverage} produtos ainda sem cobertura</span>
          </article>
          <article className="panel-stat">
            <span className="panel-muted">Overrides manuais</span>
            <strong>{summary.activeManualOffers}</strong>
            <span>Preços/estoques específicos por origem</span>
          </article>
        </div>
      ) : null}

      {loading ? <p className="panel-muted">Carregando central logística...</p> : null}

      {!loading && settings ? (
        <>
          <div className="panel-logistics-sections">
            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Origens e docas</h2>
                  <p className="panel-muted">Defina quem vende, de onde sai o estoque e quais docas operam entrega ou retirada.</p>
                </div>
                <div className="panel-inline-actions">
                  <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addOrigin}>Nova origem</button>
                  <button type="button" className="panel-btn panel-btn-danger panel-btn-sm" onClick={removeOrigin} disabled={!selectedOrigin}>Remover</button>
                </div>
              </div>

              <div className="panel-workspace panel-workspace--logistics">
                <aside className="panel-workspace__sidebar">
                  <div className="panel-order-list">
                    {settings.origins.map((origin) => (
                      <button
                        key={origin.id}
                        type="button"
                        className={`panel-order-list__item ${selectedOriginId === origin.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedOriginId(origin.id)}
                      >
                        <div className="panel-order-list__head">
                          <strong>{origin.name}</strong>
                          <span className={`panel-badge ${origin.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                            {origin.active ? 'ativa' : 'pausada'}
                          </span>
                        </div>
                        <div className="panel-order-list__meta">
                          <span>{origin.code}</span>
                          <span>{origin.type}</span>
                          <span>prioridade {origin.priority}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="panel-workspace__content panel-logistics-content">
                  {selectedOrigin ? (
                    <>
                      <div className="panel-form-grid panel-logistics-form-grid">
                        <div className="panel-form-row">
                          <div className="panel-field">
                            <label>Nome operacional</label>
                            <input className="panel-input" value={selectedOrigin.name} onChange={(event) => updateOrigin({ name: event.target.value })} />
                          </div>
                          <div className="panel-field">
                            <label>Código</label>
                            <input className="panel-input" value={selectedOrigin.code} onChange={(event) => updateOrigin({ code: event.target.value.toUpperCase() })} />
                          </div>
                          <div className="panel-field">
                            <label>Tipo</label>
                            <select className="panel-select" value={selectedOrigin.type} onChange={(event) => updateOrigin({ type: event.target.value as LogisticsOrigin['type'] })}>
                              <option value="store">Loja</option>
                              <option value="warehouse">Estoque</option>
                              <option value="distribution_center">Centro de distribuição</option>
                              <option value="seller">Seller</option>
                            </select>
                          </div>
                        </div>

                        <div className="panel-form-row">
                          <div className="panel-field">
                            <label>Seller ID</label>
                            <input className="panel-input" value={selectedOrigin.sellerId || ''} onChange={(event) => updateOrigin({ sellerId: event.target.value || undefined })} />
                          </div>
                          <div className="panel-field">
                            <label>Seller name</label>
                            <input className="panel-input" value={selectedOrigin.sellerName || ''} onChange={(event) => updateOrigin({ sellerName: event.target.value || undefined })} />
                          </div>
                          <div className="panel-field">
                            <label>Prioridade</label>
                            <input className="panel-input" type="number" min={1} value={selectedOrigin.priority} onChange={(event) => updateOrigin({ priority: Number(event.target.value || 1) })} />
                          </div>
                        </div>

                        <div className="panel-form-row">
                          <div className="panel-field">
                            <label>Locais de estoque vinculados</label>
                            <input className="panel-input" value={joinCsv(selectedOrigin.inventoryLocationIds)} onChange={(event) => updateOrigin({ inventoryLocationIds: splitCsv(event.target.value) })} />
                          </div>
                          <div className="panel-field">
                            <label>Faixas de CEP priorizadas</label>
                            <input className="panel-input" value={joinCsv(selectedOrigin.postalCodePrefixes)} onChange={(event) => updateOrigin({ postalCodePrefixes: splitCsv(event.target.value) })} />
                          </div>
                          <div className="panel-field">
                            <label>Raio de serviço (km)</label>
                            <input className="panel-input" type="number" min={0} value={selectedOrigin.serviceRadiusKm || 0} onChange={(event) => updateOrigin({ serviceRadiusKm: Number(event.target.value || 0) || undefined })} />
                          </div>
                        </div>

                        <div className="panel-form-row">
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedOrigin.active} onChange={(event) => updateOrigin({ active: event.target.checked })} />Origem ativa</label>
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedOrigin.supportsDelivery} onChange={(event) => updateOrigin({ supportsDelivery: event.target.checked })} />Entrega habilitada</label>
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedOrigin.supportsPickup} onChange={(event) => updateOrigin({ supportsPickup: event.target.checked })} />Retirada habilitada</label>
                        </div>

                        <div className="panel-form-row">
                          <div className="panel-field">
                            <label>Rua</label>
                            <input className="panel-input" value={selectedOrigin.address.street || ''} onChange={(event) => updateOriginAddress('street', event.target.value)} />
                          </div>
                          <div className="panel-field">
                            <label>Número</label>
                            <input className="panel-input" value={selectedOrigin.address.number || ''} onChange={(event) => updateOriginAddress('number', event.target.value)} />
                          </div>
                          <div className="panel-field">
                            <label>CEP</label>
                            <input className="panel-input" value={selectedOrigin.address.postalCode || ''} onChange={(event) => updateOriginAddress('postalCode', event.target.value)} />
                          </div>
                        </div>

                        <div className="panel-form-row">
                          <div className="panel-field">
                            <label>Bairro</label>
                            <input className="panel-input" value={selectedOrigin.address.neighborhood || ''} onChange={(event) => updateOriginAddress('neighborhood', event.target.value)} />
                          </div>
                          <div className="panel-field">
                            <label>Cidade</label>
                            <input className="panel-input" value={selectedOrigin.address.city || ''} onChange={(event) => updateOriginAddress('city', event.target.value)} />
                          </div>
                          <div className="panel-field">
                            <label>UF</label>
                            <input className="panel-input" value={selectedOrigin.address.state || ''} onChange={(event) => updateOriginAddress('state', event.target.value.toUpperCase())} />
                          </div>
                        </div>
                      </div>

                      <div className="panel-card panel-card-subtle">
                        <div className="panel-card-header">
                          <div className="panel-card-header__copy">
                            <h3>Docas da origem</h3>
                            <p className="panel-muted">Cutoff, tempo de manuseio e janela de retirada.</p>
                          </div>
                          <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addDock}>Nova doca</button>
                        </div>
                        <div className="panel-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Doca</th>
                                <th>Modos</th>
                                <th>Handling</th>
                                <th>Cutoff</th>
                                <th>Retirada</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {docksForSelectedOrigin.map((dock) => (
                                <tr key={dock.id}>
                                  <td><input className="panel-input" value={dock.name} onChange={(event) => updateDock(dock.id, { name: event.target.value })} /></td>
                                  <td><input className="panel-input" value={joinCsv(dock.serviceModes)} onChange={(event) => updateDock(dock.id, { serviceModes: splitCsv(event.target.value) as LogisticsDock['serviceModes'] })} /></td>
                                  <td><input className="panel-input" type="number" min={0} value={dock.handlingHours} onChange={(event) => updateDock(dock.id, { handlingHours: Number(event.target.value || 0) })} /></td>
                                  <td><input className="panel-input" value={dock.cutoffTime || ''} onChange={(event) => updateDock(dock.id, { cutoffTime: event.target.value || undefined })} /></td>
                                  <td><input className="panel-input" value={dock.pickupWindowLabel || ''} onChange={(event) => updateDock(dock.id, { pickupWindowLabel: event.target.value || undefined })} /></td>
                                  <td><button type="button" className="panel-btn panel-btn-danger panel-btn-sm" onClick={() => removeDock(dock.id)}>Excluir</button></td>
                                </tr>
                              ))}
                              {!docksForSelectedOrigin.length ? (
                                <tr>
                                  <td colSpan={6} className="panel-table-empty">Nenhuma doca cadastrada para esta origem.</td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="panel-muted">Selecione uma origem para editar seus dados e docas.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Cobertura e SLA</h2>
                  <p className="panel-muted">Defina zonas operacionais e políticas de serviço usadas nas cotações.</p>
                </div>
              </div>

              <div className="panel-workspace panel-workspace--logistics">
                <aside className="panel-workspace__sidebar">
                  <div className="panel-card panel-card-subtle">
                    <div className="panel-inline-actions">
                      <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addZone}>Nova zona</button>
                      <button type="button" className="panel-btn panel-btn-danger panel-btn-sm" onClick={removeZone} disabled={!selectedZone}>Remover</button>
                    </div>
                    <div className="panel-order-list">
                      {settings.zones.map((zone) => (
                        <button key={zone.id} type="button" className={`panel-order-list__item ${selectedZoneId === zone.id ? 'is-active' : ''}`} onClick={() => setSelectedZoneId(zone.id)}>
                          <div className="panel-order-list__head">
                            <strong>{zone.name}</strong>
                            <span className={`panel-badge ${zone.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>{zone.active ? 'ativa' : 'pausada'}</span>
                          </div>
                          <div className="panel-order-list__meta">
                            <span>prioridade {zone.priority}</span>
                            <span>{zone.postalCodePrefixes.length} prefixos</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel-card panel-card-subtle">
                    <div className="panel-inline-actions">
                      <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addPolicy}>Nova política</button>
                      <button type="button" className="panel-btn panel-btn-danger panel-btn-sm" onClick={removePolicy} disabled={!selectedPolicy}>Remover</button>
                    </div>
                    <div className="panel-order-list">
                      {settings.policies.map((policy) => (
                        <button key={policy.id} type="button" className={`panel-order-list__item ${selectedPolicyId === policy.id ? 'is-active' : ''}`} onClick={() => setSelectedPolicyId(policy.id)}>
                          <div className="panel-order-list__head">
                            <strong>{policy.name}</strong>
                            <span className={`panel-badge ${policy.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>{policy.active ? 'ativa' : 'pausada'}</span>
                          </div>
                          <div className="panel-order-list__meta">
                            <span>{policy.serviceMode}</span>
                            <span>{policy.shippingClass}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>

                <div className="panel-workspace__content panel-logistics-content">
                  {selectedZone ? (
                    <div className="panel-card panel-card-subtle">
                      <h3>Zona selecionada</h3>
                      <div className="panel-form-grid panel-logistics-form-grid">
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Nome</label><input className="panel-input" value={selectedZone.name} onChange={(event) => updateZone({ name: event.target.value })} /></div>
                          <div className="panel-field"><label>Prioridade</label><input className="panel-input" type="number" min={1} value={selectedZone.priority} onChange={(event) => updateZone({ priority: Number(event.target.value || 1) })} /></div>
                          <div className="panel-field"><label>Modos</label><input className="panel-input" value={joinCsv(selectedZone.serviceModes)} onChange={(event) => updateZone({ serviceModes: splitCsv(event.target.value) as LogisticsZone['serviceModes'] })} /></div>
                        </div>
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Prefixos de CEP</label><input className="panel-input" value={joinCsv(selectedZone.postalCodePrefixes)} onChange={(event) => updateZone({ postalCodePrefixes: splitCsv(event.target.value) })} /></div>
                          <div className="panel-field"><label>UFs</label><input className="panel-input" value={joinCsv(selectedZone.states)} onChange={(event) => updateZone({ states: splitCsv(event.target.value).map((item) => item.toUpperCase()) })} /></div>
                          <div className="panel-field"><label>Cidades</label><input className="panel-input" value={joinCsv(selectedZone.cities)} onChange={(event) => updateZone({ cities: splitCsv(event.target.value) })} /></div>
                        </div>
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Ajuste de frete</label><input className="panel-input" type="number" step="0.01" value={selectedZone.feeAdjustment} onChange={(event) => updateZone({ feeAdjustment: Number(event.target.value || 0) })} /></div>
                          <div className="panel-field"><label>Ajuste de prazo (dias)</label><input className="panel-input" type="number" value={selectedZone.leadTimeAdjustmentDays} onChange={(event) => updateZone({ leadTimeAdjustmentDays: Number(event.target.value || 0) })} /></div>
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedZone.sameDayEligible} onChange={(event) => updateZone({ sameDayEligible: event.target.checked })} />Mesmo dia permitido</label>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedPolicy ? (
                    <div className="panel-card panel-card-subtle">
                      <h3>Política selecionada</h3>
                      <div className="panel-form-grid panel-logistics-form-grid">
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Nome</label><input className="panel-input" value={selectedPolicy.name} onChange={(event) => updatePolicy({ name: event.target.value })} /></div>
                          <div className="panel-field">
                            <label>Modo</label>
                            <select className="panel-select" value={selectedPolicy.serviceMode} onChange={(event) => updatePolicy({ serviceMode: event.target.value as LogisticsPolicy['serviceMode'] })}>
                              <option value="delivery">delivery</option>
                              <option value="pickup">pickup</option>
                            </select>
                          </div>
                          <div className="panel-field">
                            <label>Classe</label>
                            <select className="panel-select" value={selectedPolicy.shippingClass} onChange={(event) => updatePolicy({ shippingClass: event.target.value as LogisticsPolicy['shippingClass'] })}>
                              <option value="standard">standard</option>
                              <option value="express">express</option>
                              <option value="bulky">bulky</option>
                              <option value="cold_chain">cold_chain</option>
                              <option value="fragile">fragile</option>
                              <option value="any">any</option>
                            </select>
                          </div>
                        </div>
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Base de frete</label><input className="panel-input" type="number" step="0.01" value={selectedPolicy.basePrice} onChange={(event) => updatePolicy({ basePrice: Number(event.target.value || 0) })} /></div>
                          <div className="panel-field"><label>Por item</label><input className="panel-input" type="number" step="0.01" value={selectedPolicy.pricePerItem} onChange={(event) => updatePolicy({ pricePerItem: Number(event.target.value || 0) })} /></div>
                          <div className="panel-field"><label>Frete grátis a partir de</label><input className="panel-input" type="number" step="0.01" value={selectedPolicy.freeShippingFrom || 0} onChange={(event) => updatePolicy({ freeShippingFrom: Number(event.target.value || 0) || undefined })} /></div>
                        </div>
                        <div className="panel-form-row">
                          <div className="panel-field"><label>Prazo mínimo</label><input className="panel-input" type="number" min={0} value={selectedPolicy.minDeliveryDays} onChange={(event) => updatePolicy({ minDeliveryDays: Number(event.target.value || 0) })} /></div>
                          <div className="panel-field"><label>Prazo máximo</label><input className="panel-input" type="number" min={0} value={selectedPolicy.maxDeliveryDays} onChange={(event) => updatePolicy({ maxDeliveryDays: Number(event.target.value || 0) })} /></div>
                          <div className="panel-field"><label>Lead extra</label><input className="panel-input" type="number" min={0} value={selectedPolicy.extraLeadDays} onChange={(event) => updatePolicy({ extraLeadDays: Number(event.target.value || 0) })} /></div>
                        </div>
                        <div className="panel-form-row">
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedPolicy.active} onChange={(event) => updatePolicy({ active: event.target.checked })} />Política ativa</label>
                          <label className="panel-checkbox"><input type="checkbox" checked={selectedPolicy.sameDayEligible} onChange={(event) => updatePolicy({ sameDayEligible: event.target.checked })} />Mesmo dia</label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          </div>

          <article className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Ofertas por produto e origem</h2>
                <p className="panel-muted">Ajuste preço, estoque e prioridade por origem quando o valor base do catálogo não for suficiente.</p>
              </div>
              <div className="panel-inline-actions">
                <input className="panel-search" type="search" placeholder="Buscar produto ou origem" value={offerQuery} onChange={(event) => setOfferQuery(event.target.value)} />
                <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={addOffer}>Nova oferta manual</button>
                <button type="button" className="panel-btn panel-btn-danger panel-btn-sm" onClick={removeOffer} disabled={!selectedOffer}>Remover</button>
              </div>
            </div>

            <div className="panel-workspace panel-workspace--logistics">
              <aside className="panel-workspace__sidebar">
                <div className="panel-table-wrap panel-logistics-offers-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Origem</th>
                        <th>Fonte</th>
                        <th>Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOffers.slice(0, 60).map((offer) => (
                        <tr key={offer.id} className={selectedOfferId === offer.id ? 'is-active' : ''} onClick={() => setSelectedOfferId(offer.id)}>
                          <td>{offer.productName}</td>
                          <td>{offer.originName}</td>
                          <td>{offer.source}</td>
                          <td>{formatMoney(offer.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </aside>

                <div className="panel-workspace__content panel-logistics-content">
                {selectedOffer ? (
                  <div className="panel-form-grid panel-logistics-form-grid">
                    <div className="panel-form-row">
                      <div className="panel-field">
                        <label>Produto</label>
                        <select className="panel-select" value={selectedOffer.productId} onChange={(event) => updateOffer({ productId: event.target.value })}>
                          {productOptions.map((product) => (
                            <option key={product.id} value={product.id}>{product.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="panel-field">
                        <label>Origem</label>
                        <select className="panel-select" value={selectedOffer.originId} onChange={(event) => updateOffer({ originId: event.target.value })}>
                          {settings.origins.map((origin) => (
                            <option key={origin.id} value={origin.id}>{origin.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="panel-field">
                        <label>Doca</label>
                        <select className="panel-select" value={selectedOffer.dockId || ''} onChange={(event) => updateOffer({ dockId: event.target.value || undefined })}>
                          <option value="">Automática</option>
                          {settings.docks.filter((dock) => dock.originId === selectedOffer.originId).map((dock) => (
                            <option key={dock.id} value={dock.id}>{dock.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="panel-form-row">
                      <div className="panel-field"><label>Preço</label><input className="panel-input" type="number" step="0.01" value={selectedOffer.price || 0} onChange={(event) => updateOffer({ price: Number(event.target.value || 0) || undefined })} /></div>
                      <div className="panel-field"><label>Preço de lista</label><input className="panel-input" type="number" step="0.01" value={selectedOffer.listPrice || 0} onChange={(event) => updateOffer({ listPrice: Number(event.target.value || 0) || undefined })} /></div>
                      <div className="panel-field"><label>Prioridade</label><input className="panel-input" type="number" min={1} value={selectedOffer.priority} onChange={(event) => updateOffer({ priority: Number(event.target.value || 1) })} /></div>
                    </div>

                    <div className="panel-form-row">
                      <div className="panel-field"><label>Disponível</label><input className="panel-input" type="number" min={0} value={selectedOffer.availableQuantity || 0} onChange={(event) => updateOffer({ availableQuantity: Number(event.target.value || 0) || undefined })} /></div>
                      <div className="panel-field"><label>Reservado</label><input className="panel-input" type="number" min={0} value={selectedOffer.reservedQuantity || 0} onChange={(event) => updateOffer({ reservedQuantity: Number(event.target.value || 0) || undefined })} /></div>
                      <div className="panel-field"><label>Em entrada</label><input className="panel-input" type="number" min={0} value={selectedOffer.incomingQuantity || 0} onChange={(event) => updateOffer({ incomingQuantity: Number(event.target.value || 0) || undefined })} /></div>
                    </div>

                    <div className="panel-form-row">
                      <div className="panel-field"><label>Lead time (dias)</label><input className="panel-input" type="number" min={0} value={selectedOffer.leadTimeDays || 0} onChange={(event) => updateOffer({ leadTimeDays: Number(event.target.value || 0) || undefined })} /></div>
                      <div className="panel-field"><label>Modos</label><input className="panel-input" value={joinCsv(selectedOffer.serviceModes)} onChange={(event) => updateOffer({ serviceModes: splitCsv(event.target.value) as LogisticsManualOffer['serviceModes'] })} /></div>
                      <div className="panel-field"><label>Classe logística</label>
                        <select className="panel-select" value={selectedOffer.shippingClass || 'standard'} onChange={(event) => updateOffer({ shippingClass: event.target.value as LogisticsManualOffer['shippingClass'] })}>
                          <option value="standard">standard</option>
                          <option value="express">express</option>
                          <option value="bulky">bulky</option>
                          <option value="cold_chain">cold_chain</option>
                          <option value="fragile">fragile</option>
                        </select>
                      </div>
                    </div>

                    <div className="panel-form-row">
                      <div className="panel-field"><label>Zonas permitidas</label><input className="panel-input" value={joinCsv(selectedOffer.zoneIds)} onChange={(event) => updateOffer({ zoneIds: splitCsv(event.target.value) })} /></div>
                      <div className="panel-field"><label>Políticas permitidas</label><input className="panel-input" value={joinCsv(selectedOffer.policyIds)} onChange={(event) => updateOffer({ policyIds: splitCsv(event.target.value) })} /></div>
                      <div className="panel-field"><label>Grupo de substituição</label><input className="panel-input" value={selectedOffer.substitutionGroup || ''} onChange={(event) => updateOffer({ substitutionGroup: event.target.value || undefined })} /></div>
                    </div>

                    <div className="panel-form-row">
                      <label className="panel-checkbox"><input type="checkbox" checked={selectedOffer.active} onChange={(event) => updateOffer({ active: event.target.checked })} />Oferta ativa</label>
                      <label className="panel-checkbox"><input type="checkbox" checked={selectedOffer.allowSubstitution} onChange={(event) => updateOffer({ allowSubstitution: event.target.checked })} />Permitir substituição</label>
                    </div>
                  </div>
                ) : (
                  <p className="panel-muted">Crie uma oferta manual quando precisar sobrescrever preço, estoque ou prioridade por origem.</p>
                )}
              </div>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
