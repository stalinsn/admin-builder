export type CatalogFacet =
  | { type: 'range'; key: 'price'; label: string; min: number; max: number; step?: number }
  | { type: 'multi'; key: 'brand' | 'dept' | 'collection'; label: string; options: string[] };

export type CatalogMetadata = Record<string, unknown>;
export type CatalogEntityStatus = 'draft' | 'active' | 'archived';

export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status?: CatalogEntityStatus;
  parentId: string | null;
  children: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  productIds: string[];
  facets?: CatalogFacet[];
  metadata?: CatalogMetadata | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CatalogCategoryListItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: CatalogEntityStatus;
  parentId: string | null;
  childrenCount: number;
  productCount: number;
  updatedAt: string;
};

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: CatalogEntityStatus;
  productIds: string[];
  metadata?: CatalogMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export type CatalogCollectionListItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: CatalogEntityStatus;
  productCount: number;
  updatedAt: string;
};

export type CatalogImage = {
  url: string;
  alt: string;
  label?: string;
  isPrimary?: boolean;
};

export type CatalogProductIdentification = {
  gtin?: string;
  ean?: string;
  referenceId?: string;
  mpn?: string;
  ncm?: string;
  cest?: string;
  originCountry?: string;
};

export type CatalogProductDimensions = {
  weightKg?: number;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
};

export type CatalogProductSupplier = {
  supplierId?: string;
  supplierName?: string;
  supplierSku?: string;
  costPrice?: number;
};

export type CatalogInventoryLocation = {
  id: string;
  name: string;
  availableQuantity: number;
  reservedQuantity?: number;
  incomingQuantity?: number;
  safetyStock?: number;
  reorderPoint?: number;
  leadTimeDays?: number;
};

export type CatalogProductAttribute = {
  key: string;
  label: string;
  value: string;
  highlight?: boolean;
  filterable?: boolean;
};

export type CatalogProductSellMode = 'unit' | 'weight' | 'volume' | 'length' | 'area';

export type CatalogProductCommercialUnit = {
  sellMode: CatalogProductSellMode;
  salesUnit: string;
  pricingBaseQuantity?: number;
  pricingBaseUnit?: string;
  referenceQuantity?: number;
  referenceUnit?: string;
  multiplier?: number;
  multiplierUnit?: string;
  allowFractionalQuantity?: boolean;
};

export type CatalogProductPackaging = {
  packageType?: string;
  packageLabel?: string;
  unitsPerPackage?: number;
  contentQuantity?: number;
  contentUnit?: string;
  soldByPackage?: boolean;
};

export type CatalogProductMerchandisingProfile =
  | 'generic'
  | 'food'
  | 'small_appliance'
  | 'large_appliance'
  | 'fashion';

export type CatalogProductVariantAxis = {
  key: string;
  label: string;
  values: string[];
};

export type CatalogProductMerchandising = {
  profile: CatalogProductMerchandisingProfile;
  variantAxes: CatalogProductVariantAxis[];
  supportedVoltages: string[];
  supportedColors: string[];
  supportedSizes: string[];
  sizeSystem?: string;
  targetGender?: string;
};

export type CatalogProductVariant = {
  id: string;
  sku: string;
  label: string;
  values: string[];
  available: boolean;
  image?: string;
  price?: number;
  listPrice?: number;
  stock: {
    availableQuantity: number;
    reservedQuantity?: number;
    incomingQuantity?: number;
    safetyStock?: number;
    reorderPoint?: number;
  };
  attributes?: CatalogMetadata | null;
};

export type CatalogCategoryPathNode = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogProductStatus = 'draft' | 'active' | 'archived';

