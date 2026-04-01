export const PUBLIC_API_VERSION = 'v1' as const;

export type PublicApiEnvelope<TData, TMeta = Record<string, unknown>> = {
  version: typeof PUBLIC_API_VERSION;
  generatedAt: string;
  data: TData;
  meta?: TMeta;
};

export type PublicApiContentPageSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  layoutPreset: string;
  publicPath: string;
  seo: {
    title: string;
    description: string;
    noIndex: boolean;
  };
};

export type PublicApiBlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  featured: boolean;
  coverImageUrl: string;
  coverImageAlt: string;
  authorName: string;
  ownerName: string;
  publishedAt?: string;
  readTimeMinutes: number;
  canonicalPath: string;
};

export type PublicApiCatalogProductSummary = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  listPrice?: number;
  available: boolean;
  availabilityLabel?: string;
  unit: string;
  packSize?: number;
  canonicalPath: string;
  categories: string[];
  departments: string[];
  collections: string[];
};

export type PublicApiCatalogCategorySummary = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  productCount: number;
  children: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
};

export type PublicApiCatalogCollectionSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  productCount: number;
  status: string;
};

export type PublicApiOrderTracking = {
  orderId: string;
  publicToken: string;
  groupOrderId?: string;
  splitRole?: string;
  splitSequence?: number;
  splitTotal?: number;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  placedAt: string;
  updatedAt: string;
  totals: {
    value: number;
    shippingValue: number;
    itemsCount: number;
  };
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
  timeline: Array<{
    id: string;
    kind: string;
    title: string;
    description?: string;
    createdAt: string;
  }>;
  relatedOrders?: Array<{
    orderId: string;
    publicToken: string;
    splitSequence: number;
    splitTotal: number;
    status: string;
    financialStatus: string;
    fulfillmentStatus: string;
    totals: {
      value: number;
      shippingValue: number;
      itemsCount: number;
    };
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
