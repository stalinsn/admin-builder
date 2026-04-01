import type { Address, ClientProfileData, OrderFormItem, ShippingOption, Totalizer } from './orderForm';

export type CommerceOrderDraftStatus = 'active' | 'converted' | 'abandoned' | 'expired';
export type CommerceOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'review'
  | 'preparing'
  | 'partially_updated'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
export type CommerceOrderFinancialStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled';
export type CommerceOrderFulfillmentStatus =
  | 'pending'
  | 'allocating'
  | 'picking'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';
export type CommerceOrderEventVisibility = 'internal' | 'customer' | 'public';
export type CommerceOrderSplitRole = 'single' | 'child';

export type CommerceOrderPaymentSnapshot = {
  system: string;
  value: number;
  installments?: number;
};

export type CommerceOrderTotals = {
  value: number;
  itemsValue: number;
  shippingValue: number;
  discountsValue: number;
  totalizers: Totalizer[];
  itemsCount: number;
};

export type CommerceOrderDraftRecord = {
  id: string;
  publicToken: string;
  orderFormId: string;
  status: CommerceOrderDraftStatus;
  email?: string;
  items: OrderFormItem[];
  clientProfileData: ClientProfileData | null;
  shippingAddress: Address | null;
  payments: CommerceOrderPaymentSnapshot[];
  totals: CommerceOrderTotals;
  customData: Record<string, unknown> | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  convertedAt?: string;
};

export type CommerceOrderRecord = {
  id: string;
  publicToken: string;
  groupOrderId?: string;
  splitRole: CommerceOrderSplitRole;
  splitSequence: number;
  splitTotal: number;
  draftId?: string;
  customerAccountId?: string;
  customerEmail: string;
  status: CommerceOrderStatus;
  financialStatus: CommerceOrderFinancialStatus;
  fulfillmentStatus: CommerceOrderFulfillmentStatus;
  source: 'storefront' | 'admin' | 'api';
  currency: string;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  items: OrderFormItem[];
  totals: CommerceOrderTotals;
  customerSnapshot: ClientProfileData | Record<string, unknown> | null;
  shippingSnapshot: {
    selectedAddress: Address | null;
    deliveryOptions: ShippingOption[];
    pickupOptions: Array<ShippingOption & { address?: Address | null }>;
    selectedOptionId?: string | null;
    selectedMode?: 'delivery' | 'pickup' | null;
  } | null;
  paymentSnapshot: CommerceOrderPaymentSnapshot[];
  logistics: Record<string, unknown> | null;
};

export type CommerceOrderEventRecord = {
  id: string;
  orderId: string;
  kind: string;
  title: string;
  description?: string;
  visibility: CommerceOrderEventVisibility;
  actorType: 'system' | 'customer' | 'admin';
  actorId?: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type PublicOrderTrackingRecord = {
  orderId: string;
  publicToken: string;
  groupOrderId?: string;
  splitRole: CommerceOrderSplitRole;
  splitSequence: number;
  splitTotal: number;
  status: CommerceOrderStatus;
  financialStatus: CommerceOrderFinancialStatus;
  fulfillmentStatus: CommerceOrderFulfillmentStatus;
  placedAt: string;
  updatedAt: string;
  totals: Pick<CommerceOrderTotals, 'value' | 'shippingValue' | 'itemsCount'>;
  items: Array<{
    id: string;
    name: string;
    image?: string;
    quantity: number;
    price: number;
    listPrice?: number;
    unit?: string;
    packSize?: number;
  }>;
  delivery: {
    mode?: 'delivery' | 'pickup' | null;
    label?: string | null;
    estimate?: string | null;
    estimateDaysMin?: number | null;
    estimateDaysMax?: number | null;
    originId?: string | null;
    originName?: string | null;
    addressSummary?: string | null;
    pickupInstructions?: string | null;
  } | null;
  timeline: CommerceOrderEventRecord[];
  relatedOrders?: Array<{
    orderId: string;
    publicToken: string;
    splitSequence: number;
    splitTotal: number;
    status: CommerceOrderStatus;
    financialStatus: CommerceOrderFinancialStatus;
    fulfillmentStatus: CommerceOrderFulfillmentStatus;
    totals: Pick<CommerceOrderTotals, 'value' | 'shippingValue' | 'itemsCount'>;
    items: Array<{
      id: string;
      name: string;
      image?: string;
      quantity: number;
      price: number;
      listPrice?: number;
      unit?: string;
      packSize?: number;
    }>;
    delivery: {
      mode?: 'delivery' | 'pickup' | null;
      label?: string | null;
      estimate?: string | null;
      estimateDaysMin?: number | null;
      estimateDaysMax?: number | null;
      originId?: string | null;
      originName?: string | null;
      addressSummary?: string | null;
      pickupInstructions?: string | null;
    } | null;
  }>;
};