export type CatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  status: CatalogProductStatus;
  available: boolean;
  image: string;
  images: CatalogImage[];
  price: number;
  listPrice?: number;
  unit: string;
  packSize?: number;
  commercialUnit: CatalogProductCommercialUnit;
  packaging: CatalogProductPackaging | null;
  merchandising: CatalogProductMerchandising;
  categories: string[];
  categoryPath: CatalogCategoryPathNode[];
  departments: string[];
  collections: string[];
  shortDescription: string;
  longDescription: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    noIndex?: boolean;
  };
  identification?: CatalogProductIdentification | null;
  dimensions?: CatalogProductDimensions | null;
  supplier?: CatalogProductSupplier | null;
  attributes: CatalogProductAttribute[];
  stock: {
    availableQuantity: number;
    reservedQuantity?: number;
    incomingQuantity?: number;
    safetyStock: number;
    reorderPoint?: number;
    backorderable: boolean;
    leadTimeDays?: number;
    trackInventory?: boolean;
    allowOversell?: boolean;
    warehouses?: CatalogInventoryLocation[];
  };
  logistics?: Record<string, unknown> | null;
  pricing?: Record<string, unknown> | null;
  regionalization?: Record<string, unknown> | null;
  marketing?: Record<string, unknown> | null;
  variationGroup?: Record<string, unknown> | null;
  variants: CatalogProductVariant[];
  customFields?: CatalogMetadata | null;
  allergens: string[];
  ingredients: string;
  storageInstructions: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogProductListItem = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  status: CatalogProductStatus;
  available: boolean;
  image: string;
  price: number;
  listPrice?: number;
  categories: string[];
  collections: string[];
  stockQuantity: number;
  reservedStockQuantity: number;
  incomingStockQuantity: number;
  lowStock: boolean;
  variantsCount: number;
  updatedAt: string;
};

export type CatalogProductUpsertInput = {
  slug: string;
  sku?: string;
  name: string;
  brand?: string;
  status: CatalogProductStatus;
  available: boolean;
  image?: string;
  images?: CatalogImage[];
  price: number;
  listPrice?: number;
  unit?: string;
  packSize?: number;
  commercialUnit?: CatalogProductCommercialUnit | null;
  packaging?: CatalogProductPackaging | null;
  merchandising?: CatalogProductMerchandising | null;
  categories: string[];
  departments: string[];
  collections: string[];
  shortDescription?: string;
  longDescription?: string;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    noIndex?: boolean;
  };
  identification?: CatalogProductIdentification | null;
  dimensions?: CatalogProductDimensions | null;
  supplier?: CatalogProductSupplier | null;
  attributes?: CatalogProductAttribute[];
  stock?: {
    availableQuantity?: number;
    reservedQuantity?: number;
    incomingQuantity?: number;
    safetyStock?: number;
    reorderPoint?: number;
    backorderable?: boolean;
    leadTimeDays?: number;
    trackInventory?: boolean;
    allowOversell?: boolean;
    warehouses?: CatalogInventoryLocation[];
  };
  logistics?: Record<string, unknown> | null;
  pricing?: Record<string, unknown> | null;
  regionalization?: Record<string, unknown> | null;
  marketing?: Record<string, unknown> | null;
  variationGroup?: Record<string, unknown> | null;
  variants?: CatalogProductVariant[];
  customFields?: CatalogMetadata | null;
  allergens?: string[];
  ingredients?: string;
  storageInstructions?: string;
};

export type CatalogCategoryUpsertInput = {
  slug: string;
  name: string;
  description?: string;
  status: CatalogEntityStatus;
  parentId?: string | null;
  children?: Array<{
    id?: string;
    slug?: string;
    name: string;
  }>;
  metadata?: CatalogMetadata | null;
};

export type CatalogCollectionUpsertInput = {
  slug: string;
  name: string;
  description?: string;
  status: CatalogEntityStatus;
  metadata?: CatalogMetadata | null;
};

export type CatalogOperationalSummary = {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  unavailableProducts: number;
  lowStockProducts: number;
  topCategories: Array<{
    name: string;
    products: number;
  }>;
};

export type CatalogPlpResult = {
  items: CatalogProduct[];
  total: number;
  category?: CatalogCategory;
  facets?: CatalogFacet[];
};
