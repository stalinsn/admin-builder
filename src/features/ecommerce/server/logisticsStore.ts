import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { randomToken } from '@/features/ecommpanel/server/crypto';
import {
  getPanelSettingFromDatabase,
  upsertPanelSettingInDatabase,
} from '@/features/ecommpanel/server/panelSettingsDatabaseStore';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import type { CatalogProduct } from '@/features/catalog/types';
import {
  createDefaultLogisticsSettings,
  LOGISTICS_SCHEMA_VERSION,
  normalizeShippingClass,
  normalizeLogisticsSettings,
  normalizeString,
  normalizeStringList,
} from '@/features/ecommerce/server/logisticsStore.shared';
import type { Address } from '@/features/ecommerce/types/orderForm';
import type {
  LogisticsDock,
  LogisticsEffectiveOffer,
  LogisticsManualOffer,
  LogisticsOperationalSummary,
  LogisticsOrigin,
  LogisticsPolicy,
  LogisticsQuoteOption,
  LogisticsServiceMode,
  LogisticsSettings,
  LogisticsSimulationAllocation,
  LogisticsSimulationItemInput,
  LogisticsSimulationResult,
  LogisticsShippingClass,
  LogisticsZone,
} from '@/features/ecommerce/types/logistics';

const LOGISTICS_SETTINGS_KEY = 'logistics-settings';
const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/logistics');
const SETTINGS_FILE = path.join(ROOT_DIR, 'settings.json');

type LogisticsPersistenceMode = 'files' | 'hybrid' | 'database';

type RegionalizedCoverageInput = {
  productIds?: string[];
  postalCode?: string;
  address?: Address | null;
  mode?: LogisticsServiceMode;
};

