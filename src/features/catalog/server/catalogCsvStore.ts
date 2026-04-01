import 'server-only';

import type { CatalogProduct, CatalogProductUpsertInput } from '@/features/catalog/types';

const CATALOG_PRODUCT_CSV_HEADERS = [
  'id',
  'slug',
  'sku',
  'name',
  'brand',
  'status',
  'available',
  'image',
  'price',
  'listPrice',
  'unit',
  'packSize',
  'categories',
  'departments',
  'collections',
  'shortDescription',
  'longDescription',
  'stockAvailable',
  'stockReserved',
  'stockIncoming',
  'safetyStock',
  'commercialUnit',
  'packaging',
  'merchandising',
  'seo',
  'identification',
  'dimensions',
  'supplier',
  'attributes',
  'variants',
  'customFields',
  'allergens',
  'ingredients',
  'storageInstructions',
] as const;

type CatalogCsvHeader = (typeof CATALOG_PRODUCT_CSV_HEADERS)[number];

type ParsedCatalogCsvRow = {
  id?: string;
  input: CatalogProductUpsertInput;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function safeText(value: unknown): string {
  return String(value ?? '').trim();
}

function parseBoolean(value: string, field: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim', 's'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  throw new Error(`Valor booleano inválido em ${field}: ${value}`);
}

function parseNumber(value: string, field: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numérico inválido em ${field}: ${value}`);
  }
  return parsed;
}

function parseInteger(value: string, field: string): number | undefined {
  const parsed = parseNumber(value, field);
  if (parsed === undefined) return undefined;
  return Math.trunc(parsed);
}

function parsePipeList(value: string): string[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonField<T>(value: string, field: string, fallback: T): T {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`JSON inválido em ${field}.`);
  }
}

function stringifyJsonCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function stringifyPipeList(values: string[]): string {
  return values.filter(Boolean).join(' | ');
}

export function buildCatalogProductsCsv(products: CatalogProduct[]): string {
  const headerLine = CATALOG_PRODUCT_CSV_HEADERS.join(',');
  const lines = products.map((product) => {
    const row: Record<CatalogCsvHeader, string> = {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      status: product.status,
      available: product.available ? 'true' : 'false',
      image: product.image,
      price: String(product.price ?? ''),
      listPrice: product.listPrice !== undefined ? String(product.listPrice) : '',
      unit: product.unit,
      packSize: product.packSize !== undefined ? String(product.packSize) : '',
      categories: stringifyPipeList(product.categories),
      departments: stringifyPipeList(product.departments),
      collections: stringifyPipeList(product.collections),
      shortDescription: product.shortDescription || '',
      longDescription: product.longDescription || '',
      stockAvailable: String(product.stock.availableQuantity ?? 0),
      stockReserved: String(product.stock.reservedQuantity ?? 0),
      stockIncoming: String(product.stock.incomingQuantity ?? 0),
      safetyStock: String(product.stock.safetyStock ?? 0),
      commercialUnit: stringifyJsonCell(product.commercialUnit),
      packaging: stringifyJsonCell(product.packaging),
      merchandising: stringifyJsonCell(product.merchandising),
      seo: stringifyJsonCell(product.seo),
      identification: stringifyJsonCell(product.identification),
      dimensions: stringifyJsonCell(product.dimensions),
      supplier: stringifyJsonCell(product.supplier),
      attributes: stringifyJsonCell(product.attributes),
      variants: stringifyJsonCell(product.variants),
      customFields: stringifyJsonCell(product.customFields),
      allergens: stringifyPipeList(product.allergens),
      ingredients: product.ingredients || '',
      storageInstructions: product.storageInstructions || '',
    };

    return CATALOG_PRODUCT_CSV_HEADERS.map((column) => csvEscape(row[column])).join(',');
  });

  return `\uFEFF${[headerLine, ...lines].join('\n')}`;
}

export function parseCatalogProductsCsv(content: string): ParsedCatalogCsvRow[] {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    throw new Error('O CSV do catálogo está vazio.');
  }

  const rows = parseCsv(normalized);
  if (rows.length < 2) {
    throw new Error('O CSV precisa conter cabeçalho e pelo menos uma linha de produto.');
  }

  const headers = rows[0].map((column) => column.trim()) as CatalogCsvHeader[];
  const missing = CATALOG_PRODUCT_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Cabeçalho CSV incompleto. Campos ausentes: ${missing.join(', ')}`);
  }

  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return rows.slice(1).map((row, rowIndex) => {
    const get = (field: CatalogCsvHeader) => row[headerIndex.get(field) ?? -1] ?? '';
    const line = rowIndex + 2;
    const slug = safeText(get('slug'));
    const name = safeText(get('name'));

    if (!slug || !name) {
      throw new Error(`Linha ${line}: slug e name são obrigatórios.`);
    }

    try {
      return {
        id: safeText(get('id')) || undefined,
        input: {
          slug,
          sku: safeText(get('sku')) || undefined,
          name,
          brand: safeText(get('brand')) || undefined,
          status: (safeText(get('status')) || 'draft') as CatalogProductUpsertInput['status'],
          available: parseBoolean(get('available') || 'false', 'available'),
          image: safeText(get('image')) || undefined,
          price: parseNumber(get('price'), 'price') ?? 0,
          listPrice: parseNumber(get('listPrice'), 'listPrice'),
          unit: safeText(get('unit')) || undefined,
          packSize: parseInteger(get('packSize'), 'packSize'),
          categories: parsePipeList(get('categories')),
          departments: parsePipeList(get('departments')),
          collections: parsePipeList(get('collections')),
          shortDescription: safeText(get('shortDescription')) || undefined,
          longDescription: get('longDescription') || undefined,
          stock: {
            availableQuantity: parseInteger(get('stockAvailable'), 'stockAvailable'),
            reservedQuantity: parseInteger(get('stockReserved'), 'stockReserved'),
            incomingQuantity: parseInteger(get('stockIncoming'), 'stockIncoming'),
            safetyStock: parseInteger(get('safetyStock'), 'safetyStock'),
          },
          commercialUnit: parseJsonField(get('commercialUnit'), 'commercialUnit', null),
          packaging: parseJsonField(get('packaging'), 'packaging', null),
          merchandising: parseJsonField(get('merchandising'), 'merchandising', null),
          seo: parseJsonField(get('seo'), 'seo', undefined),
          identification: parseJsonField(get('identification'), 'identification', null),
          dimensions: parseJsonField(get('dimensions'), 'dimensions', null),
          supplier: parseJsonField(get('supplier'), 'supplier', null),
          attributes: parseJsonField(get('attributes'), 'attributes', []),
          variants: parseJsonField(get('variants'), 'variants', []),
          customFields: parseJsonField(get('customFields'), 'customFields', null),
          allergens: parsePipeList(get('allergens')),
          ingredients: get('ingredients') || undefined,
          storageInstructions: get('storageInstructions') || undefined,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Linha ${line}: ${error.message}`);
      }
      throw error;
    }
  });
}
