'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SITE_ROUTE_NAMESPACES,
  buildNamespacedRoutePath,
  describeSiteRoutePath,
  getSiteRouteNamespace,
  resolveSiteRouteNamespaceBySlug,
  type SiteRouteNamespaceId,
} from '@/features/ecommpanel/siteNamespaces';
import type { SiteBlock, SiteBlockType, SiteLayoutPreset, SitePage, SitePageSlot } from '@/features/ecommpanel/types/siteBuilder';
import SitePagePreview from './SitePagePreview';

type MeResponse = { csrfToken?: string };
type ApiError = { error?: string };
type ListPagesResponse = { pages?: SitePage[]; error?: string };
type RouteListResponse = {
  routes?: Array<{
    id: string;
    title: string;
    slug: string;
    status: 'draft' | 'published' | 'archived';
    updatedAt: string;
    publishedAt?: string;
  }>;
  error?: string;
};

type DragPayload =
  | { kind: 'new'; blockType: SiteBlockType }
  | { kind: 'existing'; fromSlotId: string; blockId: string };

const DRAG_MIME = 'application/x-ecommpanel-block';

const BLOCK_LABELS: Record<SiteBlockType, string> = {
  hero: 'Hero',
  rich_text: 'Texto',
  cta: 'CTA',
  banner: 'Banner',
  product_card: 'Card Produto',
  product_shelf: 'Vitrine',
};

const BLOCK_ICONS: Record<SiteBlockType, string> = {
  hero: 'H',
  rich_text: 'T',
  cta: 'C',
  banner: 'B',
  product_card: 'P',
  product_shelf: 'V',
};