declare global {
  var __ECOM_LOGISTICS_SETTINGS_CACHE__: LogisticsSettings | undefined;
  var __ECOM_LOGISTICS_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

async function loadCatalogProductsDetailedRuntime() {
  const runtime = await import('@/features/catalog/server/catalogStore');
  return runtime.listCatalogProductsDetailedRuntime();
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpFile, payload, 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

export async function getLogisticsStorefrontSettingsRuntime() {
  const settings = await getLogisticsSettingsRuntime();
  return {
    operation: settings.operation,
  };
}

export async function shouldApplyRegionalizationRuntime(): Promise<boolean> {
  const settings = await getLogisticsSettingsRuntime();
  return settings.operation.assortmentMode === 'regionalized_assortment';
}

export async function requiresDeliverySelectionRuntime(): Promise<boolean> {
  const settings = await getLogisticsSettingsRuntime();
  return settings.operation.deliverySelectionMode === 'required';
}

function getPersistenceMode(): LogisticsPersistenceMode {
  const value = process.env.ECOM_LOGISTICS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function getFileSettings(): LogisticsSettings {
  if (!global.__ECOM_LOGISTICS_SETTINGS_CACHE__) {
    const normalized = normalizeLogisticsSettings(readJsonFile<LogisticsSettings>(SETTINGS_FILE));
    writeJsonAtomic(SETTINGS_FILE, normalized);
    global.__ECOM_LOGISTICS_SETTINGS_CACHE__ = normalized;
  }

  return normalizeLogisticsSettings(global.__ECOM_LOGISTICS_SETTINGS_CACHE__);
}

function setFileSettings(settings: LogisticsSettings): LogisticsSettings {
  const normalized = normalizeLogisticsSettings({ ...settings, updatedAt: nowIso() });
  global.__ECOM_LOGISTICS_SETTINGS_CACHE__ = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

async function seedDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getPersistenceMode() !== 'hybrid') return;
  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__ECOM_LOGISTICS_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__ECOM_LOGISTICS_DB_FILE_SEEDED_KEYS__ = seededKeys;
  const seedKey = `${runtime.key}:${LOGISTICS_SETTINGS_KEY}`;
  if (seededKeys.has(seedKey)) return;

  const current = await getPanelSettingFromDatabase<LogisticsSettings>(LOGISTICS_SETTINGS_KEY);
  if (!current.available) return;
  if (current.value) {
    seededKeys.add(seedKey);
    return;
  }

  await upsertPanelSettingInDatabase(LOGISTICS_SETTINGS_KEY, getFileSettings());
  seededKeys.add(seedKey);
}

export async function getLogisticsSettingsRuntime(): Promise<LogisticsSettings> {
  const mode = getPersistenceMode();
  if (mode === 'files') return getFileSettings();

  if (mode === 'hybrid') {
    await seedDatabaseFromFilesIfNeeded();
  }

  const result = await getPanelSettingFromDatabase<LogisticsSettings>(LOGISTICS_SETTINGS_KEY);
  if (!result.available) {
    if (mode === 'database') {
      throw new Error('Configurações logísticas em modo database exigem PostgreSQL disponível.');
    }
    return getFileSettings();
  }

  const settings = result.value ? normalizeLogisticsSettings(result.value) : getFileSettings();
  if (!result.value) {
    await upsertPanelSettingInDatabase(LOGISTICS_SETTINGS_KEY, settings);
  }
  return settings;
}

export async function updateLogisticsSettingsRuntime(input: unknown): Promise<LogisticsSettings> {
  const normalized = normalizeLogisticsSettings({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });

  const mode = getPersistenceMode();
  if (mode !== 'database') {
    setFileSettings(normalized);
  }

  if (mode === 'files') return normalized;

  const result = await upsertPanelSettingInDatabase(LOGISTICS_SETTINGS_KEY, normalized);
  if (!result.available) {
    if (mode === 'database') {
      throw new Error('Não foi possível persistir a configuração logística no PostgreSQL.');
    }
    return normalized;
  }

  return normalizeLogisticsSettings(result.value);
}

function normalizePostalCode(value?: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function readProductRegionalizationList(product: CatalogProduct, key: string): string[] {
  const source = product.regionalization && typeof product.regionalization === 'object' ? (product.regionalization as Record<string, unknown>) : {};
  return normalizeStringList(source[key], 80);
}

function readProductShippingClass(product: CatalogProduct): LogisticsShippingClass {
  const logistics = product.logistics && typeof product.logistics === 'object' ? (product.logistics as Record<string, unknown>) : {};
  return normalizeShippingClass(logistics.shippingClass, 'standard');
}

function getManualOfferIndex(settings: LogisticsSettings): Set<string> {
  return new Set(settings.manualOffers.filter((offer) => offer.active).map((offer) => `${offer.productId}:${offer.originId}`));
}

function resolveProductServiceModes(product: CatalogProduct, origin: LogisticsOrigin): LogisticsServiceMode[] {
  const raw = readProductRegionalizationList(product, 'deliveryModes') as LogisticsServiceMode[];
  const next = raw.length ? raw.filter((mode) => mode === 'delivery' || mode === 'pickup') : [];
  const modes: LogisticsServiceMode[] = next.length ? next : ['delivery'];
  return modes.filter((mode) => (mode === 'pickup' ? origin.supportsPickup : origin.supportsDelivery));
}

function deriveOfferQuantities(product: CatalogProduct, origin: LogisticsOrigin) {
  const locations = Array.isArray(product.stock.warehouses) ? product.stock.warehouses : [];
  const matched = origin.inventoryLocationIds.length
    ? locations.filter((location) => origin.inventoryLocationIds.includes(location.id))
    : [];

  if (matched.length) {
    return matched.reduce(
      (acc, location) => ({
        availableQuantity: acc.availableQuantity + Number(location.availableQuantity || 0),
        reservedQuantity: acc.reservedQuantity + Number(location.reservedQuantity || 0),
        incomingQuantity: acc.incomingQuantity + Number(location.incomingQuantity || 0),
        leadTimeDays: Math.max(acc.leadTimeDays, Number(location.leadTimeDays || 0)),
      }),
      { availableQuantity: 0, reservedQuantity: 0, incomingQuantity: 0, leadTimeDays: 0 },
    );
  }

  if (!origin.inventoryLocationIds.length && origin.priority === 1) {
    return {
      availableQuantity: Number(product.stock.availableQuantity || 0),
      reservedQuantity: Number(product.stock.reservedQuantity || 0),
      incomingQuantity: Number(product.stock.incomingQuantity || 0),
      leadTimeDays: Number(product.stock.leadTimeDays || 0),
    };
  }

  return {
    availableQuantity: 0,
    reservedQuantity: 0,
    incomingQuantity: 0,
    leadTimeDays: Number(product.stock.leadTimeDays || 0),
  };
}

export async function listEffectiveLogisticsOffersRuntime(): Promise<LogisticsEffectiveOffer[]> {
  const [settings, products] = await Promise.all([getLogisticsSettingsRuntime(), loadCatalogProductsDetailedRuntime()]);
  const manualOfferIndex = getManualOfferIndex(settings);
  const docksByOrigin = new Map<string, LogisticsDock[]>();

  for (const dock of settings.docks.filter((item) => item.active)) {
    const current = docksByOrigin.get(dock.originId) || [];
    current.push(dock);
    docksByOrigin.set(dock.originId, current);
  }

  const manualOffers = settings.manualOffers
    .filter((offer) => offer.active)
    .map((offer) => {
      const product = products.find((item) => item.id === offer.productId);
      const origin = settings.origins.find((item) => item.id === offer.originId);
      if (!product || !origin) return null;
      return {
        id: offer.id,
        productId: product.id,
        productName: product.name,
        originId: origin.id,
        originName: origin.name,
        ...(origin.sellerId ? { sellerId: origin.sellerId } : {}),
        ...(origin.sellerName ? { sellerName: origin.sellerName } : {}),
        active: origin.active,
        source: 'manual' as const,
        price: offer.price ?? product.price,
        listPrice: offer.listPrice ?? product.listPrice,
        availableQuantity: offer.availableQuantity ?? Number(product.stock.availableQuantity || 0),
        reservedQuantity: offer.reservedQuantity ?? Number(product.stock.reservedQuantity || 0),
        incomingQuantity: offer.incomingQuantity ?? Number(product.stock.incomingQuantity || 0),
        leadTimeDays: offer.leadTimeDays ?? Number(product.stock.leadTimeDays || 0),
        shippingClass: offer.shippingClass ?? readProductShippingClass(product),
        serviceModes: offer.serviceModes.length ? offer.serviceModes : resolveProductServiceModes(product, origin),
        zoneIds: offer.zoneIds.length ? offer.zoneIds : settings.zones.filter((zone) => zone.active).map((zone) => zone.id),
        policyIds: offer.policyIds,
        dockId: offer.dockId || docksByOrigin.get(origin.id)?.[0]?.id,
        allowSubstitution: offer.allowSubstitution,
        substitutionGroup: offer.substitutionGroup,
      } satisfies LogisticsEffectiveOffer;
    })
    .filter(isDefined);

  const derivedOffers: LogisticsEffectiveOffer[] = [];

  for (const product of products) {
    for (const origin of settings.origins.filter((item) => item.active)) {
      const identity = `${product.id}:${origin.id}`;
      if (manualOfferIndex.has(identity)) continue;

      const quantities = deriveOfferQuantities(product, origin);
      const serviceModes = resolveProductServiceModes(product, origin);
      if (!serviceModes.length) continue;

      const productPostalPrefixes = readProductRegionalizationList(product, 'preferredPostalCodePrefixes');
      const zoneIds = settings.zones
        .filter((zone) => zone.active)
        .filter((zone) => {
          if (!productPostalPrefixes.length) return true;
          if (!zone.postalCodePrefixes.length) return true;
          return zone.postalCodePrefixes.some((prefix) =>
            productPostalPrefixes.some((productPrefix) => productPrefix.startsWith(prefix) || prefix.startsWith(productPrefix)),
          );
        })
        .map((zone) => zone.id);

      const policies = settings.policies
        .filter((policy) => policy.active)
        .filter((policy) => serviceModes.includes(policy.serviceMode))
        .filter((policy) => policy.shippingClass === 'any' || policy.shippingClass === readProductShippingClass(product));

      if (!zoneIds.length || !policies.length) continue;
      if (quantities.availableQuantity <= 0 && !product.stock.backorderable && !product.stock.allowOversell) continue;

      derivedOffers.push({
        id: `derived-${product.id}-${origin.id}`,
        productId: product.id,
        productName: product.name,
        originId: origin.id,
        originName: origin.name,
        ...(origin.sellerId ? { sellerId: origin.sellerId } : {}),
        ...(origin.sellerName ? { sellerName: origin.sellerName } : {}),
        active: true,
        source: 'derived',
        price: product.price,
        listPrice: product.listPrice,
        availableQuantity: quantities.availableQuantity,
        reservedQuantity: quantities.reservedQuantity,
        incomingQuantity: quantities.incomingQuantity,
        leadTimeDays: quantities.leadTimeDays,
        shippingClass: readProductShippingClass(product),
        serviceModes,
        zoneIds,
        policyIds: policies.map((policy) => policy.id),
        dockId: docksByOrigin.get(origin.id)?.[0]?.id,
        allowSubstitution: Boolean(readProductRegionalizationList(product, 'substitutionGroup').length),
        substitutionGroup: normalizeString(
          product.regionalization && typeof product.regionalization === 'object'
            ? (product.regionalization as Record<string, unknown>).substitutionGroup
            : '',
        ) || undefined,
      });
    }
  }

  return [...manualOffers, ...derivedOffers].sort((left, right) => {
    if (left.productName !== right.productName) return left.productName.localeCompare(right.productName);
    if (left.originName !== right.originName) return left.originName.localeCompare(right.originName);
    if (left.source !== right.source) return left.source === 'manual' ? -1 : 1;
    return left.price - right.price;
  });
}

function matchZones(settings: LogisticsSettings, postalCode?: string, address?: Address | null, mode?: LogisticsServiceMode): LogisticsZone[] {
  const cep = normalizePostalCode(postalCode || address?.postalCode);
  const state = normalizeString(address?.state, '', 2).toUpperCase();
  const city = normalizeString(address?.city, '', 120).toLowerCase();

  return settings.zones
    .filter((zone) => zone.active)
    .filter((zone) => !mode || zone.serviceModes.includes(mode))
    .filter((zone) => {
      const byCep = !zone.postalCodePrefixes.length || zone.postalCodePrefixes.some((prefix) => cep.startsWith(prefix));
      const byState = !zone.states.length || (state && zone.states.includes(state));
      const byCity = !zone.cities.length || (city && zone.cities.some((zoneCity) => zoneCity.toLowerCase() === city));
      return byCep && byState && byCity;
    })
    .sort((left, right) => left.priority - right.priority);
}

function pickPolicy(
  settings: LogisticsSettings,
  offer: LogisticsEffectiveOffer,
  mode: LogisticsServiceMode,
  strategy: 'cheapest' | 'fastest',
): LogisticsPolicy | null {
  const candidates = settings.policies
    .filter((policy) => policy.active)
    .filter((policy) => policy.serviceMode === mode)
    .filter((policy) => policy.shippingClass === 'any' || policy.shippingClass === offer.shippingClass)
    .filter((policy) => !offer.policyIds.length || offer.policyIds.includes(policy.id));

  if (!candidates.length) return null;

  const sorted = [...candidates].sort((left, right) => {
    if (strategy === 'fastest') {
      if (left.minDeliveryDays !== right.minDeliveryDays) return left.minDeliveryDays - right.minDeliveryDays;
      if (left.maxDeliveryDays !== right.maxDeliveryDays) return left.maxDeliveryDays - right.maxDeliveryDays;
      return left.basePrice - right.basePrice;
    }
    if (left.basePrice !== right.basePrice) return left.basePrice - right.basePrice;
    return left.minDeliveryDays - right.minDeliveryDays;
  });

  return sorted[0] || null;
}

function buildEstimateLabel(minDays: number, maxDays: number, mode: LogisticsServiceMode, sameDay: boolean): string {
  if (mode === 'pickup') {
    return sameDay ? 'Retire hoje' : minDays === 0 ? 'Retire no mesmo dia' : `Retire em ${Math.max(minDays, 1)} dia(s)`;
  }
  if (sameDay && minDays === 0 && maxDays <= 1) return 'Hoje ou no próximo dia útil';
  if (minDays === maxDays) return `${minDays} dia(s) útil(eis)`;
  return `${minDays}-${maxDays} dias úteis`;
}

function buildShippingOptionPrice(
  policy: LogisticsPolicy,
  zone: LogisticsZone | null,
  allocations: LogisticsSimulationAllocation[],
): { shippingPrice: number; minDays: number; maxDays: number; sameDay: boolean } {
  const totalItems = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const itemsValue = allocations.reduce((sum, allocation) => sum + allocation.lineTotal, 0);
  const zoneFee = zone?.feeAdjustment || 0;
  const shippingBase =
    policy.freeShippingFrom !== undefined && itemsValue >= policy.freeShippingFrom
      ? 0
      : policy.basePrice + policy.pricePerItem * totalItems + zoneFee;

  const leadTimeDays = Math.max(...allocations.map((allocation) => allocation.leadTimeDays), 0);
  const minDays = Math.max(0, policy.minDeliveryDays + policy.extraLeadDays + (zone?.leadTimeAdjustmentDays || 0) + leadTimeDays);
  const maxDays = Math.max(minDays, policy.maxDeliveryDays + policy.extraLeadDays + (zone?.leadTimeAdjustmentDays || 0) + leadTimeDays);

  return {
    shippingPrice: Number(shippingBase.toFixed(2)),
    minDays,
    maxDays,
    sameDay: Boolean(policy.sameDayEligible && zone?.sameDayEligible),
  };
}

function resolveOriginMap(settings: LogisticsSettings) {
  return new Map(settings.origins.map((origin) => [origin.id, origin]));
}

function buildGenericOptions(
  settings: LogisticsSettings,
  zones: LogisticsZone[],
  mode?: LogisticsServiceMode,
): LogisticsSimulationResult {
  const activeOrigins = settings.origins
    .filter((origin) => origin.active)
    .filter((origin) => !mode || (mode === 'pickup' ? origin.supportsPickup : origin.supportsDelivery))
    .filter((origin) => !origin.postalCodePrefixes.length || origin.postalCodePrefixes.some((prefix) => zones.some((zone) => zone.postalCodePrefixes.some((zonePrefix) => zonePrefix.startsWith(prefix) || prefix.startsWith(zonePrefix)))));

  const options = activeOrigins.flatMap((origin) => {
    const serviceModes: LogisticsServiceMode[] = mode ? [mode] : ['delivery', 'pickup'];
    return serviceModes
      .filter((serviceMode) => (serviceMode === 'pickup' ? origin.supportsPickup : origin.supportsDelivery))
      .map((serviceMode) => {
        const policy = settings.policies
          .filter((item) => item.active)
          .find((item) => item.serviceMode === serviceMode && (item.shippingClass === 'any' || item.shippingClass === 'standard'));
        if (!policy) return null;
        const zone = zones[0] || null;
        const pricing = buildShippingOptionPrice(policy, zone, []);
        return {
          id: `${serviceMode}-${origin.id}-${policy.id}`,
          label: serviceMode === 'pickup' ? `Retirar em ${origin.name}` : `Entrega por ${origin.name}`,
          mode: serviceMode,
          kind: serviceMode === 'pickup' ? 'pickup' : 'cheapest',
          price: pricing.shippingPrice,
          estimate: buildEstimateLabel(pricing.minDays, pricing.maxDays, serviceMode, pricing.sameDay),
          estimateDaysMin: pricing.minDays,
          estimateDaysMax: pricing.maxDays,
          itemValue: 0,
          totalValue: pricing.shippingPrice,
          originIds: [origin.id],
          originNames: [origin.name],
          policyIds: [policy.id],
          matchedZoneIds: zone ? [zone.id] : [],
          allocations: [],
          splitShipment: false,
          pickupAddress: serviceMode === 'pickup' ? origin.address : null,
          pickupInstructions: serviceMode === 'pickup' ? settings.docks.find((dock) => dock.originId === origin.id && dock.active)?.pickupWindowLabel : undefined,
        } satisfies LogisticsQuoteOption;
      })
      .filter(isDefined);
  });

  return {
    coverage: options.length ? 'covered' : 'unavailable',
    options,
    recommendedOptionId: options[0]?.id,
    matchedZoneIds: zones.map((zone) => zone.id),
    unmatchedItemIds: [],
  };
}

function buildSplitDeliveryOption(
  settings: LogisticsSettings,
  offers: LogisticsEffectiveOffer[],
  productsById: Map<string, CatalogProduct>,
  items: LogisticsSimulationItemInput[],
  zones: LogisticsZone[],
  strategy: 'cheapest' | 'fastest',
): LogisticsQuoteOption | null {
  const originMap = resolveOriginMap(settings);
  const allocations: LogisticsSimulationAllocation[] = [];
  const unmatchedItemIds: string[] = [];

  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) {
      unmatchedItemIds.push(item.productId);
      continue;
    }

    const candidates = offers
      .filter((offer) => offer.productId === item.productId)
      .filter((offer) => offer.active)
      .filter((offer) => offer.serviceModes.includes('delivery'))
      .filter((offer) => offer.availableQuantity >= item.quantity)
      .filter((offer) => !offer.zoneIds.length || offer.zoneIds.some((zoneId) => zones.some((zone) => zone.id === zoneId)));

    const selected = [...candidates].sort((left, right) => {
      if (strategy === 'fastest') {
        if (left.leadTimeDays !== right.leadTimeDays) return left.leadTimeDays - right.leadTimeDays;
        if (left.price !== right.price) return left.price - right.price;
      } else {
        if (left.price !== right.price) return left.price - right.price;
        if (left.leadTimeDays !== right.leadTimeDays) return left.leadTimeDays - right.leadTimeDays;
      }
      const leftOrigin = originMap.get(left.originId);
      const rightOrigin = originMap.get(right.originId);
      return (leftOrigin?.priority || 999) - (rightOrigin?.priority || 999);
    })[0];

    if (!selected) {
      unmatchedItemIds.push(item.productId);
      continue;
    }

    allocations.push({
      productId: item.productId,
      productName: selected.productName,
      quantity: item.quantity,
      originId: selected.originId,
      originName: selected.originName,
      offerId: selected.id,
      unitPrice: selected.price,
      listPrice: selected.listPrice,
      lineTotal: Number((selected.price * item.quantity).toFixed(2)),
      stockStatus: selected.availableQuantity >= item.quantity ? 'available' : 'partial',
      leadTimeDays: selected.leadTimeDays,
      sellerName: selected.sellerName,
      dockId: selected.dockId,
      shippingClass: selected.shippingClass,
      serviceMode: 'delivery',
    });
  }

  if (unmatchedItemIds.length || !allocations.length) return null;

  const groupedByOrigin = new Map<string, LogisticsSimulationAllocation[]>();
  for (const allocation of allocations) {
    const current = groupedByOrigin.get(allocation.originId) || [];
    current.push(allocation);
    groupedByOrigin.set(allocation.originId, current);
  }

  const policyIds = new Set<string>();
  const matchedZoneIds = new Set<string>();
  let shippingPrice = 0;
  let minDays = 0;
  let maxDays = 0;

  for (const [originId, originAllocations] of groupedByOrigin) {
    const representative = offers.find((offer) => offer.id === originAllocations[0]?.offerId);
    if (!representative) continue;
    const zone = zones.find((zone) => representative.zoneIds.includes(zone.id)) || zones[0] || null;
    const policy = pickPolicy(settings, representative, 'delivery', strategy);
    if (!policy) continue;

    const pricing = buildShippingOptionPrice(policy, zone, originAllocations);
    shippingPrice += pricing.shippingPrice;
    minDays = Math.max(minDays, pricing.minDays);
    maxDays = Math.max(maxDays, pricing.maxDays);
    policyIds.add(policy.id);
    if (zone) matchedZoneIds.add(zone.id);
  }

  const itemValue = Number(allocations.reduce((sum, allocation) => sum + allocation.lineTotal, 0).toFixed(2));
  const estimate = buildEstimateLabel(minDays, maxDays, 'delivery', minDays === 0);

  return {
    id: `delivery-${strategy}-${randomToken(6)}`,
    label: strategy === 'fastest' ? 'Entrega mais rápida' : 'Melhor custo de entrega',
    mode: 'delivery',
    kind: strategy,
    price: Number(shippingPrice.toFixed(2)),
    estimate,
    estimateDaysMin: minDays,
    estimateDaysMax: maxDays,
    itemValue,
    totalValue: Number((itemValue + shippingPrice).toFixed(2)),
    originIds: Array.from(groupedByOrigin.keys()),
    originNames: Array.from(groupedByOrigin.keys()).map((originId) => originMap.get(originId)?.name || originId),
    policyIds: Array.from(policyIds),
    matchedZoneIds: Array.from(matchedZoneIds),
    allocations,
    splitShipment: groupedByOrigin.size > 1,
  };
}

function buildPickupOptions(
  settings: LogisticsSettings,
  offers: LogisticsEffectiveOffer[],
  productsById: Map<string, CatalogProduct>,
  items: LogisticsSimulationItemInput[],
  zones: LogisticsZone[],
): LogisticsQuoteOption[] {
  const originMap = resolveOriginMap(settings);
  const origins = settings.origins.filter((origin) => origin.active && origin.supportsPickup);

  return origins.flatMap((origin) => {
    const allocations: LogisticsSimulationAllocation[] = [];
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) return [];
      const offer = offers
        .filter((candidate) => candidate.productId === item.productId)
        .filter((candidate) => candidate.active && candidate.originId === origin.id && candidate.serviceModes.includes('pickup'))
        .find((candidate) => candidate.availableQuantity >= item.quantity);
      if (!offer) return [];
      allocations.push({
        productId: item.productId,
        productName: offer.productName,
        quantity: item.quantity,
        originId: origin.id,
        originName: origin.name,
        offerId: offer.id,
        unitPrice: offer.price,
        listPrice: offer.listPrice,
        lineTotal: Number((offer.price * item.quantity).toFixed(2)),
        stockStatus: 'available',
        leadTimeDays: offer.leadTimeDays,
        sellerName: offer.sellerName,
        dockId: offer.dockId,
        shippingClass: offer.shippingClass,
        serviceMode: 'pickup',
      });
    }

    const representative = offers.find((offer) => offer.originId === origin.id && offer.serviceModes.includes('pickup'));
    if (!representative) return [];
    const zone = zones.find((candidate) => representative.zoneIds.includes(candidate.id)) || zones[0] || null;
    const policy = pickPolicy(settings, representative, 'pickup', 'fastest');
    if (!policy) return [];

    const pricing = buildShippingOptionPrice(policy, zone, allocations);
    const itemValue = Number(allocations.reduce((sum, allocation) => sum + allocation.lineTotal, 0).toFixed(2));

    return [
      {
        id: `pickup-${origin.id}`,
        label: `Retirar em ${origin.name}`,
        mode: 'pickup',
        kind: 'pickup',
        price: Number(pricing.shippingPrice.toFixed(2)),
        estimate: buildEstimateLabel(pricing.minDays, pricing.maxDays, 'pickup', pricing.sameDay),
        estimateDaysMin: pricing.minDays,
        estimateDaysMax: pricing.maxDays,
        itemValue,
        totalValue: Number((itemValue + pricing.shippingPrice).toFixed(2)),
        originIds: [origin.id],
        originNames: [origin.name],
        policyIds: [policy.id],
        matchedZoneIds: zone ? [zone.id] : [],
        allocations,
        splitShipment: false,
        pickupAddress: origin.address,
        pickupInstructions: settings.docks.find((dock) => dock.id === representative.dockId)?.pickupWindowLabel,
      },
    ];
  });
}

