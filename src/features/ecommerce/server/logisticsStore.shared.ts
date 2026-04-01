import type {
  LogisticsAssortmentMode,
  LogisticsDeliverySelectionMode,
  LogisticsDock,
  LogisticsFulfillmentModel,
  LogisticsManualOffer,
  LogisticsOperationSettings,
  LogisticsOrigin,
  LogisticsPolicy,
  LogisticsServiceMode,
  LogisticsSettings,
  LogisticsShippingClass,
  LogisticsZone,
} from '@/features/ecommerce/types/logistics';

export const LOGISTICS_SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

export function normalizeString(value: unknown, fallback = '', maxLength = 200): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeInteger(value: unknown, fallback = 0, min = 0, max = 999999): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeNumber(value: unknown, fallback = 0, min = 0, max = 999999): number {
  const parsed = typeof value === 'number' ? value : Number(String(value || ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function normalizeStringList(value: unknown, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item, '', maxLength))
        .filter(Boolean),
    ),
  );
}

function normalizeServiceMode(value: unknown, fallback: LogisticsServiceMode = 'delivery'): LogisticsServiceMode {
  return value === 'pickup' ? 'pickup' : fallback;
}

function normalizeServiceModes(value: unknown, fallback: LogisticsServiceMode[] = ['delivery']): LogisticsServiceMode[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => normalizeServiceMode(item))
    .filter((item, index, source) => source.indexOf(item) === index);
  return items.length ? items : fallback;
}

function normalizeAssortmentMode(value: unknown, fallback: LogisticsAssortmentMode = 'single_assortment'): LogisticsAssortmentMode {
  return value === 'regionalized_assortment' ? value : fallback;
}

function normalizeDeliverySelectionMode(
  value: unknown,
  fallback: LogisticsDeliverySelectionMode = 'optional',
): LogisticsDeliverySelectionMode {
  return value === 'required' ? value : fallback;
}

function normalizeFulfillmentModel(
  value: unknown,
  fallback: LogisticsFulfillmentModel = 'single_origin',
): LogisticsFulfillmentModel {
  return value === 'multi_origin' ? value : fallback;
}

function normalizeOperationSettings(value: unknown): LogisticsOperationSettings {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    assortmentMode: normalizeAssortmentMode(source.assortmentMode, 'single_assortment'),
    deliverySelectionMode: normalizeDeliverySelectionMode(source.deliverySelectionMode, 'optional'),
    fulfillmentModel: normalizeFulfillmentModel(source.fulfillmentModel, 'single_origin'),
  };
}

export function normalizeShippingClass(value: unknown, fallback: LogisticsShippingClass = 'standard'): LogisticsShippingClass {
  switch (value) {
    case 'express':
    case 'bulky':
    case 'cold_chain':
    case 'fragile':
      return value;
    default:
      return fallback;
  }
}

function normalizeAddress(value: unknown): LogisticsOrigin['address'] {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    label: normalizeString(source.label, '', 80),
    street: normalizeString(source.street, '', 120),
    number: normalizeString(source.number, '', 20),
    complement: normalizeString(source.complement, '', 120),
    neighborhood: normalizeString(source.neighborhood, '', 120),
    city: normalizeString(source.city, '', 120),
    state: normalizeString(source.state, '', 2).toUpperCase(),
    postalCode: normalizeString(source.postalCode, '', 12),
    country: normalizeString(source.country, 'BR', 3).toUpperCase(),
    reference: normalizeString(source.reference, '', 120),
  };
}

function normalizeOrigin(input: unknown, index = 0): LogisticsOrigin {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    id: normalizeString(source.id, `origin-${index + 1}`, 80),
    code: normalizeString(source.code, `ORIG-${index + 1}`, 30).toUpperCase(),
    name: normalizeString(source.name, `Origem ${index + 1}`, 120),
    type: source.type === 'seller' || source.type === 'warehouse' || source.type === 'distribution_center' ? source.type : 'store',
    active: normalizeBoolean(source.active, true),
    priority: normalizeInteger(source.priority, index + 1, 1, 999),
    supportsDelivery: normalizeBoolean(source.supportsDelivery, true),
    supportsPickup: normalizeBoolean(source.supportsPickup, true),
    sellerId: normalizeString(source.sellerId, '', 60) || undefined,
    sellerName: normalizeString(source.sellerName, '', 120) || undefined,
    inventoryLocationIds: normalizeStringList(source.inventoryLocationIds, 80),
    address: normalizeAddress(source.address),
    postalCodePrefixes: normalizeStringList(source.postalCodePrefixes, 5).map((item) => item.replace(/\D/g, '').slice(0, 5)).filter(Boolean),
    serviceRadiusKm: normalizeNumber(source.serviceRadiusKm, 0, 0, 5000) || undefined,
    geoPoint:
      source.geoPoint && typeof source.geoPoint === 'object'
        ? {
            lat: normalizeNumber((source.geoPoint as Record<string, unknown>).lat, 0, -90, 90),
            lng: normalizeNumber((source.geoPoint as Record<string, unknown>).lng, 0, -180, 180),
          }
        : null,
    tags: normalizeStringList(source.tags, 40),
    notes: normalizeString(source.notes, '', 400) || undefined,
  };
}

