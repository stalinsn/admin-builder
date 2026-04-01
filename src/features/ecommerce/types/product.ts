export interface ImageUrls {
  at1x?: string;
  at2x?: string;
  at3x?: string;
}

export interface PriceDefinition {
  calculatedSellingPrice: number;
  total: number;
  sellingPrices: { quantity: number; value: number }[];
}

export interface EcommerceItem {
  additionalInfo?: { brandName?: string };
  attachments?: unknown[];
  availability?: 'available' | 'unavailable';
  detailUrl?: string;
  id: string;
  imageUrls?: ImageUrls;
  listPrice?: number; // em centavos
  measurementUnit?: string;
  name: string;
  price?: number;
  productCategories?: Record<string, string>;
  productCategoryIds?: string;
  productRefId?: string;
  productId?: string;
  quantity?: number;
  seller?: string;
  sellingPrice?: number;
  skuName?: string;
  unitMultiplier?: number;
  uniqueId?: string;
  refId?: string;
  isGift?: boolean;
  priceDefinition?: PriceDefinition;
}

export interface UIProduct {
  id: string;
  name: string;
  image: string;
  brand?: string;
  price: number;
  listPrice?: number;
  unit?: string;
  url?: string;
  available: boolean;
  availabilityLabel?: string;
  packSize?: number;
  categories?: string[];
  categoryPath?: { id: string; name: string }[];
}