export async function simulateLogisticsRuntime(input: {
  postalCode?: string;
  address?: Address | null;
  mode?: LogisticsServiceMode;
  items?: LogisticsSimulationItemInput[];
}): Promise<LogisticsSimulationResult> {
  const [settings, offers, products] = await Promise.all([
    getLogisticsSettingsRuntime(),
    listEffectiveLogisticsOffersRuntime(),
    loadCatalogProductsDetailedRuntime(),
  ]);
  const zones = matchZones(settings, input.postalCode, input.address, input.mode);
  const items = Array.isArray(input.items) ? input.items.filter((item) => item.productId && item.quantity > 0) : [];

  if (!items.length) {
    const generic = buildGenericOptions(settings, zones, input.mode);
    return {
      ...generic,
      postalCode: normalizePostalCode(input.postalCode || input.address?.postalCode),
      mode: input.mode,
    };
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const options: LogisticsQuoteOption[] = [];
  const cheapest = buildSplitDeliveryOption(settings, offers, productsById, items, zones, 'cheapest');
  const fastest = buildSplitDeliveryOption(settings, offers, productsById, items, zones, 'fastest');
  const pickup = buildPickupOptions(settings, offers, productsById, items, zones);

  if (!input.mode || input.mode === 'delivery') {
    if (cheapest) options.push(cheapest);
    if (fastest && (!cheapest || fastest.id !== cheapest.id)) options.push(fastest);
  }

  if (!input.mode || input.mode === 'pickup') {
    options.push(...pickup);
  }

  const coverage = options.length ? 'covered' : 'unavailable';
  const recommendedOptionId = options[0]?.id;
  const unmatchedItemIds = coverage === 'unavailable' ? items.map((item) => item.productId) : [];

  return {
    coverage,
    postalCode: normalizePostalCode(input.postalCode || input.address?.postalCode),
    mode: input.mode,
    options,
    recommendedOptionId,
    matchedZoneIds: zones.map((zone) => zone.id),
    unmatchedItemIds,
  };
}

export async function getLogisticsOperationalSummaryRuntime(): Promise<LogisticsOperationalSummary> {
  const [settings, offers, products] = await Promise.all([
    getLogisticsSettingsRuntime(),
    listEffectiveLogisticsOffersRuntime(),
    loadCatalogProductsDetailedRuntime(),
  ]);
  const coveredProducts = new Set(offers.filter((offer) => offer.active && offer.availableQuantity > 0).map((offer) => offer.productId));

  return {
    activeOrigins: settings.origins.filter((origin) => origin.active).length,
    activeDocks: settings.docks.filter((dock) => dock.active).length,
    activeZones: settings.zones.filter((zone) => zone.active).length,
    activePolicies: settings.policies.filter((policy) => policy.active).length,
    activeManualOffers: settings.manualOffers.filter((offer) => offer.active).length,
    productsWithCoverage: coveredProducts.size,
    productsWithoutCoverage: Math.max(products.length - coveredProducts.size, 0),
    pickupEnabledOrigins: settings.origins.filter((origin) => origin.active && origin.supportsPickup).length,
    deliveryEnabledOrigins: settings.origins.filter((origin) => origin.active && origin.supportsDelivery).length,
  };
}

export async function getLogisticsAdminSnapshotRuntime() {
  const [settings, effectiveOffers, summary] = await Promise.all([
    getLogisticsSettingsRuntime(),
    listEffectiveLogisticsOffersRuntime(),
    getLogisticsOperationalSummaryRuntime(),
  ]);

  return {
    settings,
    effectiveOffers,
    summary,
  };
}

export async function getCoveredProductIdsForRegionalizationRuntime(input: RegionalizedCoverageInput): Promise<string[]> {
  const settings = await getLogisticsSettingsRuntime();
  const offers = await listEffectiveLogisticsOffersRuntime();
  const zones = matchZones(settings, input.postalCode, input.address, input.mode);
  const requestedIds = new Set((input.productIds || []).filter(Boolean));

  const covered = offers
    .filter((offer) => offer.active)
    .filter((offer) => offer.availableQuantity > 0)
    .filter((offer) => (requestedIds.size ? requestedIds.has(offer.productId) : true))
    .filter((offer) => (input.mode ? offer.serviceModes.includes(input.mode) : true))
    .filter((offer) => {
      if (!zones.length) return input.mode === 'pickup' || !input.postalCode;
      if (!offer.zoneIds.length) return true;
      return offer.zoneIds.some((zoneId) => zones.some((zone) => zone.id === zoneId));
    })
    .map((offer) => offer.productId);

  return Array.from(new Set(covered));
}
