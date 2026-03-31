'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  CatalogCategoryListItem,
  CatalogCollectionListItem,
  CatalogProduct,
  CatalogProductListItem,
  CatalogProductMerchandisingProfile,
  CatalogProductStatus,
  CatalogProductUpsertInput,
} from '@/features/catalog/types';
import {
  buildDuplicateSlug,
  buildProductInput,
  cartesianProduct,
  CatalogEditorSection,
  EMPTY_CATALOG_PRODUCT_FORM,
  formatDate,
  getPrimaryAssetUrl,
  INITIAL_CATALOG_EDITOR_SECTIONS,
  joinCsv,
  normalizeVariantAxesDraft,
  parseJsonArrayInput,
  parseJsonObjectInput,
  PRODUCTS_PER_PAGE,
  slugifyVariantToken,
  splitCsv,
  stringifyJson,
  stringifyJsonArray,
  type VariantAxisDraft,
} from '@/features/ecommpanel/components/catalogProductsManager.shared';
import type { PanelMediaAsset } from '@/features/ecommpanel/types/panelMediaSettings';

type MeResponse = {
  csrfToken?: string;
  user?: {
    name?: string;
    permissions?: string[];
    isDemoMode?: boolean;
  };
  sessionExpiresAt?: string;
};

type ProductsResponse = {
  products?: CatalogProductListItem[];
  error?: string;
};

type ProductResponse = {
  product?: CatalogProduct;
  error?: string;
};

type CategoriesResponse = {
  categories?: CatalogCategoryListItem[];
  error?: string;
};

type CollectionsResponse = {
  collections?: CatalogCollectionListItem[];
  error?: string;
};

type MediaUploadResponse = {
  asset?: PanelMediaAsset;
  error?: string;
};

type CatalogBulkResponse = {
  csv?: string;
  fileName?: string;
  count?: number;
  summary?: {
    importedCount?: number;
    createdCount?: number;
    updatedCount?: number;
    removedCount?: number;
  };
  error?: string;
};

type QuickEditForm = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  status: CatalogProductStatus;
  available: boolean;
  category: string;
  collections: string;
  price: string;
  listPrice: string;
  stockQuantity: string;
};

function downloadNamedTextFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CatalogProductsManager() {
  const [csrfToken, setCsrfToken] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [currentUserName, setCurrentUserName] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryListItem[]>([]);
  const [collections, setCollections] = useState<CatalogCollectionListItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CatalogProductStatus>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_CATALOG_PRODUCT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditLoading, setQuickEditLoading] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<QuickEditForm | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadImageError, setUploadImageError] = useState<string | null>(null);
  const [uploadedImageAsset, setUploadedImageAsset] = useState<PanelMediaAsset | null>(null);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({ ...INITIAL_CATALOG_EDITOR_SECTIONS });
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'append' | 'replace'>('append');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const canManage = useMemo(
    () =>
      ['catalog.products.manage', 'catalog.content.manage', 'catalog.pricing.manage'].some((permission) =>
        permissions.includes(permission),
      ),
    [permissions],
  );

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const statusMatch = statusFilter === 'all' || product.status === statusFilter;
      const textMatch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term);
      return statusMatch && textMatch;
    });
  }, [products, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.status === 'active').length,
      drafts: products.filter((product) => product.status === 'draft').length,
      lowStock: products.filter((product) => product.lowStock).length,
      incoming: products.filter((product) => product.incomingStockQuantity > 0).length,
      withVariants: products.filter((product) => product.variantsCount > 0).length,
    }),
    [products],
  );

  const availableCategories = useMemo(
    () => categories.filter((category) => category.status === 'active' || category.status === 'draft'),
    [categories],
  );

  const availableCollections = useMemo(
    () => collections.filter((collection) => collection.status === 'active' || collection.status === 'draft'),
    [collections],
  );

  const suggestedVariantAxes = useMemo<VariantAxisDraft[]>(() => {
    const axes: VariantAxisDraft[] = [];
    const colors = splitCsv(form.supportedColors);
    const sizes = splitCsv(form.supportedSizes);
    const voltages = splitCsv(form.supportedVoltages);

    if (colors.length) {
      axes.push({ key: 'color', label: 'Cor', values: colors });
    }

    if (form.merchandisingProfile === 'fashion' && sizes.length) {
      axes.push({ key: 'size', label: 'Tamanho', values: sizes });
    }

    if ((form.merchandisingProfile === 'small_appliance' || form.merchandisingProfile === 'large_appliance') && voltages.length) {
      axes.push({ key: 'voltage', label: 'Voltagem', values: voltages });
    }

    if (form.merchandisingProfile !== 'fashion' && sizes.length) {
      axes.push({ key: 'size', label: 'Tamanho', values: sizes });
    }

    if (
      form.merchandisingProfile !== 'small_appliance' &&
      form.merchandisingProfile !== 'large_appliance' &&
      voltages.length
    ) {
      axes.push({ key: 'voltage', label: 'Voltagem', values: voltages });
    }

    return axes;
  }, [form.merchandisingProfile, form.supportedColors, form.supportedSizes, form.supportedVoltages]);

  const variantAxesDraft = useMemo(() => {
    const parsed = parseJsonArrayInput(form.variantAxesJson, 'Eixos de variação');
    if (parsed.error) return { axes: [] as VariantAxisDraft[], error: parsed.error };
    return { axes: normalizeVariantAxesDraft(parsed.value), error: undefined };
  }, [form.variantAxesJson]);

  const variantGridPreview = useMemo(() => {
    const axes = variantAxesDraft.axes.length ? variantAxesDraft.axes : suggestedVariantAxes;
    if (!axes.length) return { axes, combinations: [] as string[][] };
    return {
      axes,
      combinations: cartesianProduct(axes.map((axis) => axis.values)),
    };
  }, [suggestedVariantAxes, variantAxesDraft.axes]);

  function applySuggestedVariantAxes() {
    if (!suggestedVariantAxes.length) {
      setError('Preencha cores, tamanhos ou voltagens para sugerir uma grade operacional.');
      return;
    }

    setError(null);
    setSuccess('Eixos operacionais sugeridos com base no perfil e nas listas informadas.');
    setForm((prev) => ({
      ...prev,
      variantAxesJson: JSON.stringify(suggestedVariantAxes, null, 2),
    }));
    setSectionOpen((prev) => ({ ...prev, segment: true, advanced: true }));
  }

  function generateVariantMatrix() {
    const axes = variantAxesDraft.axes.length ? variantAxesDraft.axes : suggestedVariantAxes;
    if (!axes.length) {
      setError('Defina pelo menos um eixo de variação para gerar a grade de SKUs.');
      return;
    }

    const combinations = cartesianProduct(axes.map((axis) => axis.values));
    if (!combinations.length) {
      setError('Os eixos escolhidos não possuem valores suficientes para montar a grade.');
      return;
    }

    const existingParsed = parseJsonArrayInput(form.variantsJson, 'Variações');
    if (existingParsed.error) {
      setError(existingParsed.error);
      return;
    }

    const existingVariants = existingParsed.value;
    const existingBySignature = new Map<string, Record<string, unknown>>();
    for (const variant of existingVariants) {
      const values = Array.isArray(variant.values)
        ? variant.values.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (values.length) {
        existingBySignature.set(values.join('||').toLowerCase(), variant);
      }
    }

    const baseSku = (form.sku || form.slug || form.name || 'produto').trim();
    const nextVariants = combinations.map((values, index) => {
      const signature = values.join('||').toLowerCase();
      const preserved = existingBySignature.get(signature);
      const suffix = values.map(slugifyVariantToken).filter(Boolean).join('-');
      const fallbackSku = `${baseSku}-${suffix || index + 1}`.toUpperCase();
      const label = values.join(' / ');

      return {
        id: String(preserved?.id || `variant-${index + 1}`),
        sku: String(preserved?.sku || fallbackSku),
        label: String(preserved?.label || label),
        values,
        available: preserved?.available !== undefined ? Boolean(preserved.available) : form.available,
        image: typeof preserved?.image === 'string' ? preserved.image : undefined,
        price:
          preserved?.price !== undefined && preserved.price !== null ? Number(preserved.price) : Number(form.price || 0),
        listPrice:
          preserved?.listPrice !== undefined && preserved.listPrice !== null
            ? Number(preserved.listPrice)
            : form.listPrice
              ? Number(form.listPrice)
              : undefined,
        stock:
          preserved && typeof preserved.stock === 'object' && preserved.stock
            ? preserved.stock
            : {
                availableQuantity: 0,
                reservedQuantity: 0,
                incomingQuantity: 0,
                safetyStock: 0,
              },
        attributes:
          preserved?.attributes && typeof preserved.attributes === 'object' && !Array.isArray(preserved.attributes)
            ? preserved.attributes
            : undefined,
      };
    });

    setError(null);
    setSuccess(`Grade operacional montada com ${nextVariants.length} variação${nextVariants.length > 1 ? 'ões' : ''}.`);
    setForm((prev) => ({
      ...prev,
      variantAxesJson: JSON.stringify(axes, null, 2),
      variantsJson: JSON.stringify(nextVariants, null, 2),
    }));
    setSectionOpen((prev) => ({ ...prev, segment: true, advanced: true }));
  }

  async function loadProducts() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, productsReq, categoriesReq, collectionsReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/products', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/categories', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/collections', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      const productsPayload = (await productsReq.json().catch(() => null)) as ProductsResponse | null;
      const categoriesPayload = (await categoriesReq.json().catch(() => null)) as CategoriesResponse | null;
      const collectionsPayload = (await collectionsReq.json().catch(() => null)) as CollectionsResponse | null;

      setCsrfToken(mePayload?.csrfToken || '');
      setCurrentUserName(mePayload?.user?.name || '');
      setPermissions(mePayload?.user?.permissions || []);
      setDemoMode(Boolean(mePayload?.user?.isDemoMode));
      setSessionExpiresAt(mePayload?.sessionExpiresAt || null);

      if (!productsReq.ok) {
        setError(productsPayload?.error || 'Não foi possível carregar o catálogo.');
        return;
      }

      setProducts(productsPayload?.products || []);
      setCategories(categoriesReq.ok ? categoriesPayload?.categories || [] : []);
      setCollections(collectionsReq.ok ? collectionsPayload?.collections || [] : []);
    } catch {
      setError('Erro de rede ao carregar o catálogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_CATALOG_PRODUCT_FORM);
    setUploadImageError(null);
    setUploadedImageAsset(null);
    setSectionOpen({ ...INITIAL_CATALOG_EDITOR_SECTIONS });
  }

  async function handleExportCatalogCsv() {
    setBulkBusy(true);
    setBulkError(null);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/catalog/products/bulk', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CatalogBulkResponse | null;
      if (!response.ok || !payload?.csv || !payload?.fileName) {
        setBulkError(payload?.error || 'Não foi possível exportar o CSV do catálogo.');
        return;
      }

      downloadNamedTextFile(payload.fileName, payload.csv);
      setSuccess(`CSV exportado com ${payload.count || 0} produto(s).`);
    } catch {
      setBulkError('Erro de rede ao exportar o CSV do catálogo.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleLoadCatalogCsvFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setBulkCsvText(content);
      setBulkError(null);
      setSuccess(`Arquivo ${file.name} carregado para importação.`);
      setBulkPanelOpen(true);
    } catch {
      setBulkError('Não foi possível ler o arquivo CSV selecionado.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleImportCatalogCsv() {
    if (!bulkCsvText.trim()) {
      setBulkError('Cole o CSV ou carregue um arquivo antes de importar.');
      return;
    }

    setBulkBusy(true);
    setBulkError(null);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/catalog/products/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action: 'importCsv',
          csvContent: bulkCsvText,
          mode: bulkImportMode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CatalogBulkResponse | null;
      if (!response.ok) {
        setBulkError(payload?.error || 'Não foi possível importar o CSV do catálogo.');
        return;
      }

      const imported = payload?.summary?.importedCount || 0;
      const created = payload?.summary?.createdCount || 0;
      const updated = payload?.summary?.updatedCount || 0;
      setSuccess(`Importação concluída: ${imported} linha(s), ${created} novo(s) e ${updated} atualizado(s).`);
      await loadProducts();
    } catch {
      setBulkError('Erro de rede ao importar o CSV do catálogo.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleClearCatalogProducts() {
    const confirmation = window.prompt(
      'Esta ação remove todos os produtos cadastrados e preserva categorias/coleções. Digite LIMPAR para continuar.',
    );
    if (confirmation !== 'LIMPAR') return;

    setBulkBusy(true);
    setBulkError(null);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/catalog/products/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          action: 'clearProducts',
        }),
      });

      const payload = (await response.json().catch(() => null)) as CatalogBulkResponse | null;
      if (!response.ok) {
        setBulkError(payload?.error || 'Não foi possível limpar a base de produtos.');
        return;
      }

      resetForm();
      setQuickEditOpen(false);
      setQuickEditForm(null);
      setBulkCsvText('');
      setSuccess(`Base de produtos limpa com sucesso. ${payload?.summary?.removedCount || 0} item(ns) removido(s).`);
      await loadProducts();
    } catch {
      setBulkError('Erro de rede ao limpar o catálogo.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function startEditing(productId: string) {
    setError(null);
    setSuccess(null);
    setUploadImageError(null);
    setUploadedImageAsset(null);

    try {
      const req = await fetch(`/api/ecommpanel/catalog/products/${productId}`, { cache: 'no-store' });
      const payload = (await req.json().catch(() => null)) as ProductResponse | null;
      if (!req.ok || !payload?.product) {
        setError(payload?.error || 'Não foi possível abrir este produto.');
        return;
      }

      const product = payload.product;
      setEditingId(product.id);
      setForm({
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand,
        status: product.status,
        available: product.available,
        image: product.image,
        price: String(product.price),
        listPrice: product.listPrice !== undefined ? String(product.listPrice) : '',
        unit: product.unit,
        packSize: product.packSize !== undefined ? String(product.packSize) : '',
        sellMode: product.commercialUnit.sellMode,
        salesUnit: product.commercialUnit.salesUnit || product.unit,
        pricingBaseQuantity:
          product.commercialUnit.pricingBaseQuantity !== undefined ? String(product.commercialUnit.pricingBaseQuantity) : '1',
        pricingBaseUnit: product.commercialUnit.pricingBaseUnit || product.commercialUnit.salesUnit || product.unit,
        referenceQuantity:
          product.commercialUnit.referenceQuantity !== undefined ? String(product.commercialUnit.referenceQuantity) : '',
        referenceUnit: product.commercialUnit.referenceUnit || '',
        multiplier: product.commercialUnit.multiplier !== undefined ? String(product.commercialUnit.multiplier) : '',
        multiplierUnit: product.commercialUnit.multiplierUnit || '',
        allowFractionalQuantity: Boolean(product.commercialUnit.allowFractionalQuantity),
        packageType: product.packaging?.packageType || '',
        packageLabel: product.packaging?.packageLabel || '',
        unitsPerPackage: product.packaging?.unitsPerPackage !== undefined ? String(product.packaging.unitsPerPackage) : '',
        contentQuantity: product.packaging?.contentQuantity !== undefined ? String(product.packaging.contentQuantity) : '',
        contentUnit: product.packaging?.contentUnit || '',
        soldByPackage: Boolean(product.packaging?.soldByPackage),
        merchandisingProfile: product.merchandising.profile,
        supportedVoltages: joinCsv(product.merchandising.supportedVoltages),
        supportedColors: joinCsv(product.merchandising.supportedColors),
        supportedSizes: joinCsv(product.merchandising.supportedSizes),
        sizeSystem: product.merchandising.sizeSystem || '',
        targetGender: product.merchandising.targetGender || '',
        variantAxesJson: stringifyJsonArray(product.merchandising.variantAxes),
        categories: joinCsv(product.categories),
        departments: joinCsv(product.departments),
        collections: joinCsv(product.collections),
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        stockQuantity: String(product.stock.availableQuantity),
        reservedQuantity: String(product.stock.reservedQuantity || 0),
        incomingQuantity: String(product.stock.incomingQuantity || 0),
        safetyStock: String(product.stock.safetyStock),
        reorderPoint: product.stock.reorderPoint !== undefined ? String(product.stock.reorderPoint) : '',
        leadTimeDays: product.stock.leadTimeDays !== undefined ? String(product.stock.leadTimeDays) : '',
        backorderable: Boolean(product.stock.backorderable),
        trackInventory: product.stock.trackInventory !== undefined ? Boolean(product.stock.trackInventory) : true,
        allowOversell: Boolean(product.stock.allowOversell),
        gtin: product.identification?.gtin || '',
        ean: product.identification?.ean || '',
        referenceId: product.identification?.referenceId || '',
        mpn: product.identification?.mpn || '',
        ncm: product.identification?.ncm || '',
        cest: product.identification?.cest || '',
        originCountry: product.identification?.originCountry || '',
        supplierId: product.supplier?.supplierId || '',
        supplierName: product.supplier?.supplierName || '',
        supplierSku: product.supplier?.supplierSku || '',
        costPrice: product.supplier?.costPrice !== undefined ? String(product.supplier.costPrice) : '',
        weightKg: product.dimensions?.weightKg !== undefined ? String(product.dimensions.weightKg) : '',
        heightCm: product.dimensions?.heightCm !== undefined ? String(product.dimensions.heightCm) : '',
        widthCm: product.dimensions?.widthCm !== undefined ? String(product.dimensions.widthCm) : '',
        lengthCm: product.dimensions?.lengthCm !== undefined ? String(product.dimensions.lengthCm) : '',
        attributesJson: stringifyJsonArray(product.attributes),
        warehousesJson: stringifyJsonArray(product.stock.warehouses || []),
        variantsJson: stringifyJsonArray(product.variants),
        seoTitle: product.seo.title,
        seoDescription: product.seo.description,
        seoKeywords: joinCsv(product.seo.keywords),
        customFields: stringifyJson(product.customFields),
      });
      setSectionOpen({
        commercial: true,
        packaging: true,
        inventory: true,
        compliance: false,
        supplier: false,
        content: true,
        segment: Boolean(
          product.merchandising.profile !== 'generic' ||
            product.merchandising.variantAxes.length ||
            product.merchandising.supportedColors.length ||
            product.merchandising.supportedSizes.length ||
            product.merchandising.supportedVoltages.length,
        ),
        advanced: false,
      });
    } catch {
      setError('Erro de rede ao carregar o produto.');
    }
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedCustomFields = parseJsonObjectInput(form.customFields);
      if (parsedCustomFields.error) {
        setError(parsedCustomFields.error);
        setSaving(false);
        return;
      }
      const parsedAttributes = parseJsonArrayInput(form.attributesJson, 'Atributos');
      if (parsedAttributes.error) {
        setError(parsedAttributes.error);
        setSaving(false);
        return;
      }
      const parsedWarehouses = parseJsonArrayInput(form.warehousesJson, 'Locais de estoque');
      if (parsedWarehouses.error) {
        setError(parsedWarehouses.error);
        setSaving(false);
        return;
      }
      const parsedVariants = parseJsonArrayInput(form.variantsJson, 'Variações');
      if (parsedVariants.error) {
        setError(parsedVariants.error);
        setSaving(false);
        return;
      }
      const parsedVariantAxes = parseJsonArrayInput(form.variantAxesJson, 'Eixos de variação');
      if (parsedVariantAxes.error) {
        setError(parsedVariantAxes.error);
        setSaving(false);
        return;
      }

      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/api/ecommpanel/catalog/products/${editingId}` : '/api/ecommpanel/catalog/products';

      const req = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: form.slug,
          sku: form.sku,
          name: form.name,
          brand: form.brand,
          status: form.status,
          available: form.available,
          image: form.image,
          price: Number(form.price || 0),
          listPrice: form.listPrice ? Number(form.listPrice) : undefined,
          unit: form.salesUnit || form.unit,
          packSize: form.multiplier ? Number(form.multiplier) : form.unitsPerPackage ? Number(form.unitsPerPackage) : undefined,
          commercialUnit: {
            sellMode: form.sellMode,
            salesUnit: form.salesUnit || form.unit || 'un',
            pricingBaseQuantity: form.pricingBaseQuantity ? Number(form.pricingBaseQuantity) : undefined,
            pricingBaseUnit: form.pricingBaseUnit || undefined,
            referenceQuantity: form.referenceQuantity ? Number(form.referenceQuantity) : undefined,
            referenceUnit: form.referenceUnit || undefined,
            multiplier: form.multiplier ? Number(form.multiplier) : undefined,
            multiplierUnit: form.multiplierUnit || undefined,
            allowFractionalQuantity: form.allowFractionalQuantity,
          },
          packaging: {
            packageType: form.packageType || undefined,
            packageLabel: form.packageLabel || undefined,
            unitsPerPackage: form.unitsPerPackage ? Number(form.unitsPerPackage) : undefined,
            contentQuantity: form.contentQuantity ? Number(form.contentQuantity) : undefined,
            contentUnit: form.contentUnit || undefined,
            soldByPackage: form.soldByPackage,
          },
          merchandising: {
            profile: form.merchandisingProfile,
            variantAxes: parsedVariantAxes.value,
            supportedVoltages: splitCsv(form.supportedVoltages),
            supportedColors: splitCsv(form.supportedColors),
            supportedSizes: splitCsv(form.supportedSizes),
            sizeSystem: form.sizeSystem || undefined,
            targetGender: form.targetGender || undefined,
          },
          categories: splitCsv(form.categories),
          departments: splitCsv(form.departments),
          collections: splitCsv(form.collections),
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          stock: {
            availableQuantity: Number(form.stockQuantity || 0),
            reservedQuantity: Number(form.reservedQuantity || 0),
            incomingQuantity: Number(form.incomingQuantity || 0),
            safetyStock: Number(form.safetyStock || 0),
            reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
            leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
            backorderable: form.backorderable,
            trackInventory: form.trackInventory,
            allowOversell: form.allowOversell,
            warehouses: parsedWarehouses.value,
          },
          seo: {
            title: form.seoTitle,
            description: form.seoDescription,
            keywords: splitCsv(form.seoKeywords),
          },
          identification: {
            gtin: form.gtin,
            ean: form.ean,
            referenceId: form.referenceId,
            mpn: form.mpn,
            ncm: form.ncm,
            cest: form.cest,
            originCountry: form.originCountry,
          },
          supplier: {
            supplierId: form.supplierId,
            supplierName: form.supplierName,
            supplierSku: form.supplierSku,
            costPrice: form.costPrice ? Number(form.costPrice) : undefined,
          },
          dimensions: {
            weightKg: form.weightKg ? Number(form.weightKg) : undefined,
            heightCm: form.heightCm ? Number(form.heightCm) : undefined,
            widthCm: form.widthCm ? Number(form.widthCm) : undefined,
            lengthCm: form.lengthCm ? Number(form.lengthCm) : undefined,
          },
          attributes: parsedAttributes.value,
          variants: parsedVariants.value,
          customFields: parsedCustomFields.value,
        }),
      });

      const payload = (await req.json().catch(() => null)) as ProductResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Não foi possível salvar o produto.');
        return;
      }

      setSuccess(editingId ? 'Produto atualizado.' : 'Produto cadastrado.');
      resetForm();
      await loadProducts();
    } catch {
      setError('Erro de rede ao salvar o produto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleProductImageUpload(file: File) {
    if (!canManage || !csrfToken) return;

    setUploadingImage(true);
    setUploadImageError(null);
    setError(null);
    setSuccess(null);

    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('scope', 'product');

      const response = await fetch('/api/ecommpanel/media/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: payload,
      });

      const body = (await response.json().catch(() => null)) as MediaUploadResponse | null;
      if (!response.ok || !body?.asset) {
        throw new Error(body?.error || 'Não foi possível processar a imagem.');
      }

      setUploadedImageAsset(body.asset);
      setForm((prev) => ({
        ...prev,
        image: getPrimaryAssetUrl(body.asset),
      }));
      setSuccess('Imagem enviada e otimizada. O campo principal já foi atualizado com a versão de PDP.');
      setSectionOpen((prev) => ({ ...prev, commercial: true }));
    } catch (uploadError) {
      setUploadImageError(uploadError instanceof Error ? uploadError.message : 'Falha ao enviar a imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function fetchProductById(productId: string): Promise<CatalogProduct | null> {
    const req = await fetch(`/api/ecommpanel/catalog/products/${productId}`, { cache: 'no-store' });
    const payload = (await req.json().catch(() => null)) as ProductResponse | null;
    if (!req.ok || !payload?.product) {
      throw new Error(payload?.error || 'Não foi possível carregar o produto.');
    }
    return payload.product;
  }

  async function sendProductUpdate(productId: string, input: CatalogProductUpsertInput) {
    const req = await fetch(`/api/ecommpanel/catalog/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(input),
    });
    const payload = (await req.json().catch(() => null)) as ProductResponse | null;
    if (!req.ok || !payload?.product) {
      throw new Error(payload?.error || 'Não foi possível atualizar o produto.');
    }
    return payload.product;
  }

  async function handleQuickMutation(productId: string, mutate: (product: CatalogProduct) => CatalogProductUpsertInput, successMessage: string) {
    if (!canManage || !csrfToken) return;

    setActionLoadingId(productId);
    setError(null);
    setSuccess(null);

    try {
      const product = await fetchProductById(productId);
      if (!product) throw new Error('Produto não encontrado.');
      await sendProductUpdate(productId, mutate(product));
      setSuccess(successMessage);
      await loadProducts();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Falha na ação rápida.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDuplicateProduct(productId: string) {
    if (!canManage || !csrfToken) return;

    setActionLoadingId(productId);
    setError(null);
    setSuccess(null);

    try {
      const product = await fetchProductById(productId);
      if (!product) throw new Error('Produto não encontrado.');

      const duplicateInput = buildProductInput(product, {
        slug: buildDuplicateSlug(product.slug),
        sku: product.sku ? `${product.sku}-COPIA` : undefined,
        name: `${product.name} (Cópia)`,
        status: 'draft',
        available: false,
      });

      const req = await fetch('/api/ecommpanel/catalog/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(duplicateInput),
      });
      const payload = (await req.json().catch(() => null)) as ProductResponse | null;
      if (!req.ok || !payload?.product) {
        throw new Error(payload?.error || 'Não foi possível duplicar o produto.');
      }

      setSuccess('Produto duplicado em rascunho.');
      await loadProducts();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Falha ao duplicar o produto.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function openQuickEdit(productId: string) {
    setQuickEditOpen(true);
    setQuickEditLoading(true);
    setQuickEditError(null);

    try {
      const product = await fetchProductById(productId);
      if (!product) throw new Error('Produto não encontrado.');
      setQuickEditForm({
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        status: product.status,
        available: product.available,
        category: product.categories[0] || '',
        collections: joinCsv(product.collections),
        price: String(product.price),
        listPrice: product.listPrice !== undefined ? String(product.listPrice) : '',
        stockQuantity: String(product.stock.availableQuantity),
      });
    } catch (drawerError) {
      setQuickEditError(drawerError instanceof Error ? drawerError.message : 'Falha ao abrir a edição rápida.');
    } finally {
      setQuickEditLoading(false);
    }
  }

  async function handleSaveQuickEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickEditForm || !canManage || !csrfToken || quickEditSaving) return;

    setQuickEditSaving(true);
    setQuickEditError(null);
    setError(null);
    setSuccess(null);

    try {
      const current = await fetchProductById(quickEditForm.id);
      if (!current) throw new Error('Produto não encontrado.');

      await sendProductUpdate(
        quickEditForm.id,
        buildProductInput(current, {
          name: quickEditForm.name,
          slug: quickEditForm.slug,
          brand: quickEditForm.brand,
          status: quickEditForm.status,
          available: quickEditForm.available,
          categories: quickEditForm.category ? [quickEditForm.category] : [],
          collections: splitCsv(quickEditForm.collections),
          price: Number(quickEditForm.price || 0),
          listPrice: quickEditForm.listPrice ? Number(quickEditForm.listPrice) : undefined,
          stock: {
            ...current.stock,
            availableQuantity: Number(quickEditForm.stockQuantity || 0),
          },
        }),
      );

      setSuccess('Produto atualizado pela edição rápida.');
      setQuickEditOpen(false);
      setQuickEditForm(null);
      await loadProducts();
    } catch (saveQuickError) {
      setQuickEditError(saveQuickError instanceof Error ? saveQuickError.message : 'Falha ao salvar a edição rápida.');
    } finally {
      setQuickEditSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="catalog-products-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Catálogo</p>
        <h1 id="catalog-products-title">Produtos e disponibilidade da loja</h1>
        <p className="panel-muted">
          Cadastre alimento, eletro ou vestuário com regra comercial clara, variações por segmento e estoque sob controle.
        </p>
        <div className="panel-catalog-architecture">
          <div>
            <strong>Base tipada</strong>
            <span>Preço, estoque, venda por unidade/peso e perfil do produto ficam organizados em blocos previsíveis.</span>
          </div>
          <div>
            <strong>Extensão maleável</strong>
            <span>Variações e atributos avançados continuam abertos para crescer sem travar alimento, eletro ou moda.</span>
          </div>
        </div>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Produtos</span>
          <strong>{stats.total}</strong>
          <span>Total no catálogo operacional</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Ativos</span>
          <strong>{stats.active}</strong>
          <span>Visíveis para venda</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Rascunhos</span>
          <strong>{stats.drafts}</strong>
          <span>Aguardando ajuste ou publicação</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Estoque baixo</span>
          <strong>{stats.lowStock}</strong>
          <span>Abaixo do nível de segurança</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Reposição</span>
          <strong>{stats.incoming}</strong>
          <span>Com entrada prevista no estoque</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Variações</span>
          <strong>{stats.withVariants}</strong>
          <span>Produtos com estrutura SKU expandida</span>
        </article>
      </div>

      <div className="panel-workspace panel-workspace--catalog">
        <article className="panel-card panel-users-form-card panel-workspace__sidebar panel-catalog-editor-card">
          <div className="panel-card-header panel-card-header--catalog-editor">
            <div className="panel-card-header__copy">
              <p className="panel-kicker">Editor de produto</p>
              <h2>{editingId ? 'Editar produto' : 'Novo produto'}</h2>
              <p className="panel-muted">Organize base comercial, mídia, estoque, conteúdo e estrutura avançada em blocos recolhíveis.</p>
            </div>
            <div className="panel-catalog-editor-card__meta">
              <span className="panel-badge panel-badge-neutral">{editingId ? 'Em edição' : 'Novo cadastro'}</span>
              <small className="panel-muted">
                Responsável atual: <strong>{currentUserName || 'Usuário autenticado'}</strong>
              </small>
            </div>
          </div>
          {demoMode ? (
            <p className="panel-feedback panel-feedback-success">
              Modo demonstração ativo. As mudanças deste catálogo ficam isoladas nesta sessão e expiram em{' '}
              <strong>{formatDate(sessionExpiresAt || undefined)}</strong>.
            </p>
          ) : null}

          {!canManage ? <p className="panel-feedback panel-feedback-error">Seu perfil pode consultar, mas não pode alterar o catálogo.</p> : null}
          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

          <form className="panel-form" onSubmit={saveProduct}>
            <CatalogEditorSection
              id="catalog-commercial"
              title="Base comercial"
              description="Nome, preço, classificação comercial e disponibilidade principal do produto."
              open={sectionOpen.commercial}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, commercial: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-name">Nome</label>
                  <input id="catalog-name" className="panel-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-slug">Slug</label>
                  <input id="catalog-slug" className="panel-input" value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} required />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-sku">SKU / Ref</label>
                  <input id="catalog-sku" className="panel-input" value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-brand">Marca</label>
                  <input id="catalog-brand" className="panel-input" value={form.brand} onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-status">Situação</label>
                  <select id="catalog-status" className="panel-input" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CatalogProductStatus }))}>
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativo</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-price">Preço</label>
                  <input id="catalog-price" type="number" step="0.01" className="panel-input" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-list-price">Preço de lista</label>
                  <input id="catalog-list-price" type="number" step="0.01" className="panel-input" value={form.listPrice} onChange={(event) => setForm((prev) => ({ ...prev, listPrice: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-image">Imagem principal</label>
                  <input id="catalog-image" className="panel-input" value={form.image} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} placeholder="https://..." />
                  <small className="panel-field-help">Você ainda pode colar uma URL manualmente, mas o ideal agora é usar o upload otimizado abaixo.</small>
                </div>
                <div className="panel-field panel-field--span-2">
                  <label htmlFor="catalog-image-upload">Upload otimizado</label>
                  <div className="panel-media-upload">
                    <div className="panel-media-upload__controls">
                      <input
                        id="catalog-image-upload"
                        className="panel-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleProductImageUpload(file);
                          }
                          event.target.value = '';
                        }}
                        disabled={!canManage || uploadingImage}
                      />
                      <span className="panel-muted">
                        {uploadingImage
                          ? 'Processando imagem e gerando variantes...'
                          : 'O servidor comprime o arquivo, limita as dimensões e publica versões leves para a loja.'}
                      </span>
                    </div>

                    {form.image ? (
                      <div className="panel-media-upload__preview">
                        <img src={form.image} alt={form.name || 'Prévia da imagem do produto'} />
                        <div className="panel-media-upload__meta">
                          <strong>Prévia atual</strong>
                          <span className="panel-muted">{form.image}</span>
                          {uploadedImageAsset ? (
                            <div className="panel-media-upload__variants">
                              {Object.values(uploadedImageAsset.variants).map((variant) => (
                                <span key={variant.key} className="panel-badge panel-badge-neutral">
                                  {variant.key} {variant.width}x{variant.height}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {uploadImageError ? <p className="panel-feedback panel-feedback-error">{uploadImageError}</p> : null}
                  </div>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-categories">Categorias</label>
                  <select
                    id="catalog-categories"
                    className="panel-select"
                    value={splitCsv(form.categories)[0] || ''}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        categories: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione a categoria principal</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <small className="panel-field-help">Usa as categorias já cadastradas na estrutura comercial.</small>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-departments">Subcategorias</label>
                  <input id="catalog-departments" className="panel-input" value={form.departments} onChange={(event) => setForm((prev) => ({ ...prev, departments: event.target.value }))} placeholder="Grãos, Premium" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-collections">Coleções</label>
                  <input
                    id="catalog-collections"
                    className="panel-input"
                    list="catalog-collections-suggestions"
                    value={form.collections}
                    onChange={(event) => setForm((prev) => ({ ...prev, collections: event.target.value }))}
                    placeholder="Ofertas, Orgânicos"
                  />
                  <datalist id="catalog-collections-suggestions">
                    {availableCollections.map((collection) => (
                      <option key={collection.id} value={collection.name} />
                    ))}
                  </datalist>
                  <small className="panel-field-help">Digite uma ou mais coleções separadas por vírgula. As opções existentes aparecem como apoio.</small>
                </div>
              </div>
              <div className="panel-catalog-section__footer">
                <label className="panel-checkbox panel-checkbox--full">
                  <input type="checkbox" checked={form.available} onChange={(event) => setForm((prev) => ({ ...prev, available: event.target.checked }))} />
                  <span>Disponível para venda</span>
                </label>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-packaging"
              title="Venda, embalagem e composição"
              description="Defina se a venda é por unidade, peso ou volume, e qual conteúdo real acompanha cada item."
              open={sectionOpen.packaging}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, packaging: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-sell-mode">Modo de venda</label>
                  <select id="catalog-sell-mode" className="panel-select" value={form.sellMode} onChange={(event) => setForm((prev) => ({ ...prev, sellMode: event.target.value as typeof form.sellMode }))}>
                    <option value="unit">Por unidade</option>
                    <option value="weight">Por peso</option>
                    <option value="volume">Por volume</option>
                    <option value="length">Por comprimento</option>
                    <option value="area">Por área</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-sales-unit">Unidade de venda</label>
                  <input id="catalog-sales-unit" className="panel-input" value={form.salesUnit} onChange={(event) => setForm((prev) => ({ ...prev, salesUnit: event.target.value, unit: event.target.value }))} placeholder="un, kg, caixa, kit" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-pricing-base-quantity">Base de preço</label>
                  <input id="catalog-pricing-base-quantity" type="number" step="0.001" className="panel-input" value={form.pricingBaseQuantity} onChange={(event) => setForm((prev) => ({ ...prev, pricingBaseQuantity: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-pricing-base-unit">Unidade da base de preço</label>
                  <input id="catalog-pricing-base-unit" className="panel-input" value={form.pricingBaseUnit} onChange={(event) => setForm((prev) => ({ ...prev, pricingBaseUnit: event.target.value }))} placeholder="un, kg, L" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-reference-quantity">Conteúdo de referência</label>
                  <input id="catalog-reference-quantity" type="number" step="0.001" className="panel-input" value={form.referenceQuantity} onChange={(event) => setForm((prev) => ({ ...prev, referenceQuantity: event.target.value }))} placeholder="1.5" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-reference-unit">Unidade do conteúdo</label>
                  <input id="catalog-reference-unit" className="panel-input" value={form.referenceUnit} onChange={(event) => setForm((prev) => ({ ...prev, referenceUnit: event.target.value }))} placeholder="kg, L, un" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-multiplier">Multiplicador interno</label>
                  <input id="catalog-multiplier" type="number" step="1" className="panel-input" value={form.multiplier} onChange={(event) => setForm((prev) => ({ ...prev, multiplier: event.target.value, packSize: event.target.value }))} placeholder="15" />
                  <small className="panel-field-help">Ex.: caixa com 15 latas ou pacote com 6 unidades.</small>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-multiplier-unit">Unidade do multiplicador</label>
                  <input id="catalog-multiplier-unit" className="panel-input" value={form.multiplierUnit} onChange={(event) => setForm((prev) => ({ ...prev, multiplierUnit: event.target.value }))} placeholder="un, lata, garrafa" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-package-type">Tipo de embalagem</label>
                  <input id="catalog-package-type" className="panel-input" value={form.packageType} onChange={(event) => setForm((prev) => ({ ...prev, packageType: event.target.value }))} placeholder="bandeja, caixa, pacote" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-package-label">Rótulo da embalagem</label>
                  <input id="catalog-package-label" className="panel-input" value={form.packageLabel} onChange={(event) => setForm((prev) => ({ ...prev, packageLabel: event.target.value }))} placeholder="Caixa com 15 unidades" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-content-quantity">Conteúdo por embalagem</label>
                  <input id="catalog-content-quantity" type="number" step="0.001" className="panel-input" value={form.contentQuantity} onChange={(event) => setForm((prev) => ({ ...prev, contentQuantity: event.target.value }))} placeholder="350" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-content-unit">Unidade do conteúdo</label>
                  <input id="catalog-content-unit" className="panel-input" value={form.contentUnit} onChange={(event) => setForm((prev) => ({ ...prev, contentUnit: event.target.value }))} placeholder="ml, g, kg, un" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-units-per-package">Unidades por pacote</label>
                  <input id="catalog-units-per-package" type="number" step="1" className="panel-input" value={form.unitsPerPackage} onChange={(event) => setForm((prev) => ({ ...prev, unitsPerPackage: event.target.value }))} placeholder="15" />
                </div>
              </div>
              <div className="panel-catalog-form-grid panel-catalog-form-grid--compact">
                <div className="panel-field panel-field--checkbox">
                  <label className="panel-checkbox">
                    <input type="checkbox" checked={form.allowFractionalQuantity} onChange={(event) => setForm((prev) => ({ ...prev, allowFractionalQuantity: event.target.checked }))} />
                    <span>Aceitar quantidade fracionada</span>
                  </label>
                </div>
                <div className="panel-field panel-field--checkbox">
                  <label className="panel-checkbox">
                    <input type="checkbox" checked={form.soldByPackage} onChange={(event) => setForm((prev) => ({ ...prev, soldByPackage: event.target.checked }))} />
                    <span>Vender pela embalagem fechada</span>
                  </label>
                </div>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-segment"
              title="Perfil do item e variações"
              description="Defina o segmento principal e os eixos operacionais usados para cor, tamanho, voltagem ou similares."
              open={sectionOpen.segment}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, segment: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-merchandising-profile">Perfil do item</label>
                  <select id="catalog-merchandising-profile" className="panel-select" value={form.merchandisingProfile} onChange={(event) => setForm((prev) => ({ ...prev, merchandisingProfile: event.target.value as CatalogProductMerchandisingProfile }))}>
                    <option value="generic">Genérico</option>
                    <option value="food">Alimentos</option>
                    <option value="small_appliance">Eletrinho</option>
                    <option value="large_appliance">Eletro maior</option>
                    <option value="fashion">Vestuário</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-supported-voltages">Voltagens</label>
                  <input id="catalog-supported-voltages" className="panel-input" value={form.supportedVoltages} onChange={(event) => setForm((prev) => ({ ...prev, supportedVoltages: event.target.value }))} placeholder="110V, 220V, bivolt" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-supported-colors">Cores</label>
                  <input id="catalog-supported-colors" className="panel-input" value={form.supportedColors} onChange={(event) => setForm((prev) => ({ ...prev, supportedColors: event.target.value }))} placeholder="Preto, Branco, Inox" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-supported-sizes">Tamanhos</label>
                  <input id="catalog-supported-sizes" className="panel-input" value={form.supportedSizes} onChange={(event) => setForm((prev) => ({ ...prev, supportedSizes: event.target.value }))} placeholder="P, M, G, 36, 38" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-size-system">Sistema de tamanhos</label>
                  <input id="catalog-size-system" className="panel-input" value={form.sizeSystem} onChange={(event) => setForm((prev) => ({ ...prev, sizeSystem: event.target.value }))} placeholder="BR, EU, US" />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-target-gender">Público / gênero</label>
                  <input id="catalog-target-gender" className="panel-input" value={form.targetGender} onChange={(event) => setForm((prev) => ({ ...prev, targetGender: event.target.value }))} placeholder="Unissex, Feminino, Masculino" />
                </div>
              </div>
              <div className="panel-catalog-variant-planner">
                <div className="panel-catalog-variant-planner__summary">
                  <div>
                    <strong>Grade sugerida</strong>
                    <span>
                      {variantGridPreview.axes.length
                        ? `${variantGridPreview.axes.length} eixo(s) • ${variantGridPreview.combinations.length} combinação(ões)`
                        : 'Informe cores, tamanhos ou voltagens para sugerir a grade.'}
                    </span>
                  </div>
                  <div className="panel-catalog-variant-planner__actions">
                    <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={applySuggestedVariantAxes}>
                      Sugerir eixos
                    </button>
                    <button type="button" className="panel-btn panel-btn-primary panel-btn-sm" onClick={generateVariantMatrix}>
                      Gerar grade
                    </button>
                  </div>
                </div>
                {variantGridPreview.axes.length ? (
                  <div className="panel-catalog-variant-planner__axes">
                    {variantGridPreview.axes.map((axis) => (
                      <div key={axis.key} className="panel-catalog-variant-planner__axis">
                        <strong>{axis.label}</strong>
                        <span>{axis.values.join(' • ')}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {variantGridPreview.combinations.length ? (
                  <div className="panel-catalog-variant-planner__preview">
                    {variantGridPreview.combinations.slice(0, 8).map((combination, index) => (
                      <span key={`${combination.join('|')}-${index}`} className="panel-badge panel-badge-neutral">
                        {combination.join(' / ')}
                      </span>
                    ))}
                    {variantGridPreview.combinations.length > 8 ? (
                      <span className="panel-catalog-variant-planner__more">
                        +{variantGridPreview.combinations.length - 8} combinações
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="panel-field">
                <label htmlFor="catalog-variant-axes-json">Eixos operacionais em JSON</label>
                <textarea
                  id="catalog-variant-axes-json"
                  className="panel-input panel-textarea panel-codearea"
                  value={form.variantAxesJson}
                  onChange={(event) => setForm((prev) => ({ ...prev, variantAxesJson: event.target.value }))}
                  rows={6}
                  placeholder={'[\n  {\n    "key": "voltagem",\n    "label": "Voltagem",\n    "values": ["110V", "220V"]\n  }\n]'}
                />
                <small className="panel-field-help">
                  Use esse bloco quando a grade de SKU precisar respeitar eixos claros, como cor, tamanho, voltagem ou capacidade.
                  {variantAxesDraft.error ? ` ${variantAxesDraft.error}` : ''}
                </small>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-inventory"
              title="Estoque e abastecimento"
              description="Saldo atual, reposição, política de venda e estoque por local."
              open={sectionOpen.inventory}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, inventory: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-stock">Disponível</label>
                  <input id="catalog-stock" type="number" step="1" className="panel-input" value={form.stockQuantity} onChange={(event) => setForm((prev) => ({ ...prev, stockQuantity: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-stock-reserved">Reservado</label>
                  <input id="catalog-stock-reserved" type="number" step="1" className="panel-input" value={form.reservedQuantity} onChange={(event) => setForm((prev) => ({ ...prev, reservedQuantity: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-stock-incoming">Em entrada</label>
                  <input id="catalog-stock-incoming" type="number" step="1" className="panel-input" value={form.incomingQuantity} onChange={(event) => setForm((prev) => ({ ...prev, incomingQuantity: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-safety-stock">Segurança</label>
                  <input id="catalog-safety-stock" type="number" step="1" className="panel-input" value={form.safetyStock} onChange={(event) => setForm((prev) => ({ ...prev, safetyStock: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-reorder-point">Ponto de reposição</label>
                  <input id="catalog-reorder-point" type="number" step="1" className="panel-input" value={form.reorderPoint} onChange={(event) => setForm((prev) => ({ ...prev, reorderPoint: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-lead-time">Lead time (dias)</label>
                  <input id="catalog-lead-time" type="number" step="1" className="panel-input" value={form.leadTimeDays} onChange={(event) => setForm((prev) => ({ ...prev, leadTimeDays: event.target.value }))} />
                </div>
              </div>
              <div className="panel-catalog-form-grid panel-catalog-form-grid--compact">
                <div className="panel-field panel-field--checkbox">
                  <label className="panel-checkbox">
                    <input type="checkbox" checked={form.trackInventory} onChange={(event) => setForm((prev) => ({ ...prev, trackInventory: event.target.checked }))} />
                    <span>Controlar estoque</span>
                  </label>
                </div>
                <div className="panel-field panel-field--checkbox">
                  <label className="panel-checkbox">
                    <input type="checkbox" checked={form.backorderable} onChange={(event) => setForm((prev) => ({ ...prev, backorderable: event.target.checked }))} />
                    <span>Aceitar encomenda</span>
                  </label>
                </div>
                <div className="panel-field panel-field--checkbox">
                  <label className="panel-checkbox">
                    <input type="checkbox" checked={form.allowOversell} onChange={(event) => setForm((prev) => ({ ...prev, allowOversell: event.target.checked }))} />
                    <span>Permitir venda além do saldo</span>
                  </label>
                </div>
              </div>
              <div className="panel-field">
                <label htmlFor="catalog-warehouses-json">Estoque por local em JSON</label>
                <textarea
                  id="catalog-warehouses-json"
                  className="panel-input panel-textarea panel-codearea"
                  value={form.warehousesJson}
                  onChange={(event) => setForm((prev) => ({ ...prev, warehousesJson: event.target.value }))}
                  rows={6}
                  placeholder={'[\n  {\n    "id": "cd-sp",\n    "name": "CD São Paulo",\n    "availableQuantity": 12,\n    "reservedQuantity": 2\n  }\n]'}
                />
                <small className="panel-field-help">Use esse bloco para detalhar saldo por centro de distribuição ou loja.</small>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-compliance"
              title="Identificação e compliance"
              description="GTIN, EAN, NCM e códigos fiscais usados na operação."
              open={sectionOpen.compliance}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, compliance: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-gtin">GTIN</label>
                  <input id="catalog-gtin" className="panel-input" value={form.gtin} onChange={(event) => setForm((prev) => ({ ...prev, gtin: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-ean">EAN</label>
                  <input id="catalog-ean" className="panel-input" value={form.ean} onChange={(event) => setForm((prev) => ({ ...prev, ean: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-reference-id">Ref. interna</label>
                  <input id="catalog-reference-id" className="panel-input" value={form.referenceId} onChange={(event) => setForm((prev) => ({ ...prev, referenceId: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-mpn">MPN</label>
                  <input id="catalog-mpn" className="panel-input" value={form.mpn} onChange={(event) => setForm((prev) => ({ ...prev, mpn: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-ncm">NCM</label>
                  <input id="catalog-ncm" className="panel-input" value={form.ncm} onChange={(event) => setForm((prev) => ({ ...prev, ncm: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-cest">CEST</label>
                  <input id="catalog-cest" className="panel-input" value={form.cest} onChange={(event) => setForm((prev) => ({ ...prev, cest: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-origin-country">País de origem</label>
                  <input id="catalog-origin-country" className="panel-input" value={form.originCountry} onChange={(event) => setForm((prev) => ({ ...prev, originCountry: event.target.value }))} />
                </div>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-supplier"
              title="Fornecedor e dimensões"
              description="Dados de origem, custo e medidas logísticas do item."
              open={sectionOpen.supplier}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, supplier: open }))}
            >
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-supplier-name">Fornecedor</label>
                  <input id="catalog-supplier-name" className="panel-input" value={form.supplierName} onChange={(event) => setForm((prev) => ({ ...prev, supplierName: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-supplier-id">ID do fornecedor</label>
                  <input id="catalog-supplier-id" className="panel-input" value={form.supplierId} onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-supplier-sku">SKU no fornecedor</label>
                  <input id="catalog-supplier-sku" className="panel-input" value={form.supplierSku} onChange={(event) => setForm((prev) => ({ ...prev, supplierSku: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-cost-price">Custo</label>
                  <input id="catalog-cost-price" type="number" step="0.01" className="panel-input" value={form.costPrice} onChange={(event) => setForm((prev) => ({ ...prev, costPrice: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-weight">Peso (kg)</label>
                  <input id="catalog-weight" type="number" step="0.001" className="panel-input" value={form.weightKg} onChange={(event) => setForm((prev) => ({ ...prev, weightKg: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-height">Altura (cm)</label>
                  <input id="catalog-height" type="number" step="0.01" className="panel-input" value={form.heightCm} onChange={(event) => setForm((prev) => ({ ...prev, heightCm: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-width">Largura (cm)</label>
                  <input id="catalog-width" type="number" step="0.01" className="panel-input" value={form.widthCm} onChange={(event) => setForm((prev) => ({ ...prev, widthCm: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-length">Comprimento (cm)</label>
                  <input id="catalog-length" type="number" step="0.01" className="panel-input" value={form.lengthCm} onChange={(event) => setForm((prev) => ({ ...prev, lengthCm: event.target.value }))} />
                </div>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-content"
              title="Conteúdo e SEO"
              description="Resumo, descrição longa e metadados públicos para busca."
              open={sectionOpen.content}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, content: open }))}
            >
              <div className="panel-field">
                <label htmlFor="catalog-short-description">Resumo curto</label>
                <textarea id="catalog-short-description" className="panel-input panel-textarea" value={form.shortDescription} onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))} rows={3} />
              </div>
              <div className="panel-field">
                <label htmlFor="catalog-long-description">Descrição longa</label>
                <textarea id="catalog-long-description" className="panel-input panel-textarea" value={form.longDescription} onChange={(event) => setForm((prev) => ({ ...prev, longDescription: event.target.value }))} rows={5} />
              </div>
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-seo-title">SEO título</label>
                  <input id="catalog-seo-title" className="panel-input" value={form.seoTitle} onChange={(event) => setForm((prev) => ({ ...prev, seoTitle: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-seo-description">SEO descrição</label>
                  <input id="catalog-seo-description" className="panel-input" value={form.seoDescription} onChange={(event) => setForm((prev) => ({ ...prev, seoDescription: event.target.value }))} />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-seo-keywords">SEO palavras-chave</label>
                  <input id="catalog-seo-keywords" className="panel-input" value={form.seoKeywords} onChange={(event) => setForm((prev) => ({ ...prev, seoKeywords: event.target.value }))} placeholder="arroz, mercearia, oferta" />
                </div>
              </div>
            </CatalogEditorSection>

            <CatalogEditorSection
              id="catalog-advanced"
              title="Estrutura avançada"
              description="Atributos, variações e campos extras para cenários mais complexos."
              open={sectionOpen.advanced}
              onToggle={(open) => setSectionOpen((prev) => ({ ...prev, advanced: open }))}
            >
              <div className="panel-field">
                <label htmlFor="catalog-attributes-json">Atributos em JSON</label>
                <textarea
                  id="catalog-attributes-json"
                  className="panel-input panel-textarea panel-codearea"
                  value={form.attributesJson}
                  onChange={(event) => setForm((prev) => ({ ...prev, attributesJson: event.target.value }))}
                  rows={6}
                  placeholder={'[\n  {\n    "key": "cor",\n    "label": "Cor",\n    "value": "Verde"\n  }\n]'}
                />
              </div>
              <div className="panel-field">
                <label htmlFor="catalog-variants-json">Variações / SKUs em JSON</label>
                <textarea
                  id="catalog-variants-json"
                  className="panel-input panel-textarea panel-codearea"
                  value={form.variantsJson}
                  onChange={(event) => setForm((prev) => ({ ...prev, variantsJson: event.target.value }))}
                  rows={8}
                  placeholder={'[\n  {\n    "id": "sku-verde-p",\n    "sku": "SKU-VERDE-P",\n    "label": "Verde / P",\n    "values": ["verde", "P"],\n    "available": true,\n    "stock": { "availableQuantity": 5 }\n  }\n]'}
                />
              </div>
              <div className="panel-field">
                <label htmlFor="catalog-custom-fields">Campos adicionais em JSON</label>
                <textarea
                  id="catalog-custom-fields"
                  className="panel-input panel-textarea panel-codearea"
                  value={form.customFields}
                  onChange={(event) => setForm((prev) => ({ ...prev, customFields: event.target.value }))}
                  rows={7}
                  placeholder={'{\n  "origem": "importado",\n  "conservacao": "refrigerado"\n}'}
                />
                <small className="panel-field-help">
                  Use esse bloco para propriedades novas ou temporárias. Se ficar vazio, o produto continua válido normalmente.
                </small>
              </div>
            </CatalogEditorSection>

            <div className="panel-form-actions">
              <button className="panel-btn panel-btn-primary" type="submit" disabled={!canManage || saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar produto' : 'Cadastrar produto'}
              </button>
              {editingId ? (
                <button className="panel-btn panel-btn-secondary" type="button" onClick={resetForm}>
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel-card panel-workspace__main panel-catalog-list-card">
          <div className="panel-toolbar">
            <div className="panel-toolbar__top">
              <div className="panel-toolbar__copy">
                <h2>Produtos existentes</h2>
                <p className="panel-muted">Consulte o catálogo ativo, revise disponibilidade e opere cada item sem perder o contexto da listagem.</p>
              </div>
              <div className="panel-toolbar__filters">
                {!loading && filteredProducts.length > PRODUCTS_PER_PAGE ? (
                  <div className="panel-pagination panel-pagination--inline">
                    <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                      Anterior
                    </button>
                    <span className="panel-pagination__summary">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                      Próxima
                    </button>
                  </div>
                ) : null}
                <input
                  className="panel-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, slug, marca ou SKU"
                />
              </div>
            </div>
          </div>

          <div className="panel-actions panel-catalog-bulk-actions">
            <button className="panel-btn panel-btn-secondary panel-btn-sm" type="button" onClick={() => void handleExportCatalogCsv()} disabled={bulkBusy}>
              Exportar CSV
            </button>
            <button className="panel-btn panel-btn-secondary panel-btn-sm" type="button" onClick={() => setBulkPanelOpen((current) => !current)}>
              {bulkPanelOpen ? 'Fechar operações em lote' : 'Importar ou limpar base'}
            </button>
          </div>

          <details className="panel-form-section panel-catalog-bulk-panel" open={bulkPanelOpen} onToggle={(event) => setBulkPanelOpen(event.currentTarget.open)}>
            <summary className="panel-advanced-summary">
              <span>
                <strong>Operações em lote do catálogo</strong>
                <small>Exporte a base atual, importe um CSV revisado ou limpe somente os produtos para iniciar uma nova carga.</small>
              </span>
              <span className="panel-badge panel-badge-neutral">{bulkImportMode === 'replace' ? 'Modo substituição' : 'Modo atualização'}</span>
            </summary>

            <div className="panel-catalog-bulk-grid">
              <div className="panel-catalog-bulk-card">
                <strong>Exportação segura</strong>
                <small>O CSV sai em UTF-8 com BOM, cabeçalho estável e campos complexos serializados para evitar caracteres quebrados.</small>
                <button className="panel-btn panel-btn-secondary panel-btn-sm" type="button" onClick={() => void handleExportCatalogCsv()} disabled={bulkBusy}>
                  {bulkBusy ? 'Processando...' : 'Baixar CSV da base'}
                </button>
              </div>

              <div className="panel-catalog-bulk-card">
                <strong>Importação assistida</strong>
                <small>Use atualização para complementar/editar a base ou substituição para zerar os produtos antes de importar o arquivo.</small>
                <div className="panel-form-grid panel-form-grid--two">
                  <div className="panel-field">
                    <label htmlFor="catalog-bulk-mode">Modo de importação</label>
                    <select id="catalog-bulk-mode" className="panel-select" value={bulkImportMode} onChange={(event) => setBulkImportMode(event.target.value as 'append' | 'replace')}>
                      <option value="append">Atualizar e complementar</option>
                      <option value="replace">Substituir toda a base de produtos</option>
                    </select>
                  </div>
                  <div className="panel-field">
                    <label className="panel-btn panel-btn-secondary panel-btn-sm panel-catalog-upload-trigger">
                      Carregar arquivo CSV
                      <input type="file" accept=".csv,text/csv" onChange={handleLoadCatalogCsvFile} hidden />
                    </label>
                  </div>
                </div>
                <textarea
                  className="panel-textarea panel-catalog-bulk-textarea"
                  value={bulkCsvText}
                  onChange={(event) => setBulkCsvText(event.target.value)}
                  placeholder="Cole aqui o CSV exportado e ajustado externamente, mantendo o cabeçalho original."
                />
                {bulkError ? <p className="panel-feedback panel-feedback-error">{bulkError}</p> : null}
                <div className="panel-actions">
                  <button className="panel-btn panel-btn-primary" type="button" onClick={() => void handleImportCatalogCsv()} disabled={bulkBusy || !bulkCsvText.trim()}>
                    {bulkBusy ? 'Importando...' : 'Importar CSV'}
                  </button>
                  <button className="panel-btn panel-btn-danger" type="button" onClick={() => void handleClearCatalogProducts()} disabled={bulkBusy}>
                    Limpar produtos
                  </button>
                </div>
              </div>
            </div>
          </details>

          <div className="panel-filter-row">
            <button className={`panel-filter-chip ${statusFilter === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setStatusFilter('all')}>
              Todos
            </button>
            <button className={`panel-filter-chip ${statusFilter === 'active' ? 'is-active' : ''}`} type="button" onClick={() => setStatusFilter('active')}>
              Ativos
            </button>
            <button className={`panel-filter-chip ${statusFilter === 'draft' ? 'is-active' : ''}`} type="button" onClick={() => setStatusFilter('draft')}>
              Rascunhos
            </button>
            <button className={`panel-filter-chip ${statusFilter === 'archived' ? 'is-active' : ''}`} type="button" onClick={() => setStatusFilter('archived')}>
              Arquivados
            </button>
          </div>

          <div className="panel-catalog-results-meta">
            <span>
              Mostrando {filteredProducts.length ? (currentPage - 1) * PRODUCTS_PER_PAGE + 1 : 0}-
              {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length}
            </span>
            <span>{totalPages} página{totalPages > 1 ? 's' : ''}</span>
          </div>

          {loading ? <p className="panel-muted">Carregando catálogo...</p> : null}

          <div className="panel-table-wrap panel-catalog-table-wrap">
            <table className="panel-table panel-catalog-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Situação</th>
                  <th>Atualização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className={editingId === product.id ? 'is-active' : undefined}>
                    <td>
                      <div className="panel-catalog-product-cell">
                        <strong>{product.name}</strong>
                        <span className="panel-muted">{product.slug}</span>
                        <small>{product.sku || 'Sem SKU'}</small>
                      </div>
                    </td>
                    <td>
                      <span className="panel-badge panel-badge-neutral">{product.categories[0] || 'Sem categoria'}</span>
                    </td>
                    <td>
                      <div className="panel-catalog-meta-stack panel-catalog-meta-stack--price">
                        <strong>R$ {product.price.toFixed(2)}</strong>
                        {product.listPrice ? <span className="panel-muted">Lista R$ {product.listPrice.toFixed(2)}</span> : <span className="panel-muted">Sem preço de lista</span>}
                      </div>
                    </td>
                    <td>
                      <div className="panel-catalog-meta-stack">
                        <strong>{product.stockQuantity}</strong>
                        <span className="panel-muted">Reservado {product.reservedStockQuantity}</span>
                        {product.incomingStockQuantity > 0 ? <span className="panel-muted">Entrada {product.incomingStockQuantity}</span> : null}
                        <span className={`panel-badge ${product.lowStock ? 'panel-badge-warn' : 'panel-badge-success'}`}>
                          {product.lowStock ? 'Baixo' : 'Ok'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="panel-catalog-meta-stack">
                        <span className={`panel-badge ${product.status === 'active' ? 'panel-badge-success' : product.status === 'draft' ? 'panel-badge-neutral' : 'panel-badge-warn'}`}>
                          {product.status === 'active' ? 'Ativo' : product.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                        </span>
                        <span className="panel-muted">{product.available ? 'Disponível' : 'Indisponível'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="panel-catalog-meta-stack">
                        <strong>{formatDate(product.updatedAt)}</strong>
                        <span className="panel-muted">Última revisão do item</span>
                      </div>
                    </td>
                    <td className="panel-catalog-actions-cell">
                      {product.variantsCount > 0 ? <span className="panel-badge panel-badge-neutral">{product.variantsCount} variações</span> : null}
                      <div className="panel-catalog-row-actions">
                        <button className="panel-btn panel-btn-secondary panel-btn-xs panel-table-action is-primary" type="button" onClick={() => void startEditing(product.id)}>
                          Editar
                        </button>
                        <button className="panel-btn panel-btn-secondary panel-btn-xs panel-table-action" type="button" onClick={() => void openQuickEdit(product.id)}>
                          Edição rápida
                        </button>
                        <button className="panel-btn panel-btn-secondary panel-btn-xs panel-table-action" type="button" disabled={actionLoadingId === product.id} onClick={() => void handleDuplicateProduct(product.id)}>
                          Duplicar
                        </button>
                        <button
                          className="panel-btn panel-btn-secondary panel-btn-xs panel-table-action"
                          type="button"
                          disabled={actionLoadingId === product.id}
                          onClick={() =>
                            void handleQuickMutation(
                              product.id,
                              (current) =>
                                buildProductInput(current, {
                                  available: !current.available,
                                }),
                              product.available ? 'Produto marcado como indisponível.' : 'Produto liberado para venda.',
                            )
                          }
                        >
                          {product.available ? 'Desativar venda' : 'Ativar venda'}
                        </button>
                        <button
                          className={`panel-btn panel-btn-xs panel-table-action ${product.status === 'archived' ? 'panel-btn-secondary' : 'panel-btn-danger'}`}
                          type="button"
                          disabled={actionLoadingId === product.id}
                          onClick={() =>
                            void handleQuickMutation(
                              product.id,
                              (current) =>
                                buildProductInput(current, {
                                  status: current.status === 'archived' ? 'active' : 'archived',
                                  available: current.status === 'archived' ? current.available : false,
                                }),
                              product.status === 'archived' ? 'Produto reativado.' : 'Produto arquivado.',
                            )
                          }
                        >
                          {product.status === 'archived' ? 'Ativar' : 'Arquivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="panel-muted">
                      Nenhum produto encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!loading && filteredProducts.length > PRODUCTS_PER_PAGE ? (
            <div className="panel-pagination">
              <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                Anterior
              </button>
              <div className="panel-pagination__pages" aria-label="Paginação do catálogo">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`panel-filter-chip ${page === currentPage ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                Próxima
              </button>
            </div>
          ) : null}
        </article>
      </div>

      {quickEditOpen ? (
        <div className="panel-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="catalog-quick-edit-title">
          <button type="button" className="panel-drawer-overlay__backdrop" aria-label="Fechar edição rápida" onClick={() => {
            setQuickEditOpen(false);
            setQuickEditForm(null);
            setQuickEditError(null);
          }} />
          <aside className="panel-drawer">
            <div className="panel-drawer__header">
              <div>
                <p className="panel-kicker">Catálogo</p>
                <h2 id="catalog-quick-edit-title">Edição rápida</h2>
                <p className="panel-muted">Ajuste os campos operacionais principais sem sair da listagem.</p>
              </div>
              <button type="button" className="panel-editor-modal__close" onClick={() => {
                setQuickEditOpen(false);
                setQuickEditForm(null);
                setQuickEditError(null);
              }} aria-label="Fechar edição rápida">
                ×
              </button>
            </div>

            <div className="panel-drawer__body">
              {quickEditLoading ? <p className="panel-muted">Carregando produto...</p> : null}
              {quickEditError ? <p className="panel-feedback panel-feedback-error">{quickEditError}</p> : null}

              {quickEditForm ? (
                <form className="panel-form" onSubmit={handleSaveQuickEdit}>
                  <div className="panel-catalog-form-grid">
                    <div className="panel-field">
                      <label htmlFor="quick-name">Nome</label>
                      <input id="quick-name" className="panel-input" value={quickEditForm.name} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-slug">Slug</label>
                      <input id="quick-slug" className="panel-input" value={quickEditForm.slug} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, slug: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-brand">Marca</label>
                      <input id="quick-brand" className="panel-input" value={quickEditForm.brand} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, brand: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-status">Situação</label>
                      <select id="quick-status" className="panel-select" value={quickEditForm.status} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, status: event.target.value as CatalogProductStatus } : prev))}>
                        <option value="draft">Rascunho</option>
                        <option value="active">Ativo</option>
                        <option value="archived">Arquivado</option>
                      </select>
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-category">Categoria principal</label>
                      <select id="quick-category" className="panel-select" value={quickEditForm.category} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, category: event.target.value } : prev))}>
                        <option value="">Selecione</option>
                        {availableCategories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-collections">Coleções</label>
                      <input id="quick-collections" className="panel-input" list="catalog-collections-suggestions" value={quickEditForm.collections} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, collections: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-price">Preço</label>
                      <input id="quick-price" className="panel-input" type="number" step="0.01" value={quickEditForm.price} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, price: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-list-price">Preço de lista</label>
                      <input id="quick-list-price" className="panel-input" type="number" step="0.01" value={quickEditForm.listPrice} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, listPrice: event.target.value } : prev))} />
                    </div>
                    <div className="panel-field">
                      <label htmlFor="quick-stock">Estoque disponível</label>
                      <input id="quick-stock" className="panel-input" type="number" step="1" value={quickEditForm.stockQuantity} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, stockQuantity: event.target.value } : prev))} />
                    </div>
                  </div>

                  <label className="panel-checkbox panel-checkbox--full">
                    <input type="checkbox" checked={quickEditForm.available} onChange={(event) => setQuickEditForm((prev) => (prev ? { ...prev, available: event.target.checked } : prev))} />
                    <span>Disponível para venda</span>
                  </label>

                  <div className="panel-form-actions">
                    <button className="panel-btn panel-btn-primary" type="submit" disabled={quickEditSaving}>
                      {quickEditSaving ? 'Salvando...' : 'Salvar ajustes'}
                    </button>
                    <button className="panel-btn panel-btn-secondary" type="button" onClick={() => {
                      setQuickEditOpen(false);
                      setQuickEditForm(null);
                      setQuickEditError(null);
                    }}>
                      Fechar
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
