'use client';

import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { PanelMediaAsset } from '@/features/ecommpanel/types/panelMediaSettings';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';

type MeResponse = {
  csrfToken?: string;
};

type MediaAssetsResponse = {
  assets?: PanelMediaAsset[];
  error?: string;
};

type MediaUploadResponse = {
  ok?: boolean;
  asset?: PanelMediaAsset;
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
const MEDIA_SCOPE_OPTIONS = [
  { value: 'generic', label: 'Geral' },
  { value: 'cards', label: 'Cartas' },
  { value: 'entities', label: 'Entidades' },
  { value: 'documents', label: 'Documentos' },
  { value: 'integrations', label: 'Integrações' },
];

export default function CatalogMediaManager() {
  const [assets, setAssets] = useState<PanelMediaAsset[]>([]);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'product' | 'generic'>('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewAsset, setPreviewAsset] = useState<PanelMediaAsset | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [uploadScope, setUploadScope] = useState('generic');
  const [uploadFolder, setUploadFolder] = useState('geral');
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar contexto de autenticação.');
        return response.json() as Promise<MeResponse>;
      })
      .then((payload) => {
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

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
      productAssets: assets.filter((asset) => asset.scope === 'product').length,
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

  async function handleUploadInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setUploadFeedback(null);
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('scope', uploadScope);
      formData.set('folder', uploadFolder);

      const response = await fetch('/api/ecommpanel/media/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as MediaUploadResponse | null;
      if (!response.ok || !payload?.asset) {
        throw new Error(payload?.error || 'Não foi possível enviar a imagem.');
      }

      setAssets((prev) => [payload.asset!, ...prev]);
      setPreviewAsset(payload.asset);
      setUploadFeedback(`Imagem publicada em ${payload.asset.folder}. Link principal pronto para uso.`);
      setCurrentPage(1);
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'Falha no upload da imagem.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="panel-grid panel-manager-page panel-media-page" aria-labelledby="catalog-media-title">
      <PanelPageHeader
        eyebrow="Galeria operacional"
        title="Galeria de mídia e assets"
        titleId="catalog-media-title"
        description="Consulte assets já tratados pelo servidor, revise variantes publicadas e reutilize links públicos sem depender de uma tela específica de produto."
        actions={
          <div className="panel-inline panel-inline-wrap">
            <label className={`panel-btn panel-btn-primary panel-btn-sm ${uploading ? 'is-disabled' : ''}`}>
              {uploading ? 'Enviando...' : 'Upload de imagem'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadInput}
                disabled={uploading || !csrfToken}
                hidden
              />
            </label>
            <Link href="/ecommpanel/admin/settings/media" className="panel-btn panel-btn-secondary panel-btn-sm">
              Configurar presets
            </Link>
          </div>
        }
        meta={
          <div className="panel-manager-feature-grid">
            <article className="panel-manager-feature-card panel-manager-feature-card--blue">
              <strong>Biblioteca independente</strong>
              <p>Os assets vivem como recurso próprio da plataforma e podem alimentar cartas, páginas, documentos e superfícies externas.</p>
            </article>
            <article className="panel-manager-feature-card panel-manager-feature-card--purple">
              <strong>Política centralizada</strong>
              <p>
                Tamanhos, compressão e formatos seguem as regras de{' '}
                <Link href="/ecommpanel/admin/settings/media">Configurações &gt; Mídia</Link>.
              </p>
            </article>
          </div>
        }
      />

      <div className="panel-media-upload-dropzone">
        <div className="panel-media-upload-dropzone__icon" aria-hidden="true">
          ⤴
        </div>
        <div>
          <strong>Arraste imagens ou selecione arquivos para publicar</strong>
          <p className="panel-muted">JPG, PNG e WebP. O endpoint final do asset pode ser usado em cartas, docs, páginas e integrações.</p>
        </div>
        <label className={`panel-btn panel-btn-secondary panel-btn-sm ${uploading ? 'is-disabled' : ''}`}>
          {uploading ? 'Enviando...' : 'Selecionar arquivo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadInput}
            disabled={uploading || !csrfToken}
            hidden
          />
        </label>
      </div>

      <article className="panel-manager-card">
        <div className="panel-form-grid panel-form-grid--three">
          <div className="panel-field">
            <label htmlFor="panel-media-upload-scope">Categoria da mídia</label>
            <select
              id="panel-media-upload-scope"
              className="panel-input"
              value={uploadScope}
              onChange={(event) => setUploadScope(event.target.value)}
            >
              {MEDIA_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="panel-field panel-field--span-2">
            <label htmlFor="panel-media-upload-folder">Pasta de destino</label>
            <input
              id="panel-media-upload-folder"
              className="panel-input"
              value={uploadFolder}
              onChange={(event) => setUploadFolder(event.target.value)}
              placeholder="cartas/comuns"
            />
            <small className="panel-field-help">O sistema cria a pasta automaticamente. Se não houver permissão de escrita, o erro vem explicitamente no upload.</small>
          </div>
        </div>
        {uploadFeedback ? <p className="panel-feedback panel-feedback-success">{uploadFeedback}</p> : null}
        {uploadError ? <p className="panel-feedback panel-feedback-error">{uploadError}</p> : null}
      </article>

      <div className="panel-manager-stats panel-manager-stats--four">
        <article className="panel-manager-stat panel-manager-stat--blue">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Assets</span>
            <strong>{stats.totalAssets}</strong>
            <small>Arquivos já processados</small>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--purple">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Variantes</span>
            <strong>{stats.totalVariants}</strong>
            <small>Versões geradas pelos presets</small>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--gold">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Volume gerado</span>
            <strong>{formatBytes(stats.totalBytes)}</strong>
            <small>Total estimado dos arquivos publicados</small>
          </div>
        </article>
        <article className="panel-manager-stat panel-manager-stat--green">
          <div className="panel-manager-stat__icon" aria-hidden="true" />
          <div>
            <span className="panel-manager-stat__label">Assets estruturados</span>
            <strong>{stats.productAssets}</strong>
            <small>Prontos para fluxos de entidade</small>
          </div>
        </article>
      </div>

      <article className="panel-manager-card">
        <div className="panel-manager-toolbar">
          <div className="panel-toolbar__top">
            <div className="panel-toolbar__copy">
              <h2>Assets publicados</h2>
              <p className="panel-muted">Revise miniaturas, variantes e links públicos antes de reutilizar a mídia em entidades, landing pages ou integrações.</p>
            </div>
            <div className="panel-toolbar__filters">
              <label className="panel-search panel-manager-search" aria-label="Buscar na biblioteca de mídia">
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
                Estruturados
              </button>
              <button type="button" className={`panel-filter-chip ${scopeFilter === 'generic' ? 'is-active' : ''}`} onClick={() => setScopeFilter('generic')}>
                Gerais
              </button>
              <div className="panel-view-toggle" role="tablist" aria-label="Modo de visualização da galeria">
                <button
                  type="button"
                  className={`panel-view-toggle__button ${viewMode === 'grid' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  Grade
                </button>
                <button
                  type="button"
                  className={`panel-view-toggle__button ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  Tabela
                </button>
              </div>
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

        {!loading && filteredAssets.length && viewMode === 'grid' ? (
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
                        Escopo <code>{asset.scope}</code> • pasta <code>{asset.folder}</code> • enviado em {formatDate(asset.uploadedAt)}
                      </p>
                    </div>
                    <div className="panel-inline panel-inline-wrap">
                      <span className="panel-badge panel-badge-neutral">{formatBytes(asset.originalBytes)}</span>
                      <a href={asset.primaryUrl} target="_blank" rel="noreferrer" className="panel-btn panel-btn-secondary panel-btn-xs">
                        Link
                      </a>
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

        {!loading && filteredAssets.length && viewMode === 'list' ? (
          <div className="panel-table-shell">
            <table className="panel-table panel-table--manager">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Escopo</th>
                  <th>Pasta</th>
                  <th>Variantes</th>
                  <th>Tamanho</th>
                  <th>Último envio</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="panel-manager-entity-cell">
                        <span className="panel-manager-entity-cell__icon" aria-hidden="true">
                          ◫
                        </span>
                        <div>
                          <strong>{asset.originalName}</strong>
                          <small>{asset.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="panel-badge panel-badge-neutral">{asset.scope}</span>
                    </td>
                    <td><code>{asset.folder}</code></td>
                    <td>{Object.keys(asset.variants).length}</td>
                    <td>{formatBytes(asset.originalBytes)}</td>
                    <td>{formatDate(asset.uploadedAt)}</td>
                    <td>
                      <div className="panel-inline panel-inline-wrap">
                        <a href={asset.primaryUrl} target="_blank" rel="noreferrer" className="panel-btn panel-btn-secondary panel-btn-xs">
                          Link
                        </a>
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => setPreviewAsset(asset)}>
                          Visualizar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <p className="panel-kicker">Galeria de mídia</p>
                <h2 id="catalog-media-preview-title">{previewAsset.originalName}</h2>
                <p className="panel-muted">
                  Escopo <code>{previewAsset.scope}</code> • pasta <code>{previewAsset.folder}</code> • enviado em {formatDate(previewAsset.uploadedAt)}
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