function normalizeDock(input: unknown, index = 0): LogisticsDock {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    id: normalizeString(source.id, `dock-${index + 1}`, 80),
    originId: normalizeString(source.originId, '', 80),
    name: normalizeString(source.name, `Doca ${index + 1}`, 120),
    active: normalizeBoolean(source.active, true),
    serviceModes: normalizeServiceModes(source.serviceModes, ['delivery']),
    handlingHours: normalizeInteger(source.handlingHours, 4, 0, 240),
    cutoffTime: normalizeString(source.cutoffTime, '', 10) || undefined,
    pickupWindowLabel: normalizeString(source.pickupWindowLabel, '', 120) || undefined,
    notes: normalizeString(source.notes, '', 400) || undefined,
  };
}

function normalizeZone(input: unknown, index = 0): LogisticsZone {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    id: normalizeString(source.id, `zone-${index + 1}`, 80),
    name: normalizeString(source.name, `Zona ${index + 1}`, 120),
    active: normalizeBoolean(source.active, true),
    priority: normalizeInteger(source.priority, index + 1, 1, 999),
    serviceModes: normalizeServiceModes(source.serviceModes, ['delivery']),
    postalCodePrefixes: normalizeStringList(source.postalCodePrefixes, 5).map((item) => item.replace(/\D/g, '').slice(0, 5)).filter(Boolean),
    states: normalizeStringList(source.states, 2).map((item) => item.toUpperCase()),
    cities: normalizeStringList(source.cities, 120),
    feeAdjustment: normalizeNumber(source.feeAdjustment, 0, -9999, 9999),
    leadTimeAdjustmentDays: normalizeInteger(source.leadTimeAdjustmentDays, 0, -30, 365),
    sameDayEligible: normalizeBoolean(source.sameDayEligible, false),
    notes: normalizeString(source.notes, '', 400) || undefined,
  };
}

function normalizePolicy(input: unknown, index = 0): LogisticsPolicy {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    id: normalizeString(source.id, `policy-${index + 1}`, 80),
    name: normalizeString(source.name, `Política ${index + 1}`, 120),
    active: normalizeBoolean(source.active, true),
    serviceMode: normalizeServiceMode(source.serviceMode, 'delivery'),
    shippingClass: source.shippingClass === 'any' ? 'any' : normalizeShippingClass(source.shippingClass, 'standard'),
    basePrice: normalizeNumber(source.basePrice, 0, 0, 999999),
    pricePerItem: normalizeNumber(source.pricePerItem, 0, 0, 999999),
    minDeliveryDays: normalizeInteger(source.minDeliveryDays, 1, 0, 365),
    maxDeliveryDays: normalizeInteger(source.maxDeliveryDays, 2, 0, 365),
    extraLeadDays: normalizeInteger(source.extraLeadDays, 0, 0, 365),
    sameDayEligible: normalizeBoolean(source.sameDayEligible, false),
    freeShippingFrom: source.freeShippingFrom === undefined ? undefined : normalizeNumber(source.freeShippingFrom, 0, 0, 999999),
    minOrderValue: source.minOrderValue === undefined ? undefined : normalizeNumber(source.minOrderValue, 0, 0, 999999),
    maxWeightKg: source.maxWeightKg === undefined ? undefined : normalizeNumber(source.maxWeightKg, 0, 0, 99999),
    notes: normalizeString(source.notes, '', 400) || undefined,
  };
}

