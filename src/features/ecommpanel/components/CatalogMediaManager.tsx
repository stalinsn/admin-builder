'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { PanelMediaAsset } from '@/features/ecommpanel/types/panelMediaSettings';

type MediaAssetsResponse = {
  assets?: PanelMediaAsset[];
  error?: string;
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getPreviewUrl(asset: PanelMediaAsset): string {
  return (
    asset.variants.productThumb?.url ||
    asset.variants.contentCard?.url ||
    asset.variants.productPdp?.url ||
    Object.values(asset.variants)[0]?.url ||
    ''
  );
}

function getLargePreviewUrl(asset: PanelMediaAsset): string {
  return (
    asset.variants.productZoom?.url ||
    asset.variants.productPdp?.url ||
    asset.variants.contentHero?.url ||
    getPreviewUrl(asset)
  );
}

const ASSETS_PER_PAGE = 8;

export default function CatalogMediaManager() {
  const [assets, setAssets] = useState<PanelMediaAsset[]>([]);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'product' | 'generic'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewAsset, setPreviewAsset] = useState<PanelMediaAsset | null>(null);

  async function loadAssets() {
    setLoading(true);
    setError(null);

    try {
      const query = scopeFilter === 'all' ? '' : `?scope=${scopeFilter}`;
      const response = await fetch(`/api/ecommpanel/media/assets${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as MediaAssetsResponse | null;

      if (!response.ok) {
        setError(payload?.error || 'Não foi possível carregar a biblioteca de mídia.');
        return;
      }

      setAssets(payload?.assets || []);
    } catch {
      setError('Erro de rede ao carregar a biblioteca de mídia.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, [scopeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, scopeFilter]);

  const stats = useMemo(() => {
    const totalVariants = assets.reduce((sum, asset) => sum + Object.keys(asset.variants).length, 0);
    const totalBytes = assets.reduce((sum, asset) => {
      return sum + Object.values(asset.variants).reduce((variantSum, variant) => variantSum + variant.bytes, 0);
    }, 0);

    return {
      totalAssets: assets.length,
      totalVariants,
      totalBytes,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((asset) => {
      const haystack = [
        asset.originalName,
        asset.scope,
        asset.id,
        ...Object.keys(asset.variants),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [assets, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ASSETS_PER_PAGE));
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * ASSETS_PER_PAGE;
    return filteredAssets.slice(start, start + ASSETS_PER_PAGE);
  }, [currentPage, filteredAssets]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <section className="panel-grid" aria-labelledby="catalog-media-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Catálogo</p>
        <h1 id="catalog-media-title">Biblioteca de mídia</h1>
        <p className="panel-muted">
          Gerencie imagens tratadas pelo servidor sem depender do formulário de produto. Aqui você consulta o que já foi enviado e quais variantes foram geradas.
        </p>
        <div className="panel-catalog-architecture">
          <div>
            <strong>Operação independente</strong>
            <span>Produtos podem usar a mídia gerada, mas a biblioteca existe como módulo próprio da operação.</span>
          </div>
          <div>
            <strong>Política centralizada</strong>
            <span>
              Os tamanhos máximos, formatos e compressão ficam em{' '}
              <Link href="/ecommpanel/admin/settings/media">Configurações do painel &gt; Mídia e imagens</Link>.
            </span>
          </div>
        </div>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Assets</span>
          <strong>{stats.totalAssets}</strong>
          <span>Arquivos já processados</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Variantes</span>
          <strong>{stats.totalVariants}</strong>
          <span>Versões geradas pelos presets</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Volume gerado</span>
          <strong>{formatBytes(stats.totalBytes)}</strong>
          <span>Total estimado dos arquivos publicados</span>
        </article>
      </div>

      <article className="panel-card">
        <div className="panel-toolbar">
          <div className="panel-toolbar__top">
            <div className="panel-toolbar__copy">
              <h2>Assets publicados</h2>
              <p className="panel-muted">Use a biblioteca para revisar imagens antes de reaproveitá-las em produto, blog ou landing page.</p>
            </div>
            <div className="panel-toolbar__filters">
              <label className="panel-search" aria-label="Buscar na biblioteca de mídia">
                <span className="panel-search__icon" aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, escopo ou preset"
                />
              </label>
              <button type="button" className={`panel-filter-chip ${scopeFilter === 'all' ? 'is-active' : ''}`} onClick={() => setScopeFilter('all')}>
                Todos
              </button>
              <button type="button" className={`panel-filter-chip ${scopeFilter === 'product' ? 'is-active' : ''}`} onClick={() => setScopeFilter('product')}>
                Produtos
              </button>
              <button type="button" className={`panel-filter-chip ${scopeFilter === 'generic' ? 'is-active' : ''}`} onClick={() => setScopeFilter('generic')}>
                Genéricos
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
        {loading ? <p className="panel-muted">Carregando biblioteca de mídia...</p> : null}

        {!loading ? (
          <div className="panel-catalog-results-meta">
            <span>
              Mostrando {filteredAssets.length ? (currentPage - 1) * ASSETS_PER_PAGE + 1 : 0}-
              {Math.min(currentPage * ASSETS_PER_PAGE, filteredAssets.length)} de {filteredAssets.length}
            </span>
            <span>{totalPages} página{totalPages > 1 ? 's' : ''}</span>
          </div>
        ) : null}

        {!loading && filteredAssets.length > ASSETS_PER_PAGE ? (
          <div className="panel-pagination panel-pagination--inline">
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span className="panel-pagination__summary">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </button>
          </div>
        ) : null}

        {!loading && !filteredAssets.length ? (
          <p className="panel-table-empty">Nenhum asset encontrado neste filtro.</p>
        ) : null}

        {!loading && filteredAssets.length ? (
          <div className="panel-media-library">
            {paginatedAssets.map((asset) => (
              <article key={asset.id} className="panel-media-library__item">
                <button type="button" className="panel-media-library__preview" onClick={() => setPreviewAsset(asset)}>
                  {getPreviewUrl(asset) ? <img src={getPreviewUrl(asset)} alt={asset.originalName} /> : <span>sem preview</span>}
                </button>
                <div className="panel-media-library__body">
                  <div className="panel-media-library__head">
                    <div>
                      <strong>{asset.originalName}</strong>
                      <p className="panel-muted">
                        Escopo <code>{asset.scope}</code> • enviado em {formatDate(asset.uploadedAt)}
                      </p>
                    </div>
                    <div className="panel-inline panel-inline-wrap">
                      <span className="panel-badge panel-badge-neutral">{formatBytes(asset.originalBytes)}</span>
                      <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => setPreviewAsset(asset)}>
                        Visualizar
                      </button>
                    </div>
                  </div>

                  <div className="panel-media-library__variants">
                    {Object.values(asset.variants).map((variant) => (
                      <div key={variant.key} className="panel-media-library__variant">
                        <strong>{variant.key}</strong>
                        <span>
                          {variant.width}x{variant.height} • {variant.format.toUpperCase()} • {formatBytes(variant.bytes)}
                        </span>
                        <a href={variant.url} target="_blank" rel="noreferrer">
                          Abrir arquivo
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && filteredAssets.length > ASSETS_PER_PAGE ? (
          <div className="panel-pagination">
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <div className="panel-pagination__pages" aria-label="Paginação da biblioteca de mídia">
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
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </button>
          </div>
        ) : null}
      </article>

      {previewAsset ? (
        <div className="panel-editor-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-media-preview-title">
          <div className="panel-editor-modal__content">
            <header className="panel-editor-modal__header">
              <div>
                <p className="panel-kicker">Catálogo</p>
                <h2 id="catalog-media-preview-title">{previewAsset.originalName}</h2>
                <p className="panel-muted">
                  Escopo <code>{previewAsset.scope}</code> • enviado em {formatDate(previewAsset.uploadedAt)}
                </p>
              </div>
              <button type="button" className="panel-editor-modal__close" onClick={() => setPreviewAsset(null)} aria-label="Fechar preview">
                ×
              </button>
            </header>
            <div className="panel-media-preview-modal">
              <article className="panel-card panel-media-preview-modal__viewer">
                {getPreviewUrl(previewAsset) ? (
                  <img src={getLargePreviewUrl(previewAsset)} alt={previewAsset.originalName} />
                ) : (
                  <p className="panel-muted">Este asset não possui preview utilizável.</p>
                )}
              </article>
              <article className="panel-card panel-media-preview-modal__meta">
                <div className="panel-card-header">
                  <div className="panel-card-header__copy">
                    <h3>Variantes disponíveis</h3>
                    <p className="panel-muted">Cada variante representa um preset físico já processado pelo servidor.</p>
                  </div>
                </div>
                <div className="panel-media-library__variants">
                  {Object.values(previewAsset.variants).map((variant) => (
                    <div key={variant.key} className="panel-media-library__variant">
                      <strong>{variant.key}</strong>
                      <span>
                        {variant.width}x{variant.height} • {variant.format.toUpperCase()} • {formatBytes(variant.bytes)}
                      </span>
                      <a href={variant.url} target="_blank" rel="noreferrer">
                        Abrir arquivo
                      </a>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
