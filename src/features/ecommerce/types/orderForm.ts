import type { LogisticsServiceMode, LogisticsShippingClass } from './logistics';

export type OrderFormItem = {
  id: string;
  name: string;
  image?: string;
  price: number;
  listPrice?: number;
  unit?: string;
  packSize?: number;
  quantity: number;
};

export type Totalizer = {
  id: 'Items' | 'Shipping' | 'Discounts' | string;
  name: string;
  value: number;
};

export type MarketingData = {
  coupon?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmSource?: string;
  utmiCampaign?: string;
  utmiPart?: string;
  utmiPage?: string;
};

export type PaymentData = {
  paymentSystems: Array<{ id: string; name: string }>;
  payments: Array<{ system: string; value: number; installments?: number }>;
  installmentOptions: Array<{ system: string; options: Array<{ installments: number; value: number }> }>;
  availableAccounts: Array<{ id: string; name: string }>;
  isValid: boolean;
};

export type Address = {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type ShippingAllocation = {
  productId: string;
  productName?: string;
  quantity: number;
  originId: string;
  originName: string;
  offerId?: string;
  unitPrice?: number;
  listPrice?: number;
  lineTotal?: number;
  leadTimeDays?: number;
  sellerName?: string;
  dockId?: string;
  shippingClass?: LogisticsShippingClass;
  serviceMode?: LogisticsServiceMode;
};

export type ShippingOption = {
  id: string;
  name: string;
  price: number;
  estimate?: string;
  mode?: LogisticsServiceMode;
  originIds?: string[];
  originNames?: string[];
  policyIds?: string[];
  matchedZoneIds?: string[];
  splitShipment?: boolean;
  allocations?: ShippingAllocation[];
  estimateDaysMin?: number;
  estimateDaysMax?: number;
  itemValue?: number;
  totalValue?: number;
  pickupInstructions?: string;
  pickupAddress?: Address | null;
};

export type ShippingData = {
  countries: string[];
  availableAddresses: Address[];
  selectedAddress: Address | null;
  deliveryOptions: ShippingOption[];
  pickupOptions: Array<ShippingOption & { address?: Address | null }>;
  selectedOptionId?: string | null;
  selectedMode?: LogisticsServiceMode | null;
  isValid: boolean;
};

export type OrderFormMessages = {
  couponMessages: string[];
  generalMessages: string[];
};

export type ClientProfileData = {
  firstName?: string;
  lastName?: string;
  email?: string;
  document?: string;
  phone?: string;
};

export type ClientPreferencesData = {
  locale?: string;
  optInNewsletter?: boolean | null;
};

export type OrderForm = {
  id: string;
  sessionStartedAt?: string | null;
  draftId?: string | null;
  draftToken?: string | null;
  draftUpdatedAt?: string | null;
  items: OrderFormItem[];
  value: number;
  totalizers: Totalizer[];
  marketingData: MarketingData;
  canEditData: boolean;
  loggedIn: boolean;
  paymentData: PaymentData;
  messages: OrderFormMessages;
  shipping: ShippingData;
  userProfileId: string | null;
  userType: 'STORE_USER' | string;
  clientProfileData: ClientProfileData | null;
  clientPreferencesData: ClientPreferencesData;
  allowManualPrice: boolean;
  customData: Record<string, unknown> | null;
};
