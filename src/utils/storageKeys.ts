import { withVersion } from './safeStorage';

export const STORAGE_VERSIONS = {
  cart: 'v1',
  orderForm: 'v1',
  theme: 'v1',
  lastLang: 'v1',
  cep: 'v1',
  checkoutPm: 'v1',
  checkoutShip: 'v1',
  analyticsVisitor: 'v1',
  customerAccount: 'v1',
} as const;

export const LEGACY_KEYS = {
  theme: 'theme',
  lastLang: 'lastLang',
  cep: 'ecom_cep',
} as const;

export const STORAGE_KEYS = {
  cart: withVersion('ecom.cart', STORAGE_VERSIONS.cart),
  orderForm: withVersion('ecom.orderform', STORAGE_VERSIONS.orderForm),
  theme: withVersion(LEGACY_KEYS.theme, STORAGE_VERSIONS.theme),
  lastLang: withVersion(LEGACY_KEYS.lastLang, STORAGE_VERSIONS.lastLang),
  cep: withVersion(LEGACY_KEYS.cep, STORAGE_VERSIONS.cep),
  checkoutPm: withVersion('ecom.checkout.pm', STORAGE_VERSIONS.checkoutPm),
  checkoutShip: withVersion('ecom.checkout.ship', STORAGE_VERSIONS.checkoutShip),
  analyticsVisitor: withVersion('ecom.analytics.visitor', STORAGE_VERSIONS.analyticsVisitor),
  customerAccount: withVersion('ecom.customer.account', STORAGE_VERSIONS.customerAccount),
} as const;