function ToolPreview({ blockType }: { blockType: SiteBlockType }) {
  if (blockType === 'hero') {
    return (
      <span className="panel-tool-preview panel-tool-preview--hero" aria-hidden>
        <span />
        <span />
      </span>
    );
  }

  if (blockType === 'rich_text') {
    return (
      <span className="panel-tool-preview panel-tool-preview--text" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (blockType === 'cta') {
    return (
      <span className="panel-tool-preview panel-tool-preview--cta" aria-hidden>
        <span />
      </span>
    );
  }

  if (blockType === 'banner') {
    return (
      <span className="panel-tool-preview panel-tool-preview--banner" aria-hidden>
        <span />
        <span />
      </span>
    );
  }

  if (blockType === 'product_card') {
    return (
      <span className="panel-tool-preview panel-tool-preview--product" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    );
  }

  return (
    <span className="panel-tool-preview panel-tool-preview--shelf" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

const LAYOUT_OPTIONS: Array<{ value: SiteLayoutPreset; label: string }> = [
  { value: 'single_block', label: 'Monobloco (1 área)' },
  { value: 'tic_tac_toe', label: 'Jogo da velha (3x3)' },
  { value: 'four_quadrants', label: '4 blocos (2x2)' },
  { value: 'three_horizontal', label: '3 blocos horizontais' },
  { value: 'three_vertical', label: '3 blocos verticais' },
];

const HORIZONTAL_COLUMNS = 3;
const MAX_HORIZONTAL_ROWS = 10;
const MAX_VERTICAL_AREAS = 10;

function slotCountFromPreset(preset: SiteLayoutPreset): number {
  if (preset === 'single_block') return 1;
  if (preset === 'tic_tac_toe') return 9;
  if (preset === 'four_quadrants') return 4;
  return 3;
}

function makeDefaultBlock(type: SiteBlockType): SiteBlock {
  const id = `blk-${Math.random().toString(36).slice(2, 8)}`;

  if (type === 'hero') {
    return {
      id,
      type,
      enabled: true,
      data: { title: 'Título Hero', subtitle: 'Subtítulo de apoio.' },
    };
  }

  if (type === 'rich_text') {
    return {
      id,
      type,
      enabled: true,
      data: { content: 'Texto editável da página.' },
    };
  }

  if (type === 'cta') {
    return {
      id,
      type,
      enabled: true,
      data: { label: 'Saiba mais', href: '/e-commerce' },
    };
  }

  if (type === 'banner') {
    return {
      id,
      type,
      enabled: true,
      data: { title: 'Banner promocional', imageUrl: '/images/image-banner.webp' },
    };
  }

  if (type === 'product_card') {
    return {
      id,
      type,
      enabled: true,
      data: { skuRef: 'SKU-EXEMPLO-001', title: 'Produto em destaque', price: 19.9 },
    };
  }

  return {
    id,
    type,
    enabled: true,
    data: { title: 'Vitrine de produtos', collection: 'ofertas' },
  };
}

function normalizeSlotsForPreset(preset: SiteLayoutPreset, current: SitePageSlot[]): SitePageSlot[] {
  const desiredCount =
    preset === 'three_horizontal'
      ? Math.max(HORIZONTAL_COLUMNS, Math.min(current.length || HORIZONTAL_COLUMNS, HORIZONTAL_COLUMNS * MAX_HORIZONTAL_ROWS))
      : preset === 'three_vertical'
        ? Math.max(1, Math.min(current.length || 3, MAX_VERTICAL_AREAS))
        : slotCountFromPreset(preset);
  const next: SitePageSlot[] = [];

  for (let index = 0; index < desiredCount; index += 1) {
    const existing = current[index];
    next.push({
      id: existing?.id || `slot-${index + 1}`,
      label: `Área ${index + 1}`,
      blocks: existing?.blocks || [],
    });
  }

  return next;
}

function createTemplateSlots(preset: SiteLayoutPreset, baseSlots?: SitePageSlot[]): SitePageSlot[] {
  const slots = normalizeSlotsForPreset(preset, baseSlots || []);

  const templateByPreset: Record<SiteLayoutPreset, SiteBlockType[][]> = {
    single_block: [['hero', 'rich_text', 'cta']],
    three_vertical: [['hero'], ['rich_text', 'cta'], ['product_shelf']],
    three_horizontal: [['hero'], ['banner'], ['product_shelf']],
    four_quadrants: [['hero'], ['rich_text'], ['banner'], ['cta']],
    tic_tac_toe: [
      ['hero'],
      ['rich_text'],
      ['cta'],
      ['banner'],
      ['product_card'],
      ['product_shelf'],
      ['rich_text'],
      ['cta'],
      ['product_shelf'],
    ],
  };

  const plan = templateByPreset[preset];
  return slots.map((slot, index) => ({
    ...slot,
    blocks: (plan[index] || []).map((type) => makeDefaultBlock(type)),
  }));
}

function cloneSlots(slots: SitePageSlot[]): SitePageSlot[] {
  return JSON.parse(JSON.stringify(slots)) as SitePageSlot[];
}

function resolveInitialPageId(pages: SitePage[], preferredId: string | null): string {
  if (preferredId && pages.some((page) => page.id === preferredId)) return preferredId;
  return pages[0]?.id || '';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isBlockType(value: string): value is SiteBlockType {
  return value in BLOCK_LABELS;
}

function encodeDragPayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

function decodeDragPayload(raw: string): DragPayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed.kind === 'new' && isBlockType(parsed.blockType)) return parsed;
    if (parsed.kind === 'existing' && parsed.fromSlotId && parsed.blockId) return parsed;
  } catch {
    if (isBlockType(raw)) {
      return { kind: 'new', blockType: raw };
    }
  }

  return null;
}

export default function SiteEditorManager() {
  const searchParams = useSearchParams();
  const preferredPageId = searchParams.get('pageId');

  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routes, setRoutes] = useState<RouteListResponse['routes']>([]);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoNoIndex, setSeoNoIndex] = useState(true);
  const [themeBackgroundColor, setThemeBackgroundColor] = useState('#ffffff');
  const [themeTextColor, setThemeTextColor] = useState('#0f172a');
  const [themeAccentColor, setThemeAccentColor] = useState('#1f4738');
  const [layoutPreset, setLayoutPreset] = useState<SiteLayoutPreset>('three_vertical');
  const [slots, setSlots] = useState<SitePageSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [activeTool, setActiveTool] = useState<SiteBlockType>('hero');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<'all' | SiteRouteNamespaceId>('all');
  const [namespaceId, setNamespaceId] = useState<SiteRouteNamespaceId>('landing');
  const [customPrefix, setCustomPrefix] = useState('');
  const [leafPath, setLeafPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPage = useMemo(() => pages.find((page) => page.id === selectedPageId) || null, [pages, selectedPageId]);
  const selectedSlot = useMemo(() => slots.find((slot) => slot.id === selectedSlotId) || null, [slots, selectedSlotId]);
  const canAdjustAreas = layoutPreset === 'three_horizontal' || layoutPreset === 'three_vertical';
  const isHorizontalPreset = layoutPreset === 'three_horizontal';
  const horizontalRows = isHorizontalPreset ? Math.ceil(slots.length / HORIZONTAL_COLUMNS) : 0;
  const selectedNamespace = getSiteRouteNamespace(namespaceId);
  const namespaceExample = describeSiteRoutePath(selectedNamespace.examplePath);
  const composedSlug = useMemo(
    () => buildNamespacedRoutePath({ namespaceId, customPrefix, leafPath }),
    [customPrefix, leafPath, namespaceId],
  );

  const filteredRoutes = useMemo(() => {
    const items = routes || [];
    const term = query.trim().toLowerCase();
    return items.filter((route) => {
      const namespace = resolveSiteRouteNamespaceBySlug(route.slug);
      const matchesNamespace = namespaceFilter === 'all' || namespace.id === namespaceFilter;
      const matchesTerm = !term || route.title.toLowerCase().includes(term) || route.slug.toLowerCase().includes(term);
      return matchesNamespace && matchesTerm;
    });
  }, [namespaceFilter, query, routes]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, routesReq, pagesReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/site/routes', { cache: 'no-store' }),
        fetch('/api/ecommpanel/site/pages', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      if (mePayload?.csrfToken) setCsrfToken(mePayload.csrfToken);

      const routesPayload = (await routesReq.json().catch(() => null)) as RouteListResponse | null;
      const pagesPayload = (await pagesReq.json().catch(() => null)) as ListPagesResponse | null;

      if (!routesReq.ok) {
        setError(routesPayload?.error || 'Falha ao carregar rotas.');
        return;
      }

      if (!pagesReq.ok) {
        setError(pagesPayload?.error || 'Falha ao carregar páginas.');
        return;
      }

      const nextPages = pagesPayload?.pages || [];
      const nextRoutes = routesPayload?.routes || [];

      setPages(nextPages);
      setRoutes(nextRoutes);

      const nextSelected = resolveInitialPageId(nextPages, preferredPageId || selectedPageId);
      setSelectedPageId(nextSelected);
      loadPageInEditor(nextPages.find((page) => page.id === nextSelected) || null);
    } catch {
      setError('Erro de rede ao carregar editor.');
    } finally {
      setLoading(false);
    }
  }

  function loadPageInEditor(page: SitePage | null) {
    if (!page) {
      setTitle('');
      setSlug('');
      setNamespaceId('landing');
      setCustomPrefix('');
      setLeafPath('');
      setDescription('');
      setSeoTitle('');
      setSeoDescription('');
      setSeoKeywords('');
      setSeoNoIndex(true);
      setThemeBackgroundColor('#ffffff');
      setThemeTextColor('#0f172a');
      setThemeAccentColor('#1f4738');
      setLayoutPreset('three_vertical');
      setSlots([]);
      setSelectedSlotId('');
      return;
    }

    const routeContext = describeSiteRoutePath(page.slug);
    setTitle(page.title);
    setSlug(page.slug);
    setNamespaceId(routeContext.namespace.id);
    setCustomPrefix(routeContext.customPrefix);
    setLeafPath(routeContext.leafPath);
    setDescription(page.description);
    setSeoTitle(page.seo?.title || page.title);
    setSeoDescription(page.seo?.description || page.description);
    setSeoKeywords(page.seo?.keywords || '');
    setSeoNoIndex(Boolean(page.seo?.noIndex));
    setThemeBackgroundColor(page.theme?.backgroundColor || '#ffffff');
    setThemeTextColor(page.theme?.textColor || '#0f172a');
    setThemeAccentColor(page.theme?.accentColor || '#1f4738');
    setLayoutPreset(page.layoutPreset);
    const normalized = normalizeSlotsForPreset(page.layoutPreset, cloneSlots(page.slots));
    setSlots(normalized);
    setSelectedSlotId(normalized[0]?.id || '');
  }

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (composedSlug === slug) return;
    setSlug(composedSlug);
  }, [composedSlug, slug]);

  useEffect(() => {
    if (!isModalOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  function openEditorForPage(pageId: string) {
    setSelectedPageId(pageId);
    const page = pages.find((item) => item.id === pageId) || null;
    loadPageInEditor(page);
    setIsModalOpen(true);
  }

  function onChangePreset(nextPreset: SiteLayoutPreset) {
    setLayoutPreset(nextPreset);
    setSlots((current) => {
      const normalized = normalizeSlotsForPreset(nextPreset, current);
      if (!normalized.some((slot) => slot.id === selectedSlotId)) {
        setSelectedSlotId(normalized[0]?.id || '');
      }
      return normalized;
    });
  }

  function insertBlockByDrag(payload: DragPayload, targetSlotId: string, targetIndex: number) {
    setSlots((current) => {
      const snapshot = current.map((slot) => ({ ...slot, blocks: [...slot.blocks] }));
      let blockToInsert: SiteBlock | null = null;
      let normalizedTargetIndex = targetIndex;

      if (payload.kind === 'new') {
        blockToInsert = makeDefaultBlock(payload.blockType);
      } else {
        const fromSlot = snapshot.find((slot) => slot.id === payload.fromSlotId);
        if (!fromSlot) return current;
        const sourceIndex = fromSlot.blocks.findIndex((block) => block.id === payload.blockId);
        if (sourceIndex < 0) return current;

        const [movedBlock] = fromSlot.blocks.splice(sourceIndex, 1);
        blockToInsert = movedBlock;

        if (payload.fromSlotId === targetSlotId && sourceIndex < normalizedTargetIndex) {
          normalizedTargetIndex -= 1;
        }
      }

      const targetSlot = snapshot.find((slot) => slot.id === targetSlotId);
      if (!targetSlot || !blockToInsert) return current;

      const clamped = Math.max(0, Math.min(normalizedTargetIndex, targetSlot.blocks.length));
      targetSlot.blocks.splice(clamped, 0, blockToInsert);
      return snapshot;
    });
  }

  function removeBlock(slotId: string, blockId: string) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        return {
          ...slot,
          blocks: slot.blocks.filter((block) => block.id !== blockId),
        };
      }),
    );
  }

  function moveBlockInSlot(slotId: string, blockId: string, direction: 'up' | 'down') {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        const index = slot.blocks.findIndex((block) => block.id === blockId);
        if (index < 0) return slot;
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= slot.blocks.length) return slot;
        const blocks = [...slot.blocks];
        const [item] = blocks.splice(index, 1);
        blocks.splice(target, 0, item);
        return { ...slot, blocks };
      }),
    );
  }

  function toggleBlock(slotId: string, blockId: string, enabled: boolean) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        return {
          ...slot,
          blocks: slot.blocks.map((block) => (block.id === blockId ? { ...block, enabled } : block)),
        };
      }),
    );
  }

  function updateBlockText(slotId: string, blockId: string, field: string, value: string) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        return {
          ...slot,
          blocks: slot.blocks.map((block) => {
            if (block.id !== blockId) return block;
            return {
              ...block,
              data: {
                ...block.data,
                [field]: block.type === 'product_card' && field === 'price' ? Number(value) || 0 : value,
              },
            } as SiteBlock;
          }),
        };
      }),
    );
  }

  function updateBlockStyle(slotId: string, blockId: string, field: 'backgroundColor' | 'textColor', value: string) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        return {
          ...slot,
          blocks: slot.blocks.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  style: {
                    ...block.style,
                    [field]: value,
                  },
                }
              : block,
          ),
        };
      }),
    );
  }

  function onDropAtPosition(event: React.DragEvent<HTMLElement>, slotId: string, targetIndex: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain');
    const payload = decodeDragPayload(raw);
    if (!payload) return;

    insertBlockByDrag(payload, slotId, targetIndex);
    setSelectedSlotId(slotId);
    setDragOverKey(null);
  }

  function insertActiveToolIntoSelectedSlot() {
    if (!selectedSlotId) return;
    insertBlockByDrag({ kind: 'new', blockType: activeTool }, selectedSlotId, Number.MAX_SAFE_INTEGER);
  }

  function applyEmptyStart() {
    setSlots((current) => current.map((slot) => ({ ...slot, blocks: [] })));
  }

  function applyTemplateStart() {
    setSlots((current) => createTemplateSlots(layoutPreset, current));
    setSelectedSlotId((current) => current || 'slot-1');
  }

  function addArea() {
    if (!canAdjustAreas) return;
    setSlots((current) => {
      const increment = isHorizontalPreset ? HORIZONTAL_COLUMNS : 1;
      const maxSlots = isHorizontalPreset ? HORIZONTAL_COLUMNS * MAX_HORIZONTAL_ROWS : MAX_VERTICAL_AREAS;
      if (current.length >= maxSlots) return current;

      const next = [...current];
      for (let i = 0; i < increment && next.length < maxSlots; i += 1) {
        const nextIndex = next.length + 1;
        next.push({ id: `slot-${nextIndex}`, label: `Área ${nextIndex}`, blocks: [] });
      }
      return next;
    });
  }

  function removeArea() {
    if (!canAdjustAreas) return;
    setSlots((current) => {
      const decrement = isHorizontalPreset ? HORIZONTAL_COLUMNS : 1;
      const minSlots = isHorizontalPreset ? HORIZONTAL_COLUMNS : 1;
      if (current.length <= minSlots) return current;
      const next = current.slice(0, Math.max(minSlots, current.length - decrement));
      const stillExists = next.some((slot) => slot.id === selectedSlotId);
      if (!stillExists) {
        setSelectedSlotId(next[next.length - 1]?.id || '');
      }
      return next;
    });
  }

  async function saveDraft() {
    if (!selectedPageId || !csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/site/pages/${selectedPageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          title,
          slug,
          description,
          seo: {
            title: seoTitle || title,
            description: seoDescription || description,
            keywords: seoKeywords,
            noIndex: seoNoIndex,
          },
          theme: {
            backgroundColor: themeBackgroundColor,
            textColor: themeTextColor,
            accentColor: themeAccentColor,
          },
          layoutPreset,
          slots,
        }),
      });

      const payload = (await req.json().catch(() => null)) as ApiError | null;
      if (!req.ok) {
        setError(payload?.error || 'Falha ao salvar rascunho.');
        return;
      }

      setSuccess('Rascunho salvo com sucesso.');
      await fetchData();
    } catch {
      setError('Erro de rede ao salvar rascunho.');
    } finally {
      setSaving(false);
    }
  }

  async function publishOrDraft(nextStatus: 'published' | 'draft') {
    if (!selectedPageId || !csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = nextStatus === 'published' ? 'publish' : 'draft';
      const req = await fetch(`/api/ecommpanel/site/pages/${selectedPageId}/${endpoint}`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });

      const payload = (await req.json().catch(() => null)) as ApiError | null;
      if (!req.ok) {
        setError(payload?.error || 'Falha ao alterar status da página.');
        return;
      }

      setSuccess(nextStatus === 'published' ? 'Página publicada com sucesso.' : 'Página voltou para rascunho.');
      await fetchData();
    } catch {
      setError('Erro de rede ao alterar status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="site-editor-title">
      <article className="panel-card panel-card-hero">
        <p className="panel-kicker">Experiência do Site · Editor</p>
        <h1 id="site-editor-title">Editor visual por rota</h1>
        <p className="panel-muted">
          Escolha uma rota e monte a página com arrastar e soltar. Depois de publicar, a loja passa a ler essa versão sem precisar criar arquivos novos em `src/app/e-commerce`.
        </p>
      </article>

      <article className="panel-card">
        <div className="panel-users-toolbar">
          <h2>Rotas disponíveis para edição</h2>
          <div className="panel-inline panel-inline-wrap">
            <select
              className="panel-select"
              value={namespaceFilter}
              onChange={(event) => setNamespaceFilter(event.target.value as 'all' | SiteRouteNamespaceId)}
              aria-label="Filtrar rotas por namespace"
            >
              <option value="all">Todos os namespaces</option>
              {SITE_ROUTE_NAMESPACES.map((namespace) => (
                <option key={namespace.id} value={namespace.id}>
                  {namespace.label}
                </option>
              ))}
            </select>
            <input
              className="panel-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar rota por título ou caminho"
              aria-label="Buscar rota"
            />
          </div>
        </div>

        {loading ? <p className="panel-muted">Carregando rotas...</p> : null}

        {!loading && filteredRoutes.length > 0 ? (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>Status</th>
                  <th>Atualização</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route) => {
                  const routeContext = describeSiteRoutePath(route.slug);
                  return (
                    <tr key={route.id}>
                      <td>
                        <strong>{route.title}</strong>
                        <br />
                        <span className="panel-badge panel-badge-neutral">{routeContext.namespace.label}</span>
                        <br />
                        <span className="panel-muted">/{route.slug}</span>
                      </td>
                      <td>
                        <span className={`panel-badge ${route.status === 'published' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {route.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </span>
                      </td>
                      <td>{formatDate(route.updatedAt)}</td>
                      <td>
                        <button type="button" className="panel-btn panel-btn-primary panel-btn-sm" onClick={() => openEditorForPage(route.id)}>
                          Abrir editor
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && filteredRoutes.length === 0 ? <p className="panel-table-empty">Nenhuma rota encontrada para edição.</p> : null}
      </article>

      {selectedPage ? (
        <article className="panel-card">
          <div className="panel-inline panel-inline-between panel-inline-wrap">
            <div>
              <h2>Pré-visualização da rota selecionada</h2>
              <p className="panel-muted">
                {title} · /{slug}
              </p>
              <div className="panel-inline panel-inline-wrap">
                <span className="panel-badge panel-badge-neutral">{selectedNamespace.label}</span>
                <span className="panel-badge panel-badge-neutral">Preset sugerido: {selectedNamespace.layoutPreset}</span>
                {customPrefix ? <span className="panel-badge panel-badge-neutral">Prefixo: {customPrefix}</span> : null}
              </div>
            </div>
            <button type="button" className="panel-btn panel-btn-secondary" onClick={() => setIsModalOpen(true)}>
              Reabrir editor
            </button>
          </div>
          <SitePagePreview
            title={title}
            slug={slug}
            description={description}
            layoutPreset={layoutPreset}
            slots={slots}
            theme={{
              backgroundColor: themeBackgroundColor,
              textColor: themeTextColor,
              accentColor: themeAccentColor,
            }}
          />
        </article>
      ) : null}

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

      {isModalOpen && selectedPage ? (
        <div className="panel-editor-modal" role="dialog" aria-modal="true" aria-label="Editor visual da página">
          <div className="panel-editor-modal__content">
            <header className="panel-editor-modal__header">
              <div>
                <h2>{title || 'Página sem título'}</h2>
                <div className="panel-inline panel-inline-wrap">
                  <span className="panel-badge panel-badge-neutral">{selectedNamespace.label}</span>
                  <span className="panel-badge panel-badge-neutral">/{slug || 'slug-da-pagina'}</span>
                  <span className="panel-badge panel-badge-neutral">Preset sugerido: {selectedNamespace.layoutPreset}</span>
                </div>
                <p className="panel-muted">{selectedNamespace.description}</p>
              </div>
              <div className="panel-inline panel-inline-wrap">
                <button
                  type="button"
                  className="panel-btn panel-btn-secondary"
                  onClick={() => publishOrDraft('draft')}
                  disabled={saving || selectedPage.status === 'draft'}
                  title="Retorna a página para rascunho sem remover conteúdo"
                >
                  Rascunho
                </button>
                <button
                  type="button"
                  className="panel-btn panel-btn-primary"
                  onClick={() => publishOrDraft('published')}
                  disabled={saving || selectedPage.status === 'published'}
                  title="Publica a versão atual para uso na loja"
                >
                  Publicar
                </button>
                <button type="button" className="panel-btn panel-btn-secondary" onClick={saveDraft} disabled={saving} title="Salva as alterações sem publicar">
                  Salvar
                </button>
              </div>
              <button type="button" className="panel-editor-modal__close" onClick={() => setIsModalOpen(false)} aria-label="Fechar editor">
                ×
              </button>
            </header>

            <div className="panel-editor-toolbar" aria-label="Ferramentas do editor">
              <div className="panel-editor-toolbar__tools">
                {(Object.keys(BLOCK_LABELS) as SiteBlockType[]).map((blockType) => (
                  <button
                    key={blockType}
                    type="button"
                    className={`panel-editor-tool-square ${activeTool === blockType ? 'is-active' : ''}`}
                    onClick={() => setActiveTool(blockType)}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_MIME, encodeDragPayload({ kind: 'new', blockType }));
                      event.dataTransfer.setData('text/plain', blockType);
                    }}
                    aria-label={`Ferramenta ${BLOCK_LABELS[blockType]}`}
                    title={`Ferramenta ${BLOCK_LABELS[blockType]}`}
                  >
                    <ToolPreview blockType={blockType} />
                    <span>{BLOCK_ICONS[blockType]}</span>
                    <small>{BLOCK_LABELS[blockType]}</small>
                  </button>
                ))}

                <button
                  type="button"
                  className="panel-btn panel-btn-secondary panel-btn-xs panel-editor-toolbar__insert"
                  onClick={insertActiveToolIntoSelectedSlot}
                >
                  Inserir no slot ativo
                </button>
              </div>

              <div className="panel-editor-toolbar__layout">
                <label>Grade</label>
                <div className="panel-layout-presets" role="radiogroup" aria-label="Selecionar grade do layout">
                  {LAYOUT_OPTIONS.map((layout) => (
                    <button
                      key={layout.value}
                      type="button"
                      className={`panel-layout-preset ${layoutPreset === layout.value ? 'is-active' : ''}`}
                      onClick={() => onChangePreset(layout.value)}
                      role="radio"
                      aria-checked={layoutPreset === layout.value}
                      title={layout.label}
                    >
                      <span className={`panel-layout-preset__mini panel-layout-preset__mini--${layout.value}`} aria-hidden>
                        {Array.from({ length: slotCountFromPreset(layout.value) }).map((_, index) => (
                          <span key={`${layout.value}-${index}`} />
                        ))}
                      </span>
                      <span className="panel-layout-preset__label">{layout.label}</span>
                    </button>
                  ))}
                </div>
                {canAdjustAreas ? (
                  <div className="panel-inline panel-inline-wrap panel-editor-areas">
                    <button
                      type="button"
                      className="panel-btn panel-btn-secondary panel-btn-xs"
                      onClick={removeArea}
                      disabled={isHorizontalPreset ? slots.length <= HORIZONTAL_COLUMNS : slots.length <= 1}
                    >
                      {isHorizontalPreset ? '- Linha' : '- Área'}
                    </button>
                    <span className="panel-muted">
                      {isHorizontalPreset ? `${horizontalRows} linhas` : `${slots.length} áreas`}
                    </span>
                    <button
                      type="button"
                      className="panel-btn panel-btn-secondary panel-btn-xs"
                      onClick={addArea}
                      disabled={isHorizontalPreset ? slots.length >= HORIZONTAL_COLUMNS * MAX_HORIZONTAL_ROWS : slots.length >= MAX_VERTICAL_AREAS}
                    >
                      {isHorizontalPreset ? '+ Linha' : '+ Área'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="panel-editor-toolbar__start">
                <span className="panel-muted">Início:</span>
                <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs panel-editor-start-btn" onClick={applyEmptyStart}>
                  Vazio
                </button>
                <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs panel-editor-start-btn" onClick={applyTemplateStart}>
                  Modelo
                </button>
              </div>
            </div>

            <div className="panel-editor-workspace">
              <section className="panel-editor-canvas-wrap">
                <h3>Canvas da página</h3>
                <div className={`panel-editor-canvas panel-editor-canvas--${layoutPreset}`}>
                  {slots.map((slot) => (
                    <section key={slot.id} className={`panel-editor-slot ${selectedSlotId === slot.id ? 'is-selected' : ''}`}>
                      <button type="button" className="panel-editor-slot__meta" onClick={() => setSelectedSlotId(slot.id)}>
                        <span className="panel-editor-slot__title">{slot.label}</span>
                        <span className="panel-editor-slot__count">{slot.blocks.length} bloco(s)</span>
                      </button>

                      <div className="panel-editor-slot__stack">
                        {slot.blocks.map((block, index) => {
                          const keyTop = `${slot.id}-${index}-top`;
                          return (
                            <div key={block.id} className="panel-editor-stack-item">
                              <div
                                className={`panel-editor-dropzone ${dragOverKey === keyTop ? 'is-active' : ''}`}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  setDragOverKey(keyTop);
                                }}
                                onDragLeave={() => setDragOverKey((current) => (current === keyTop ? null : current))}
                                onDrop={(event) => onDropAtPosition(event, slot.id, index)}
                              />

                              <article
                                className="panel-editor-block"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData(DRAG_MIME, encodeDragPayload({ kind: 'existing', fromSlotId: slot.id, blockId: block.id }));
                                  event.dataTransfer.setData('text/plain', block.type);
                                }}
                              >
                                <span className="panel-editor-block__drag">::</span>
                                <span className="panel-editor-block__label">{BLOCK_LABELS[block.type]}</span>
                                <span className={`panel-editor-block__state ${block.enabled ? 'is-on' : 'is-off'}`}>
                                  {block.enabled ? 'Ativo' : 'Inativo'}
                                </span>
                              </article>
                            </div>
                          );
                        })}

                        <div
                          className={`panel-editor-dropzone panel-editor-dropzone--end ${dragOverKey === `${slot.id}-end` ? 'is-active' : ''}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverKey(`${slot.id}-end`);
                          }}
                          onDragLeave={() => setDragOverKey((current) => (current === `${slot.id}-end` ? null : current))}
                          onDrop={(event) => onDropAtPosition(event, slot.id, slot.blocks.length)}
                        >
                          {slot.blocks.length === 0 ? 'Solte blocos aqui' : 'Solte aqui para adicionar ao final'}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </section>

              <aside className="panel-editor-inspector">
                <h3>Propriedades</h3>

                <div className="panel-grid">
                  <div className="panel-form-section panel-editor-meta-full">
                    <div className="panel-inline panel-inline-between panel-inline-wrap">
                      <div>
                        <strong>Rota operacional</strong>
                        <p className="panel-muted">Organize o caminho da página por namespace para manter o catálogo de rotas consistente.</p>
                      </div>
                      <span className="panel-badge panel-badge-neutral">{selectedNamespace.label}</span>
                    </div>

                    <div className="panel-editor-meta-grid">
                      <div className="panel-field">
                        <label htmlFor="editor-namespace">Namespace</label>
                        <select
                          id="editor-namespace"
                          className="panel-select"
                          value={namespaceId}
                          onChange={(event) => setNamespaceId(event.target.value as SiteRouteNamespaceId)}
                        >
                          {SITE_ROUTE_NAMESPACES.map((namespace) => (
                            <option key={namespace.id} value={namespace.id}>
                              {namespace.label}
                            </option>
                          ))}
                        </select>
                        <small className="panel-muted">{selectedNamespace.description}</small>
                      </div>

                      {namespaceId === 'custom' ? (
                        <div className="panel-field">
                          <label htmlFor="editor-custom-prefix">Prefixo custom</label>
                          <input
                            id="editor-custom-prefix"
                            className="panel-input"
                            value={customPrefix}
                            onChange={(event) => setCustomPrefix(event.target.value)}
                            placeholder={namespaceExample.customPrefix || 'especial/parceiros'}
                          />
                        </div>
                      ) : null}

                      <div className="panel-field">
                        <label htmlFor="editor-leaf-path">Entrada final</label>
                        <input
                          id="editor-leaf-path"
                          className="panel-input"
                          value={leafPath}
                          onChange={(event) => setLeafPath(event.target.value)}
                          placeholder={namespaceExample.leafPath || selectedNamespace.examplePath}
                        />
                        <small className="panel-muted">Use letras minúsculas, números e hífen. Barra só quando fizer parte do leaf path.</small>
                      </div>

                      <div className="panel-field">
                        <label htmlFor="editor-slug">Caminho final</label>
                        <input id="editor-slug" className="panel-input" value={`/${slug || 'caminho-da-pagina'}`} readOnly />
                        <small className="panel-muted">Reservados: `plp`, `cart`, `checkout`, `paginas`.</small>
                      </div>
                    </div>
                  </div>

                  <div className="panel-field">
                    <label htmlFor="editor-title">Título</label>
                    <input id="editor-title" className="panel-input" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="editor-description">Descrição</label>
                    <input id="editor-description" className="panel-input" value={description} onChange={(event) => setDescription(event.target.value)} />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="editor-seo-title">SEO · Título</label>
                    <input id="editor-seo-title" className="panel-input" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="editor-seo-description">SEO · Description</label>
                    <textarea
                      id="editor-seo-description"
                      className="panel-textarea"
                      value={seoDescription}
                      onChange={(event) => setSeoDescription(event.target.value)}
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="editor-seo-keywords">SEO · Keywords</label>
                    <input id="editor-seo-keywords" className="panel-input" value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} />
                  </div>
                  <label className="panel-inline panel-inline-wrap panel-editor-switch">
                    <input type="checkbox" checked={seoNoIndex} onChange={(event) => setSeoNoIndex(event.target.checked)} />
                    <span>SEO · noindex</span>
                  </label>
                  <div className="panel-field">
                    <label htmlFor="theme-bg-color">Tema · Fundo</label>
                    <input
                      id="theme-bg-color"
                      className="panel-input panel-color-input"
                      type="color"
                      value={themeBackgroundColor}
                      onChange={(event) => setThemeBackgroundColor(event.target.value)}
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="theme-text-color">Tema · Texto</label>
                    <input
                      id="theme-text-color"
                      className="panel-input panel-color-input"
                      type="color"
                      value={themeTextColor}
                      onChange={(event) => setThemeTextColor(event.target.value)}
                    />
                  </div>
                  <div className="panel-field">
                    <label htmlFor="theme-accent-color">Tema · Destaque</label>
                    <input
                      id="theme-accent-color"
                      className="panel-input panel-color-input"
                      type="color"
                      value={themeAccentColor}
                      onChange={(event) => setThemeAccentColor(event.target.value)}
                    />
                  </div>
                </div>

                <div className="panel-editor-divider" />
                <h3>Blocos do slot</h3>
                {!selectedSlot ? <p className="panel-muted">Selecione uma área da grade.</p> : null}

                {selectedSlot ? (
                  <div className="panel-grid">
                    <p className="panel-muted">{selectedSlot.label}</p>

                    {selectedSlot.blocks.length === 0 ? <p className="panel-muted">Sem blocos nesta área.</p> : null}

                    {selectedSlot.blocks.map((block, index) => (
                      <div key={block.id} className="panel-form-section">
                        <div className="panel-inline panel-inline-between">
                          <strong>{BLOCK_LABELS[block.type]}</strong>
                          <div className="panel-inline panel-inline-wrap">
                            <button
                              type="button"
                              className="panel-btn panel-btn-secondary panel-btn-xs"
                              onClick={() => moveBlockInSlot(selectedSlot.id, block.id, 'up')}
                              disabled={index === 0}
                              aria-label="Subir bloco"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="panel-btn panel-btn-secondary panel-btn-xs"
                              onClick={() => moveBlockInSlot(selectedSlot.id, block.id, 'down')}
                              disabled={index === selectedSlot.blocks.length - 1}
                              aria-label="Descer bloco"
                            >
                              ↓
                            </button>
                            <button type="button" className="panel-btn panel-btn-danger panel-btn-xs" onClick={() => removeBlock(selectedSlot.id, block.id)}>
                              Remover
                            </button>
                          </div>
                        </div>

                        <label className="panel-inline panel-inline-wrap panel-editor-switch">
                          <input type="checkbox" checked={block.enabled} onChange={(event) => toggleBlock(selectedSlot.id, block.id, event.target.checked)} />
                          <span>Bloco ativo</span>
                        </label>

                        {'title' in block.data ? (
                          <input className="panel-input" value={String(block.data.title || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'title', event.target.value)} placeholder="Título" />
                        ) : null}

                        {'subtitle' in block.data ? (
                          <input className="panel-input" value={String(block.data.subtitle || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'subtitle', event.target.value)} placeholder="Subtítulo" />
                        ) : null}

                        {'content' in block.data ? (
                          <textarea className="panel-textarea" value={String(block.data.content || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'content', event.target.value)} placeholder="Conteúdo" />
                        ) : null}

                        {'label' in block.data ? (
                          <input className="panel-input" value={String(block.data.label || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'label', event.target.value)} placeholder="Texto do botão" />
                        ) : null}

                        {'href' in block.data ? (
                          <input className="panel-input" value={String(block.data.href || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'href', event.target.value)} placeholder="Destino do botão" />
                        ) : null}

                        {'imageUrl' in block.data ? (
                          <input className="panel-input" value={String(block.data.imageUrl || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'imageUrl', event.target.value)} placeholder="URL da imagem" />
                        ) : null}

                        {'skuRef' in block.data ? (
                          <input className="panel-input" value={String(block.data.skuRef || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'skuRef', event.target.value)} placeholder="SKU" />
                        ) : null}

                        {'collection' in block.data ? (
                          <input className="panel-input" value={String(block.data.collection || '')} onChange={(event) => updateBlockText(selectedSlot.id, block.id, 'collection', event.target.value)} placeholder="Coleção" />
                        ) : null}

                        <div className="panel-editor-block-colors">
                          <label className="panel-field">
                            <span>Cor de fundo</span>
                            <input
                              className="panel-input panel-color-input"
                              type="color"
                              value={block.style?.backgroundColor || '#ffffff'}
                              onChange={(event) => updateBlockStyle(selectedSlot.id, block.id, 'backgroundColor', event.target.value)}
                            />
                          </label>
                          <label className="panel-field">
                            <span>Cor do texto</span>
                            <input
                              className="panel-input panel-color-input"
                              type="color"
                              value={block.style?.textColor || '#0f172a'}
                              onChange={(event) => updateBlockStyle(selectedSlot.id, block.id, 'textColor', event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
