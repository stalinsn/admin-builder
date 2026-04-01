export const ANALYTICS_SCHEMA_VERSION = 1;
export const ANALYTICS_SESSION_COOKIE = 'app_hub_analytics_sid';
export const ANALYTICS_VISITOR_COOKIE = 'app_hub_analytics_vid';
export const ANALYTICS_SESSION_HEADER = 'x-app-hub-analytics-session';

export type AnalyticsEventType =
  | 'page_view'
  | 'heartbeat'
  | 'interaction_click'
  | 'search_submit'
  | 'cart_update'
  | 'checkout_step'
  | 'purchase_complete';

export type AnalyticsDeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export type InternalAnalyticsConfig = {
  enabled: boolean;
  heartbeatIntervalSeconds: number;
  activeWindowMinutes: number;
  sessionTimeoutMinutes: number;
  retainDays: number;
  maxBatchSize: number;
};

export type GoogleTrackingConfig = {
  enabled: boolean;
  gtmEnabled: boolean;
  gtmContainerId: string;
  gaEnabled: boolean;
  gaMeasurementId: string;
  dataLayerName: string;
  sendPageView: boolean;
};

export type AnalyticsConfig = {
  schemaVersion: number;
  updatedAt: string;
  internal: InternalAnalyticsConfig;
  google: GoogleTrackingConfig;
};

export type RuntimeAnalyticsConfigSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  config: AnalyticsConfig;
};

export type AnalyticsClientEventInput = {
  type: AnalyticsEventType;
  occurredAt?: string;
  pathname?: string;
  search?: string;
  referrer?: string;
  title?: string;
  trackId?: string;
  label?: string;
  element?: string;
  targetHref?: string;
  searchQuery?: string;
  checkoutStep?: string;
  paymentMethod?: string;
  action?: string;
  productId?: string;
  productName?: string;
  cartItemsCount?: number;
  cartSubtotal?: number;
  cartValue?: number;
};

export type AnalyticsEventRecord = {
  id: string;
  sessionId: string;
  visitorId?: string;
  type: AnalyticsEventType;
  occurredAt: string;
  receivedAt: string;
  pathname: string;
  search: string;
  referrer: string;
  title?: string;
  trackId?: string;
  label?: string;
  element?: string;
  targetHref?: string;
  searchQuery?: string;
  checkoutStep?: string;
  paymentMethod?: string;
  action?: string;
  productId?: string;
  productName?: string;
  cartItemsCount?: number;
  cartSubtotal?: number;
  cartValue?: number;
  purchaseOrderId?: string;
  purchaseValue?: number;
  purchaseItemsCount?: number;
  shippingValue?: number;
  discountValue?: number;
  postalCodePrefix?: string;
  currency: 'BRL';
  source: 'storefront' | 'server';
  locationCountry?: string;
  locationRegion?: string;
  locationCity?: string;
  deviceType: AnalyticsDeviceType;
};

export type AnalyticsTopRow = {
  label: string;
  value: number;
  secondary?: string;
};

export type AnalyticsTimelineRow = {
  day: string;
  sessions: number;
  activeSessions: number;
  pageViews: number;
  searches: number;
  clicks: number;
  purchases: number;
  revenue: number;
};

export type AnalyticsRecentPurchase = {
  orderId: string;
  occurredAt: string;
  value: number;
  itemsCount: number;
  paymentMethod: string;
  locationLabel: string;
};

export type AnalyticsRecentEvent = {
  id: string;
  occurredAt: string;
  type: AnalyticsEventType;
  label: string;
  pathname: string;
  secondary?: string;
};

export type AnalyticsOverview = {
  activeSessions: number;
  totalSessions: number;
  uniqueVisitors: number;
  averageSessionMinutes: number;
  pageViews: number;
  searches: number;
  clicks: number;
  cartUpdates: number;
  checkoutSessions: number;
  purchases: number;
  revenue: number;
  averageTicket: number;
  conversionRate: number;
  cartAbandonmentRate: number;
};

export type AnalyticsDashboard = {
  generatedAt: string;
  rangeDays: number;
  overview: AnalyticsOverview;
  topPages: AnalyticsTopRow[];
  topSearches: AnalyticsTopRow[];
  topClicks: AnalyticsTopRow[];
  paymentMethods: AnalyticsTopRow[];
  locations: AnalyticsTopRow[];
  devices: AnalyticsTopRow[];
  timeline: AnalyticsTimelineRow[];
  recentPurchases: AnalyticsRecentPurchase[];
  recentEvents: AnalyticsRecentEvent[];
  alerts: string[];
};
