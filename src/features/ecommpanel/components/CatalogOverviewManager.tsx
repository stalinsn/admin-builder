'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
  CatalogCategoryListItem,
  CatalogCollectionListItem,
  CatalogProductListItem,
} from '@/features/catalog/types';
import type { PanelMediaAsset } from '@/features/ecommpanel/types/panelMediaSettings';

type CatalogDisplaySettings = {
  showUnavailableProducts: boolean;
  unavailableLabel: string;
  restockLabel: string;
};

type ProductsResponse = {
  products?: CatalogProductListItem[];
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

type MediaAssetsResponse = {
  assets?: PanelMediaAsset[];
  error?: string;
};

type CatalogSettingsResponse = {
  settings?: CatalogDisplaySettings;
  error?: string;
};

type OperationalAlert = {
  id: string;
  label: string;
  count: number;
  tone: 'danger' | 'warn' | 'neutral';
  href: string;
  action: string;
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

export default function CatalogOverviewManager() {
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryListItem[]>([]);
  const [collections, setCollections] = useState<CatalogCollectionListItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<PanelMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [displaySettings, setDisplaySettings] = useState<CatalogDisplaySettings>({
    showUnavailableProducts: true,
    unavailableLabel: 'Esgotado',
    restockLabel: 'Disponível em breve',
  });

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const [productsReq, categoriesReq, collectionsReq, assetsReq, settingsReq] = await Promise.all([
        fetch('/api/ecommpanel/catalog/products', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/categories', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/collections', { cache: 'no-store' }),
        fetch('/api/ecommpanel/media/assets?scope=product', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/settings', { cache: 'no-store' }),
      ]);

      const productsPayload = (await productsReq.json().catch(() => null)) as ProductsResponse | null;
      const categoriesPayload = (await categoriesReq.json().catch(() => null)) as CategoriesResponse | null;
      const collectionsPayload = (await collectionsReq.json().catch(() => null)) as CollectionsResponse | null;
      const assetsPayload = (await assetsReq.json().catch(() => null)) as MediaAssetsResponse | null;
      const settingsPayload = (await settingsReq.json().catch(() => null)) as CatalogSettingsResponse | null;

      if (!productsReq.ok) {
        setError(productsPayload?.error || 'Não foi possível carregar os produtos do catálogo.');
        return;
      }

      setProducts(productsPayload?.products || []);
      setCategories(categoriesReq.ok ? categoriesPayload?.categories || [] : []);
      setCollections(collectionsReq.ok ? collectionsPayload?.collections || [] : []);
      setMediaAssets(assetsReq.ok ? assetsPayload?.assets || [] : []);
      if (settingsReq.ok && settingsPayload?.settings) {
        setDisplaySettings(settingsPayload.settings);
      }
    } catch {
      setError('Erro de rede ao carregar a visão geral do catálogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  async function saveDisplaySettings() {
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const meResponse = await fetch('/api/ecommpanel/auth/me', { cache: 'no-store' });
      const mePayload = (await meResponse.json().catch(() => null)) as { csrfToken?: string } | null;
      const response = await fetch('/api/ecommpanel/catalog/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': mePayload?.csrfToken || '',
        },
        body: JSON.stringify(displaySettings),
      });
      const payload = (await response.json().catch(() => null)) as CatalogSettingsResponse | null;
      if (!response.ok || !payload?.settings) {
        setSettingsFeedback(payload?.error || 'Não foi possível salvar a política de vitrine.');
        return;
      }
      setDisplaySettings(payload.settings);
      setSettingsFeedback('Política de disponibilidade publicada com sucesso.');
    } catch {
      setSettingsFeedback('Erro de rede ao salvar a política de vitrine.');
    } finally {
      setSavingSettings(false);
    }
  }

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.status === 'active').length;
    const draftProducts = products.filter((product) => product.status === 'draft').length;
    const archivedProducts = products.filter((product) => product.status === 'archived').length;
    const unavailableProducts = products.filter((product) => !product.available).length;
    const missingImage = products.filter((product) => !product.image.trim()).length;
    const missingCategory = products.filter((product) => !product.categories.length).length;
    const lowStock = products.filter((product) => product.lowStock).length;

    return {
      totalProducts: products.length,
      activeProducts,
      draftProducts,
      archivedProducts,
      unavailableProducts,
      missingImage,
      missingCategory,
      lowStock,
      activeCategories: categories.filter((item) => item.status === 'active').length,
      activeCollections: collections.filter((item) => item.status === 'active').length,
      mediaAssets: mediaAssets.length,
    };
  }, [categories, collections, mediaAssets.length, products]);

  const alerts = useMemo<OperationalAlert[]>(() => {
    return [
      {
        id: 'drafts',
        label: 'Produtos em rascunho',
        count: stats.draftProducts,
        tone: (stats.draftProducts ? 'warn' : 'neutral') as OperationalAlert['tone'],
        href: '/ecommpanel/admin/catalog/products',
        action: 'Revisar publicação',
      },
      {
        id: 'missing-image',
        label: 'Produtos sem imagem',
        count: stats.missingImage,
        tone: (stats.missingImage ? 'danger' : 'neutral') as OperationalAlert['tone'],
        href: '/ecommpanel/admin/catalog/products',
        action: 'Completar mídia',
      },
      {
        id: 'missing-category',
        label: 'Produtos sem categoria',
        count: stats.missingCategory,
        tone: (stats.missingCategory ? 'warn' : 'neutral') as OperationalAlert['tone'],
        href: '/ecommpanel/admin/catalog/taxonomy',
        action: 'Ajustar taxonomia',
      },
      {
        id: 'low-stock',
        label: 'Itens com estoque baixo',
        count: stats.lowStock,
        tone: (stats.lowStock ? 'danger' : 'neutral') as OperationalAlert['tone'],
        href: '/ecommpanel/admin/catalog/products',
        action: 'Planejar reposição',
      },
      {
        id: 'unavailable',
        label: 'Itens indisponíveis',
        count: stats.unavailableProducts,
        tone: (stats.unavailableProducts ? 'warn' : 'neutral') as OperationalAlert['tone'],
        href: '/ecommpanel/admin/catalog/products',
        action: 'Validar liberação',
      },
    ].sort((left, right) => right.count - left.count);
  }, [stats]);

  const recentlyUpdatedProducts = useMemo(() => {
    return [...products]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 6);
  }, [products]);

  const quickLinks = [
    {
      href: '/ecommpanel/admin/catalog/products',
      title: 'Abrir produtos',
      description: 'Cadastre, revise preço, estoque, imagens e disponibilidade.',
    },
    {
      href: '/ecommpanel/admin/catalog/taxonomy',
      title: 'Abrir taxonomia',
      description: 'Organize categorias e coleções que alimentam a navegação da loja.',
    },
    {
      href: '/ecommpanel/admin/catalog/media',
      title: 'Abrir mídia',
      description: 'Revise a biblioteca de imagens tratadas e reaproveite assets.',
    },
    {
      href: '/ecommpanel/admin/settings/media',
      title: 'Ajustar política de imagem',
      description: 'Controle upload, compressão e presets usados em todo o sistema.',
    },
  ];

  return (
    <section className="panel-grid" aria-labelledby="catalog-overview-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Catálogo</p>
        <h1 id="catalog-overview-title">Visão geral operacional</h1>
        <p className="panel-muted">
          Abra esta tela para entender rapidamente o estado do catálogo, localizar pendências e seguir para a área certa sem perder tempo.
        </p>
        <div className="panel-catalog-architecture">
          <div>
            <strong>Saúde do catálogo</strong>
            <span>Rascunhos, produtos sem imagem, itens sem categoria e estoque baixo aparecem como sinais de atenção operacional.</span>
          </div>
          <div>
            <strong>Entrada por responsabilidade</strong>
            <span>Produtos, taxonomia e mídia continuam acessíveis, mas agora partindo de um resumo que mostra prioridade real.</span>
          </div>
        </div>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Produtos</span>
          <strong>{stats.totalProducts}</strong>
          <span>{stats.activeProducts} ativos em operação</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Rascunhos</span>
          <strong>{stats.draftProducts}</strong>
          <span>Itens aguardando revisão</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Estoque baixo</span>
          <strong>{stats.lowStock}</strong>
          <span>Produtos com necessidade de reposição</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Categorias ativas</span>
          <strong>{stats.activeCategories}</strong>
          <span>{stats.activeCollections} coleções publicadas</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Mídia de produto</span>
          <strong>{stats.mediaAssets}</strong>
          <span>Assets tratados para o catálogo</span>
        </article>
      </div>

      <article className="panel-card panel-card-subtle">
        <div className="panel-card-header">
          <div className="panel-card-header__copy">
            <h2>Política de disponibilidade na vitrine</h2>
            <p className="panel-muted">Controle se produtos indisponíveis continuam visíveis na loja e quais textos aparecem no CTA quando não puderem ser comprados.</p>
          </div>
        </div>
        <div className="panel-form-grid">
          <div className="panel-form-row">
            <label className="panel-checkbox">
              <input
                type="checkbox"
                checked={displaySettings.showUnavailableProducts}
                onChange={(event) =>
                  setDisplaySettings((current) => ({ ...current, showUnavailableProducts: event.target.checked }))
                }
              />
              Exibir produtos indisponíveis nas vitrines e listagens
            </label>
          </div>
          <div className="panel-form-row">
            <div className="panel-field">
              <label>Texto para esgotado</label>
              <input
                className="panel-input"
                value={displaySettings.unavailableLabel}
                onChange={(event) =>
                  setDisplaySettings((current) => ({ ...current, unavailableLabel: event.target.value }))
                }
              />
            </div>
            <div className="panel-field">
              <label>Texto para reabastecimento</label>
              <input
                className="panel-input"
                value={displaySettings.restockLabel}
                onChange={(event) =>
                  setDisplaySettings((current) => ({ ...current, restockLabel: event.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <div className="panel-inline-actions">
          <button type="button" className="panel-btn panel-btn-primary" onClick={() => void saveDisplaySettings()} disabled={savingSettings}>
            {savingSettings ? 'Salvando...' : 'Salvar política'}
          </button>
        </div>
        {settingsFeedback ? <p className="panel-muted">{settingsFeedback}</p> : null}
      </article>

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {loading ? <p className="panel-muted">Carregando visão geral do catálogo...</p> : null}

      {!loading ? (
        <>
          <div className="panel-dashboard-layout">
            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Pendências em destaque</h2>
                  <p className="panel-muted">Os itens abaixo ajudam a priorizar o que precisa de correção ou revisão agora.</p>
                </div>
              </div>
              <div className="panel-alert-list">
                {alerts.map((alert) => (
                  <Link key={alert.id} href={alert.href} className={`panel-alert-card panel-alert-card--${alert.tone}`}>
                    <div>
                      <strong>{alert.label}</strong>
                      <span>{alert.action}</span>
                    </div>
                    <strong>{alert.count}</strong>
                  </Link>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Ações rápidas</h2>
                  <p className="panel-muted">Atalhos organizados por responsabilidade operacional.</p>
                </div>
              </div>
              <div className="panel-module-grid">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="panel-module-card">
                    <strong>{link.title}</strong>
                    <span>{link.description}</span>
                  </Link>
                ))}
              </div>
            </article>
          </div>

          <div className="panel-dashboard-layout">
            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Últimos produtos alterados</h2>
                  <p className="panel-muted">Use esta lista para continuar ajustes recentes sem caçar manualmente na grade completa.</p>
                </div>
              </div>
              <div className="panel-table-wrap">
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Situação</th>
                      <th>Atualização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentlyUpdatedProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          <br />
                          <span className="panel-muted">{product.slug}</span>
                        </td>
                        <td>{product.categories[0] || 'Sem categoria'}</td>
                        <td>
                          <span className={`panel-badge ${product.status === 'active' ? 'panel-badge-success' : product.status === 'draft' ? 'panel-badge-neutral' : 'panel-badge-warn'}`}>
                            {product.status === 'active' ? 'Ativo' : product.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                          </span>
                        </td>
                        <td>{formatDate(product.updatedAt)}</td>
                      </tr>
                    ))}
                    {!recentlyUpdatedProducts.length ? (
                      <tr>
                        <td colSpan={4} className="panel-muted">
                          Nenhum produto encontrado ainda.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-card-header">
                <div className="panel-card-header__copy">
                  <h2>Leitura estrutural</h2>
                  <p className="panel-muted">Resumo rápido da base comercial para checar se a operação está minimamente completa.</p>
                </div>
              </div>
              <div className="panel-catalog-architecture">
                <div>
                  <strong>Produtos sem mídia</strong>
                  <span>{stats.missingImage} item(ns) ainda sem imagem principal definida.</span>
                </div>
                <div>
                  <strong>Produtos sem categoria</strong>
                  <span>{stats.missingCategory} item(ns) ainda sem classificação principal.</span>
                </div>
                <div>
                  <strong>Taxonomia ativa</strong>
                  <span>{stats.activeCategories} categorias e {stats.activeCollections} coleções ativas para navegação e curadoria.</span>
                </div>
                <div>
                  <strong>Assets tratados</strong>
                  <span>{stats.mediaAssets} arquivo(s) já passaram pelo pipeline de mídia do painel.</span>
                </div>
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
