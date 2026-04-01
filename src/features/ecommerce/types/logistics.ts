import type { Address } from './orderForm';

export type LogisticsServiceMode = 'delivery' | 'pickup';
export type LogisticsOriginType = 'store' | 'warehouse' | 'distribution_center' | 'seller';
export type LogisticsShippingClass = 'standard' | 'express' | 'bulky' | 'cold_chain' | 'fragile';
export type LogisticsAssortmentMode = 'single_assortment' | 'regionalized_assortment';
export type LogisticsDeliverySelectionMode = 'optional' | 'required';
export type LogisticsFulfillmentModel = 'single_origin' | 'multi_origin';

export type LogisticsGeoPoint = {
  lat: number;
  lng: number;
};

export type LogisticsOrigin = {
  id: string;
  code: string;
  name: string;
  type: LogisticsOriginType;
  active: boolean;
  priority: number;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  sellerId?: string;
  sellerName?: string;
  inventoryLocationIds: string[];
  address: Address & {
    label?: string;
    reference?: string;
  };
  postalCodePrefixes: string[];
  serviceRadiusKm?: number;
  geoPoint?: LogisticsGeoPoint | null;
  tags: string[];
  notes?: string;
};

export type LogisticsDock = {
  id: string;
  originId: string;
  name: string;
  active: boolean;
  serviceModes: LogisticsServiceMode[];
  handlingHours: number;
  cutoffTime?: string;
  pickupWindowLabel?: string;
  notes?: string;
};

export type LogisticsZone = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  serviceModes: LogisticsServiceMode[];
  postalCodePrefixes: string[];
  states: string[];
  cities: string[];
  feeAdjustment: number;
  leadTimeAdjustmentDays: number;
  sameDayEligible: boolean;
  notes?: string;
};

export type LogisticsPolicy = {
  id: string;
  name: string;
  active: boolean;
  serviceMode: LogisticsServiceMode;
  shippingClass: LogisticsShippingClass | 'any';
  basePrice: number;
  pricePerItem: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  extraLeadDays: number;
  sameDayEligible: boolean;
  freeShippingFrom?: number;
  minOrderValue?: number;
  maxWeightKg?: number;
  notes?: string;
};

export type LogisticsManualOffer = {
  id: string;
  productId: string;
  originId: string;
  active: boolean;
  price?: number;
  listPrice?: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  incomingQuantity?: number;
  leadTimeDays?: number;
  priority: number;
  dockId?: string;
  zoneIds: string[];
  policyIds: string[];
  serviceModes: LogisticsServiceMode[];
  shippingClass?: LogisticsShippingClass;
  allowSubstitution: boolean;
  substitutionGroup?: string;
  notes?: string;
};

export type LogisticsOperationSettings = {
  assortmentMode: LogisticsAssortmentMode;
  deliverySelectionMode: LogisticsDeliverySelectionMode;
  fulfillmentModel: LogisticsFulfillmentModel;
};

export type LogisticsSettings = {
  schemaVersion: number;
  updatedAt: string;
  operation: LogisticsOperationSettings;
  origins: LogisticsOrigin[];
  docks: LogisticsDock[];
  zones: LogisticsZone[];
  policies: LogisticsPolicy[];
  manualOffers: LogisticsManualOffer[];
};

export type LogisticsStorefrontSettings = {
  operation: LogisticsOperationSettings;
};

export type LogisticsEffectiveOffer = {
  id: string;
  productId: string;
  productName: string;
  originId: string;
  originName: string;
  sellerId?: string;
  sellerName?: string;
  active: boolean;
  source: 'manual' | 'derived';
  price: number;
  listPrice?: number;
  availableQuantity: number;
  reservedQuantity: number;
  incomingQuantity: number;
  leadTimeDays: number;
  shippingClass: LogisticsShippingClass;
  serviceModes: LogisticsServiceMode[];
  zoneIds: string[];
  policyIds: string[];
  dockId?: string;
  allowSubstitution: boolean;
  substitutionGroup?: string;
};

export type LogisticsSimulationItemInput = {
  productId: string;
  quantity: number;
};

export type LogisticsSimulationAllocation = {
  productId: string;
  productName: string;
  quantity: number;
  originId: string;
  originName: string;
  offerId: string;
  unitPrice: number;
  listPrice?: number;
  lineTotal: number;
  stockStatus: 'available' | 'partial' | 'unavailable';
  leadTimeDays: number;
  sellerName?: string;
  dockId?: string;
  shippingClass: LogisticsShippingClass;
  serviceMode: LogisticsServiceMode;
};

export type LogisticsQuoteOption = {
  id: string;
  label: string;
  mode: LogisticsServiceMode;
  kind: 'cheapest' | 'fastest' | 'pickup';
  price: number;
  estimate: string;
  estimateDaysMin: number;
  estimateDaysMax: number;
  itemValue: number;
  totalValue: number;
  originIds: string[];
  originNames: string[];
  policyIds: string[];
  matchedZoneIds: string[];
  allocations: LogisticsSimulationAllocation[];
  splitShipment: boolean;
  pickupAddress?: Address | null;
  pickupInstructions?: string;
};

export type LogisticsSimulationResult = {
  coverage: 'covered' | 'partial' | 'unavailable';
  postalCode?: string;
  mode?: LogisticsServiceMode;
  options: LogisticsQuoteOption[];
  recommendedOptionId?: string;
  matchedZoneIds: string[];
  unmatchedItemIds: string[];
};

export type LogisticsOperationalSummary = {
  activeOrigins: number;
  activeDocks: number;
  activeZones: number;
  activePolicies: number;
  activeManualOffers: number;
  productsWithCoverage: number;
  productsWithoutCoverage: number;
  pickupEnabledOrigins: number;
  deliveryEnabledOrigins: number;
};
