export type SiteBlockType = 'hero' | 'rich_text' | 'cta' | 'banner' | 'product_card' | 'product_shelf';

export type SiteBlockBase = {
  id: string;
  type: SiteBlockType;
  enabled: boolean;
  style?: {
    backgroundColor?: string;
    textColor?: string;
  };
};

export type HeroBlock = SiteBlockBase & {
  type: 'hero';
  data: {
    title: string;
    subtitle: string;
  };
};

export type RichTextBlock = SiteBlockBase & {
  type: 'rich_text';
  data: {
    content: string;
  };
};

export type CtaBlock = SiteBlockBase & {
  type: 'cta';
  data: {
    label: string;
    href: string;
  };
};

export type BannerBlock = SiteBlockBase & {
  type: 'banner';
  data: {
    title: string;
    imageUrl: string;
  };
};

export type ProductCardBlock = SiteBlockBase & {
  type: 'product_card';
  data: {
    skuRef: string;
    title: string;
    price: number;
  };
};

export type ProductShelfBlock = SiteBlockBase & {
  type: 'product_shelf';
  data: {
    title: string;
    collection: string;
  };
};

export type SiteBlock =
  | HeroBlock
  | RichTextBlock
  | CtaBlock
  | BannerBlock
  | ProductCardBlock
  | ProductShelfBlock;

export type SiteLayoutPreset = 'single_block' | 'tic_tac_toe' | 'four_quadrants' | 'three_horizontal' | 'three_vertical';

export type SitePageSlot = {
  id: string;
  label: string;
  blocks: SiteBlock[];
};

export type SitePageStatus = 'draft' | 'published' | 'archived';

export type SitePageSeo = {
  title: string;
  description: string;
  keywords: string;
  noIndex: boolean;
};

export type SitePageTheme = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
};

export type SitePage = {
  id: string;
  title: string;
  slug: string;
  description: string;
  seo: SitePageSeo;
  theme: SitePageTheme;
  status: SitePageStatus;
  layoutPreset: SiteLayoutPreset;
  slots: SitePageSlot[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  deletedAt?: string;
  deleteExpiresAt?: string;
};
