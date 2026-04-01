
export type VtexImage = {
  imageId?: string;
  imageLabel?: string | null;
  imageUrl: string;
  imageText?: string | null;
};

export type VtexCommertialOffer = {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
};

export type VtexSeller = {
  sellerId: string;
  sellerName?: string;
  commertialOffer: VtexCommertialOffer;
};

export type VtexSku = {
  itemId: string;
  name: string;
  referenceId?: { Key: string; Value: string }[];
  images: VtexImage[];
  sellers: VtexSeller[];
};

export type VtexSearchedProduct = {
  productId: string;
  productName: string;
  brand: string;
  brandId?: number | string;
  linkText?: string;
  productReference?: string;
  categoryId?: string;
  categories?: string[];
  categoriesIds?: string[];
  items: VtexSku[];
};

export type VtexCategoryNode = {
  id: number;
  name: string;
  url?: string;
  hasChildren?: boolean;
  children?: VtexCategoryNode[];
};

export type VtexBrand = {
  id: number;
  name: string;
  isActive: boolean;
};