function normalizeManualOffer(input: unknown, index = 0): LogisticsManualOffer {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    id: normalizeString(source.id, `offer-${index + 1}`, 80),
    productId: normalizeString(source.productId, '', 80),
    originId: normalizeString(source.originId, '', 80),
    active: normalizeBoolean(source.active, true),
    price: source.price === undefined ? undefined : normalizeNumber(source.price, 0, 0, 999999),
    listPrice: source.listPrice === undefined ? undefined : normalizeNumber(source.listPrice, 0, 0, 999999),
    availableQuantity: source.availableQuantity === undefined ? undefined : normalizeInteger(source.availableQuantity, 0, 0, 999999),
    reservedQuantity: source.reservedQuantity === undefined ? undefined : normalizeInteger(source.reservedQuantity, 0, 0, 999999),
    incomingQuantity: source.incomingQuantity === undefined ? undefined : normalizeInteger(source.incomingQuantity, 0, 0, 999999),
    leadTimeDays: source.leadTimeDays === undefined ? undefined : normalizeInteger(source.leadTimeDays, 0, 0, 365),
    priority: normalizeInteger(source.priority, index + 1, 1, 999),
    dockId: normalizeString(source.dockId, '', 80) || undefined,
    zoneIds: normalizeStringList(source.zoneIds, 80),
    policyIds: normalizeStringList(source.policyIds, 80),
    serviceModes: normalizeServiceModes(source.serviceModes, ['delivery']),
    shippingClass: source.shippingClass === undefined ? undefined : normalizeShippingClass(source.shippingClass),
    allowSubstitution: normalizeBoolean(source.allowSubstitution, false),
    substitutionGroup: normalizeString(source.substitutionGroup, '', 120) || undefined,
    notes: normalizeString(source.notes, '', 400) || undefined,
  };
}

