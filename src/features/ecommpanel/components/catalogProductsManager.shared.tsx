'use client';

import type { ReactNode } from 'react';

import type {
  CatalogProduct,
  CatalogProductMerchandisingProfile,
  CatalogProductStatus,
  CatalogProductUpsertInput,
} from '@/features/catalog/types';
import type { PanelMediaAsset } from '@/features/ecommpanel/types/panelMediaSettings';

export type VariantAxisDraft = {
  key: string;
  label: string;
  values: string[];
};

export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinCsv(value: string[]): string {
  return value.join(', ');
}

export function slugifyVariantToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

export function stringifyJson(value: Record<string, unknown> | null | undefined): string {
  if (!value || typeof value !== 'object') return '';
  return JSON.stringify(value, null, 2);
}

export function stringifyJsonArray(value: unknown[] | null | undefined): string {
  if (!Array.isArray(value) || !value.length) return '';
  return JSON.stringify(value, null, 2);
}

export function parseJsonObjectInput(value: string): { value: Record<string, unknown> | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'Campos adicionais precisam ser um objeto JSON, como {"origem":"importado"}.' };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { value: null, error: 'O JSON de campos adicionais está inválido.' };
  }
}

export function parseJsonArrayInput(value: string, label: string): { value: Array<Record<string, unknown>>; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: [] };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { value: [], error: `${label} precisam ser informados como uma lista JSON.` };
    }

    const items = parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
    return { value: items };
  } catch {
    return { value: [], error: `O JSON de ${label.toLowerCase()} está inválido.` };
  }
}

export function normalizeVariantAxesDraft(value: Array<Record<string, unknown>>): VariantAxisDraft[] {
  return value
    .map((axis, index) => {
      const key = String(axis.key || '').trim() || `axis-${index + 1}`;
      const label = String(axis.label || key).trim() || `Eixo ${index + 1}`;
      const values = Array.isArray(axis.values)
        ? axis.values
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        : [];

      return {
        key,
        label,
        values: Array.from(new Set(values)),
      };
    })
    .filter((axis) => axis.values.length > 0);
}

export function cartesianProduct(values: string[][]): string[][] {
  if (!values.length) return [];
  return values.reduce<string[][]>(
    (acc, current) => acc.flatMap((prefix) => current.map((value) => [...prefix, value])),
    [[]],
  );
}

export function buildProductInput(product: CatalogProduct, overrides: Partial<CatalogProductUpsertInput> = {}): CatalogProductUpsertInput {
  return {
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    status: product.status,
    available: product.available,
    image: product.image,
    price: product.price,
    listPrice: product.listPrice,
    unit: product.unit,
    packSize: product.packSize,
    commercialUnit: product.commercialUnit,
    packaging: product.packaging,
    merchandising: product.merchandising,
    categories: product.categories,
    departments: product.departments,
    collections: product.collections,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    stock: product.stock,
    seo: product.seo,
    identification: product.identification || null,
    dimensions: product.dimensions || null,
    supplier: product.supplier || null,
    attributes: product.attributes,
    variants: product.variants,
    customFields: product.customFields || null,
    ...overrides,
  };
}

export function buildDuplicateSlug(slug: string): string {
  return `${slug}-copia-${Date.now().toString().slice(-4)}`;
}

export function getPrimaryAssetUrl(asset: PanelMediaAsset | null | undefined): string {
  if (!asset) return '';
  return (
    asset.variants.productPdp?.url ||
    asset.variants.productThumb?.url ||
    asset.variants.productZoom?.url ||
    Object.values(asset.variants)[0]?.url ||
    ''
  );
}

export const EMPTY_CATALOG_PRODUCT_FORM = {
  name: '',
  slug: '',
  sku: '',
  brand: '',
  status: 'draft' as CatalogProductStatus,
  available: false,
  image: '',
  price: '0',
  listPrice: '',
  unit: 'un',
  packSize: '',
  sellMode: 'unit' as CatalogProduct['commercialUnit']['sellMode'],
  salesUnit: 'un',
  pricingBaseQuantity: '1',
  pricingBaseUnit: 'un',
  referenceQuantity: '',
  referenceUnit: '',
  multiplier: '',
  multiplierUnit: '',
  allowFractionalQuantity: false,
  packageType: '',
  packageLabel: '',
  unitsPerPackage: '',
  contentQuantity: '',
  contentUnit: '',
  soldByPackage: false,
  merchandisingProfile: 'generic' as CatalogProductMerchandisingProfile,
  supportedVoltages: '',
  supportedColors: '',
  supportedSizes: '',
  sizeSystem: '',
  targetGender: '',
  variantAxesJson: '',
  categories: '',
  departments: '',
  collections: '',
  shortDescription: '',
  longDescription: '',
  stockQuantity: '0',
  reservedQuantity: '0',
  incomingQuantity: '0',
  safetyStock: '0',
  reorderPoint: '',
  leadTimeDays: '',
  backorderable: false,
  trackInventory: true,
  allowOversell: false,
  gtin: '',
  ean: '',
  referenceId: '',
  mpn: '',
  ncm: '',
  cest: '',
  originCountry: '',
  supplierId: '',
  supplierName: '',
  supplierSku: '',
  costPrice: '',
  weightKg: '',
  heightCm: '',
  widthCm: '',
  lengthCm: '',
  attributesJson: '',
  warehousesJson: '',
  variantsJson: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  customFields: '',
};

export const INITIAL_CATALOG_EDITOR_SECTIONS = {
  commercial: true,
  packaging: true,
  inventory: true,
  compliance: false,
  supplier: false,
  content: false,
  segment: false,
  advanced: false,
};

export const PRODUCTS_PER_PAGE = 8;

type CatalogEditorSectionProps = {
  id: string;
  title: string;
  description: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
};

export function CatalogEditorSection({ id, title, description, open, onToggle, children }: CatalogEditorSectionProps) {
  return (
    <details className="panel-form-section panel-catalog-section" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary className="panel-catalog-section__summary" aria-controls={`${id}-body`}>
        <span className="panel-catalog-section__summary-copy">
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="panel-accordion-chevron" aria-hidden="true" />
      </summary>
      <div id={`${id}-body`} className="panel-catalog-section__body">
        <div className="panel-catalog-section__body-inner">{children}</div>
      </div>
    </details>
  );
}