export function createDefaultLogisticsSettings(): LogisticsSettings {
  return {
    schemaVersion: LOGISTICS_SCHEMA_VERSION,
    updatedAt: nowIso(),
    operation: {
      assortmentMode: 'single_assortment',
      deliverySelectionMode: 'optional',
      fulfillmentModel: 'single_origin',
    },
    origins: [
      {
        id: 'origin-centro',
        code: 'LOJA-CENTRO',
        name: 'Loja Centro',
        type: 'store',
        active: true,
        priority: 1,
        supportsDelivery: true,
        supportsPickup: true,
        sellerId: '1',
        sellerName: 'Loja Principal',
        inventoryLocationIds: ['warehouse-1', 'cd-sp', 'CD-SP'],
        address: {
          label: 'Loja Centro',
          street: 'Rua das Flores',
          number: '123',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01000-000',
          country: 'BR',
        },
        postalCodePrefixes: ['01', '02', '03', '04', '05'],
        serviceRadiusKm: 18,
        tags: ['capital', 'loja'],
      },
      {
        id: 'origin-zona-sul',
        code: 'CD-ZS',
        name: 'Centro de Distribuição Zona Sul',
        type: 'distribution_center',
        active: true,
        priority: 2,
        supportsDelivery: true,
        supportsPickup: false,
        sellerId: '1',
        sellerName: 'Loja Principal',
        inventoryLocationIds: ['warehouse-2', 'cd-rj', 'CD-RJ'],
        address: {
          label: 'CD Zona Sul',
          street: 'Avenida do Comércio',
          number: '455',
          neighborhood: 'Zona Sul',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '04700-000',
          country: 'BR',
        },
        postalCodePrefixes: ['04', '05', '06', '07', '08', '09'],
        serviceRadiusKm: 35,
        tags: ['cd', 'sudeste'],
      },
      {
        id: 'origin-marketplace-leste',
        code: 'MKP-LESTE',
        name: 'Seller Parceiro Leste',
        type: 'seller',
        active: true,
        priority: 3,
        supportsDelivery: true,
        supportsPickup: true,
        sellerId: 'seller-east',
        sellerName: 'Parceiro Leste',
        inventoryLocationIds: [],
        address: {
          label: 'Parceiro Leste',
          street: 'Rua da Esperança',
          number: '789',
          neighborhood: 'Vila Nova',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '03000-000',
          country: 'BR',
        },
        postalCodePrefixes: ['03', '04', '08'],
        serviceRadiusKm: 12,
        tags: ['seller', 'marketplace'],
      },
    ],
    docks: [
      {
        id: 'dock-centro-standard',
        originId: 'origin-centro',
        name: 'Doca padrão Centro',
        active: true,
        serviceModes: ['delivery', 'pickup'],
        handlingHours: 3,
        cutoffTime: '15:00',
        pickupWindowLabel: 'Retirada em até 2h após confirmação',
      },
      {
        id: 'dock-zs-standard',
        originId: 'origin-zona-sul',
        name: 'Expedição Zona Sul',
        active: true,
        serviceModes: ['delivery'],
        handlingHours: 6,
        cutoffTime: '13:00',
      },
      {
        id: 'dock-leste-pickup',
        originId: 'origin-marketplace-leste',
        name: 'Retirada Seller Leste',
        active: true,
        serviceModes: ['pickup', 'delivery'],
        handlingHours: 4,
        cutoffTime: '14:30',
        pickupWindowLabel: 'Retire hoje até 20h',
      },
    ],
    zones: [
      {
        id: 'zone-sp-capital',
        name: 'São Paulo capital',
        active: true,
        priority: 1,
        serviceModes: ['delivery', 'pickup'],
        postalCodePrefixes: ['01', '02', '03', '04', '05'],
        states: ['SP'],
        cities: ['São Paulo'],
        feeAdjustment: 0,
        leadTimeAdjustmentDays: 0,
        sameDayEligible: true,
      },
      {
        id: 'zone-sp-metropolitana',
        name: 'Região metropolitana',
        active: true,
        priority: 2,
        serviceModes: ['delivery', 'pickup'],
        postalCodePrefixes: ['06', '07', '08', '09'],
        states: ['SP'],
        cities: [],
        feeAdjustment: 6,
        leadTimeAdjustmentDays: 1,
        sameDayEligible: false,
      },
      {
        id: 'zone-sudeste-expandida',
        name: 'Sudeste expandido',
        active: true,
        priority: 3,
        serviceModes: ['delivery'],
        postalCodePrefixes: ['10', '11', '12', '13', '20', '21', '22', '30', '31'],
        states: ['SP', 'RJ', 'MG', 'ES'],
        cities: [],
        feeAdjustment: 14,
        leadTimeAdjustmentDays: 2,
        sameDayEligible: false,
      },
    ],
    policies: [
      {
        id: 'policy-delivery-standard',
        name: 'Entrega padrão',
        active: true,
        serviceMode: 'delivery',
        shippingClass: 'standard',
        basePrice: 9.9,
        pricePerItem: 0.4,
        minDeliveryDays: 1,
        maxDeliveryDays: 2,
        extraLeadDays: 0,
        sameDayEligible: true,
        freeShippingFrom: 199,
      },
      {
        id: 'policy-delivery-express',
        name: 'Entrega expressa',
        active: true,
        serviceMode: 'delivery',
        shippingClass: 'express',
        basePrice: 18.9,
        pricePerItem: 0.8,
        minDeliveryDays: 0,
        maxDeliveryDays: 1,
        extraLeadDays: 0,
        sameDayEligible: true,
      },
      {
        id: 'policy-delivery-bulky',
        name: 'Entrega volumosa',
        active: true,
        serviceMode: 'delivery',
        shippingClass: 'bulky',
        basePrice: 29.9,
        pricePerItem: 3.5,
        minDeliveryDays: 2,
        maxDeliveryDays: 5,
        extraLeadDays: 1,
        sameDayEligible: false,
      },
      {
        id: 'policy-pickup-standard',
        name: 'Retirada em loja',
        active: true,
        serviceMode: 'pickup',
        shippingClass: 'any',
        basePrice: 0,
        pricePerItem: 0,
        minDeliveryDays: 0,
        maxDeliveryDays: 0,
        extraLeadDays: 0,
        sameDayEligible: true,
      },
    ],
    manualOffers: [],
  };
}

export function normalizeLogisticsSettings(input: unknown): LogisticsSettings {
  const fallback = createDefaultLogisticsSettings();
  const source = input && typeof input === 'object' ? (input as Partial<LogisticsSettings>) : {};

  return {
    schemaVersion: LOGISTICS_SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    operation: normalizeOperationSettings(source.operation ?? fallback.operation),
    origins: Array.isArray(source.origins) ? source.origins.map(normalizeOrigin).filter((origin) => origin.id && origin.name) : fallback.origins,
    docks: Array.isArray(source.docks) ? source.docks.map(normalizeDock).filter((dock) => dock.id && dock.originId && dock.name) : fallback.docks,
    zones: Array.isArray(source.zones) ? source.zones.map(normalizeZone).filter((zone) => zone.id && zone.name) : fallback.zones,
    policies: Array.isArray(source.policies) ? source.policies.map(normalizePolicy).filter((policy) => policy.id && policy.name) : fallback.policies,
    manualOffers: Array.isArray(source.manualOffers)
      ? source.manualOffers.map(normalizeManualOffer).filter((offer) => offer.id && offer.productId && offer.originId)
      : fallback.manualOffers,
  };
}
