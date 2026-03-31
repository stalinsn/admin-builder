'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  CatalogCategory,
  CatalogCategoryListItem,
  CatalogCollection,
  CatalogCollectionListItem,
  CatalogEntityStatus,
} from '@/features/catalog/types';

type MeResponse = {
  csrfToken?: string;
  user?: {
    permissions?: string[];
    isDemoMode?: boolean;
  };
  sessionExpiresAt?: string;
};

type CategoriesResponse = {
  categories?: CatalogCategoryListItem[];
  category?: CatalogCategory;
  error?: string;
};

type CollectionsResponse = {
  collections?: CatalogCollectionListItem[];
  collection?: CatalogCollection;
  error?: string;
};

const EMPTY_CATEGORY_FORM = {
  name: '',
  slug: '',
  description: '',
  status: 'draft' as CatalogEntityStatus,
  parentId: '',
  metadata: '',
};

const EMPTY_COLLECTION_FORM = {
  name: '',
  slug: '',
  description: '',
  status: 'draft' as CatalogEntityStatus,
  metadata: '',
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function stringifyJson(value: Record<string, unknown> | null | undefined): string {
  if (!value || typeof value !== 'object') return '';
  return JSON.stringify(value, null, 2);
}

function parseJsonObjectInput(value: string): { value: Record<string, unknown> | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'Os metadados precisam ser um objeto JSON.' };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { value: null, error: 'O JSON de metadados está inválido.' };
  }
}

export default function CatalogTaxonomyManager() {
  const [csrfToken, setCsrfToken] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogCategoryListItem[]>([]);
  const [collections, setCollections] = useState<CatalogCollectionListItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [categorySaving, setCategorySaving] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [collectionForm, setCollectionForm] = useState(EMPTY_COLLECTION_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = useMemo(
    () =>
      ['catalog.products.manage', 'catalog.content.manage', 'catalog.pricing.manage'].some((permission) =>
        permissions.includes(permission),
      ),
    [permissions],
  );

  const stats = useMemo(
    () => ({
      categories: categories.length,
      activeCategories: categories.filter((item) => item.status === 'active').length,
      collections: collections.length,
      activeCollections: collections.filter((item) => item.status === 'active').length,
    }),
    [categories, collections],
  );

  async function loadTaxonomy() {
    setError(null);
    setCategoriesLoading(true);
    setCollectionsLoading(true);

    try {
      const [meReq, categoriesReq, collectionsReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/categories', { cache: 'no-store' }),
        fetch('/api/ecommpanel/catalog/collections', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      const categoriesPayload = (await categoriesReq.json().catch(() => null)) as CategoriesResponse | null;
      const collectionsPayload = (await collectionsReq.json().catch(() => null)) as CollectionsResponse | null;

      setCsrfToken(mePayload?.csrfToken || '');
      setPermissions(mePayload?.user?.permissions || []);
      setDemoMode(Boolean(mePayload?.user?.isDemoMode));
      setSessionExpiresAt(mePayload?.sessionExpiresAt || null);

      if (!categoriesReq.ok) {
        setError(categoriesPayload?.error || 'Não foi possível carregar as categorias.');
      } else {
        setCategories(categoriesPayload?.categories || []);
      }

      if (!collectionsReq.ok) {
        setError(collectionsPayload?.error || 'Não foi possível carregar as coleções.');
      } else {
        setCollections(collectionsPayload?.collections || []);
      }
    } catch {
      setError('Erro de rede ao carregar categorias e coleções.');
    } finally {
      setCategoriesLoading(false);
      setCollectionsLoading(false);
    }
  }

  useEffect(() => {
    void loadTaxonomy();
  }, []);

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
  }

  function resetCollectionForm() {
    setEditingCollectionId(null);
    setCollectionForm(EMPTY_COLLECTION_FORM);
  }

  async function startEditingCategory(categoryId: string) {
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/catalog/categories/${categoryId}`, { cache: 'no-store' });
      const payload = (await req.json().catch(() => null)) as CategoriesResponse | null;
      if (!req.ok || !payload?.category) {
        setError(payload?.error || 'Não foi possível abrir a categoria.');
        return;
      }

      setEditingCategoryId(payload.category.id);
      setCategoryForm({
        name: payload.category.name,
        slug: payload.category.slug,
        description: payload.category.description || '',
        status: payload.category.status || 'draft',
        parentId: payload.category.parentId || '',
        metadata: stringifyJson(payload.category.metadata),
      });
    } catch {
      setError('Erro de rede ao carregar a categoria.');
    }
  }

  async function startEditingCollection(collectionId: string) {
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/catalog/collections/${collectionId}`, { cache: 'no-store' });
      const payload = (await req.json().catch(() => null)) as CollectionsResponse | null;
      if (!req.ok || !payload?.collection) {
        setError(payload?.error || 'Não foi possível abrir a coleção.');
        return;
      }

      setEditingCollectionId(payload.collection.id);
      setCollectionForm({
        name: payload.collection.name,
        slug: payload.collection.slug,
        description: payload.collection.description || '',
        status: payload.collection.status,
        metadata: stringifyJson(payload.collection.metadata),
      });
    } catch {
      setError('Erro de rede ao carregar a coleção.');
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || categorySaving) return;

    setCategorySaving(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedMetadata = parseJsonObjectInput(categoryForm.metadata);
      if (parsedMetadata.error) {
        setError(parsedMetadata.error);
        setCategorySaving(false);
        return;
      }

      const method = editingCategoryId ? 'PUT' : 'POST';
      const endpoint = editingCategoryId
        ? `/api/ecommpanel/catalog/categories/${editingCategoryId}`
        : '/api/ecommpanel/catalog/categories';

      const req = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: categoryForm.slug,
          name: categoryForm.name,
          description: categoryForm.description,
          status: categoryForm.status,
          parentId: categoryForm.parentId.trim() || null,
          metadata: parsedMetadata.value,
        }),
      });

      const payload = (await req.json().catch(() => null)) as CategoriesResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Não foi possível salvar a categoria.');
        return;
      }

      setSuccess(editingCategoryId ? 'Categoria atualizada.' : 'Categoria criada.');
      resetCategoryForm();
      await loadTaxonomy();
    } catch {
      setError('Erro de rede ao salvar a categoria.');
    } finally {
      setCategorySaving(false);
    }
  }

  async function saveCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || collectionSaving) return;

    setCollectionSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedMetadata = parseJsonObjectInput(collectionForm.metadata);
      if (parsedMetadata.error) {
        setError(parsedMetadata.error);
        setCollectionSaving(false);
        return;
      }

      const method = editingCollectionId ? 'PUT' : 'POST';
      const endpoint = editingCollectionId
        ? `/api/ecommpanel/catalog/collections/${editingCollectionId}`
        : '/api/ecommpanel/catalog/collections';

      const req = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: collectionForm.slug,
          name: collectionForm.name,
          description: collectionForm.description,
          status: collectionForm.status,
          metadata: parsedMetadata.value,
        }),
      });

      const payload = (await req.json().catch(() => null)) as CollectionsResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Não foi possível salvar a coleção.');
        return;
      }

      setSuccess(editingCollectionId ? 'Coleção atualizada.' : 'Coleção criada.');
      resetCollectionForm();
      await loadTaxonomy();
    } catch {
      setError('Erro de rede ao salvar a coleção.');
    } finally {
      setCollectionSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="catalog-taxonomy-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Estrutura comercial</p>
        <h2 id="catalog-taxonomy-title">Categorias, coleções e extensões da estrutura</h2>
        <p className="panel-muted">
          Essas camadas ajudam a manter o catálogo organizado sem engessar o modelo. O banco guarda campos centrais fixos e
          aceita metadados opcionais para expansão futura.
        </p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Categorias</span>
          <strong>{stats.categories}</strong>
          <span>{stats.activeCategories} ativas para uso operacional</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Coleções</span>
          <strong>{stats.collections}</strong>
          <span>{stats.activeCollections} ativas para campanhas e vitrines</span>
        </article>
      </div>

      {demoMode ? (
        <article className="panel-card">
          <p className="panel-feedback panel-feedback-success">
            Modo demonstração ativo. Categorias e coleções alteradas aqui ficam só nesta sessão e expiram em{' '}
            <strong>{formatDate(sessionExpiresAt || undefined)}</strong>.
          </p>
        </article>
      ) : null}

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

      <div className="panel-catalog-taxonomy-grid">
        <div className="panel-catalog-taxonomy-column">
          <article className="panel-card">
            <h3>{editingCategoryId ? 'Editar categoria' : 'Nova categoria'}</h3>
            <p className="panel-muted">
              Categoria é a espinha dorsal do catálogo. Use metadados para propriedades adicionais sem alterar o núcleo do produto.
            </p>

            <form className="panel-form" onSubmit={saveCategory}>
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-category-name">Nome</label>
                  <input
                    id="catalog-category-name"
                    className="panel-input"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-category-slug">Slug</label>
                  <input
                    id="catalog-category-slug"
                    className="panel-input"
                    value={categoryForm.slug}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))}
                    required
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-category-status">Situação</label>
                  <select
                    id="catalog-category-status"
                    className="panel-input"
                    value={categoryForm.status}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, status: event.target.value as CatalogEntityStatus }))}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativa</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-category-parent">Categoria pai</label>
                  <input
                    id="catalog-category-parent"
                    className="panel-input"
                    value={categoryForm.parentId}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, parentId: event.target.value }))}
                    placeholder="ID da categoria pai, se existir"
                  />
                </div>
              </div>

              <div className="panel-field">
                <label htmlFor="catalog-category-description">Descrição</label>
                <textarea
                  id="catalog-category-description"
                  className="panel-input panel-textarea"
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                />
              </div>

              <div className="panel-field">
                <label htmlFor="catalog-category-metadata">Metadados em JSON</label>
                <textarea
                  id="catalog-category-metadata"
                  className="panel-input panel-textarea panel-codearea"
                  value={categoryForm.metadata}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, metadata: event.target.value }))}
                  rows={6}
                  placeholder={'{\n  "menuLabel": "Mercearia",\n  "sortOrder": 10\n}'}
                />
              </div>

              <div className="panel-form-actions">
                <button className="panel-btn panel-btn-primary" type="submit" disabled={!canManage || categorySaving}>
                  {categorySaving ? 'Salvando...' : editingCategoryId ? 'Salvar categoria' : 'Cadastrar categoria'}
                </button>
                {editingCategoryId ? (
                  <button className="panel-btn panel-btn-secondary" type="button" onClick={resetCategoryForm}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="panel-card">
            <h3>{editingCollectionId ? 'Editar coleção' : 'Nova coleção'}</h3>
            <p className="panel-muted">
              Coleções servem para agrupar produtos por campanha, curadoria ou objetivo comercial sem depender da hierarquia fixa.
            </p>

            <form className="panel-form" onSubmit={saveCollection}>
              <div className="panel-catalog-form-grid">
                <div className="panel-field">
                  <label htmlFor="catalog-collection-name">Nome</label>
                  <input
                    id="catalog-collection-name"
                    className="panel-input"
                    value={collectionForm.name}
                    onChange={(event) => setCollectionForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-collection-slug">Slug</label>
                  <input
                    id="catalog-collection-slug"
                    className="panel-input"
                    value={collectionForm.slug}
                    onChange={(event) => setCollectionForm((prev) => ({ ...prev, slug: event.target.value }))}
                    required
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="catalog-collection-status">Situação</label>
                  <select
                    id="catalog-collection-status"
                    className="panel-input"
                    value={collectionForm.status}
                    onChange={(event) => setCollectionForm((prev) => ({ ...prev, status: event.target.value as CatalogEntityStatus }))}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativa</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </div>
              </div>

              <div className="panel-field">
                <label htmlFor="catalog-collection-description">Descrição</label>
                <textarea
                  id="catalog-collection-description"
                  className="panel-input panel-textarea"
                  value={collectionForm.description}
                  onChange={(event) => setCollectionForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                />
              </div>

              <div className="panel-field">
                <label htmlFor="catalog-collection-metadata">Metadados em JSON</label>
                <textarea
                  id="catalog-collection-metadata"
                  className="panel-input panel-textarea panel-codearea"
                  value={collectionForm.metadata}
                  onChange={(event) => setCollectionForm((prev) => ({ ...prev, metadata: event.target.value }))}
                  rows={6}
                  placeholder={'{\n  "badge": "Oferta",\n  "landingSlug": "semana-do-pescado"\n}'}
                />
              </div>

              <div className="panel-form-actions">
                <button className="panel-btn panel-btn-primary" type="submit" disabled={!canManage || collectionSaving}>
                  {collectionSaving ? 'Salvando...' : editingCollectionId ? 'Salvar coleção' : 'Cadastrar coleção'}
                </button>
                {editingCollectionId ? (
                  <button className="panel-btn panel-btn-secondary" type="button" onClick={resetCollectionForm}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          </article>
        </div>

        <div className="panel-catalog-taxonomy-lists">
          <article className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h3>Categorias cadastradas</h3>
                <p className="panel-muted">{categories.length} registros disponíveis para organização do catálogo.</p>
              </div>
            </div>

            {categoriesLoading ? <p className="panel-muted">Carregando categorias...</p> : null}

            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Produtos</th>
                    <th>Filhas</th>
                    <th>Situação</th>
                    <th>Atualização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className={editingCategoryId === category.id ? 'is-active' : undefined}>
                      <td>
                        <strong>{category.name}</strong>
                        <br />
                        <span className="panel-muted">{category.slug}</span>
                      </td>
                      <td>{category.productCount}</td>
                      <td>{category.childrenCount}</td>
                      <td>
                        <span className={`panel-badge ${category.status === 'active' ? 'panel-badge-success' : category.status === 'draft' ? 'panel-badge-neutral' : 'panel-badge-warn'}`}>
                          {category.status === 'active' ? 'Ativa' : category.status === 'draft' ? 'Rascunho' : 'Arquivada'}
                        </span>
                      </td>
                      <td>{formatDate(category.updatedAt)}</td>
                      <td>
                        <button className="panel-link-button" type="button" onClick={() => void startEditingCategory(category.id)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!categoriesLoading && categories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="panel-muted">
                        Nenhuma categoria cadastrada.
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
                <h3>Coleções cadastradas</h3>
                <p className="panel-muted">{collections.length} registros ativos para campanhas, curadoria e vitrines.</p>
              </div>
            </div>

            {collectionsLoading ? <p className="panel-muted">Carregando coleções...</p> : null}

            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Coleção</th>
                    <th>Produtos</th>
                    <th>Situação</th>
                    <th>Atualização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((collection) => (
                    <tr key={collection.id} className={editingCollectionId === collection.id ? 'is-active' : undefined}>
                      <td>
                        <strong>{collection.name}</strong>
                        <br />
                        <span className="panel-muted">{collection.slug}</span>
                      </td>
                      <td>{collection.productCount}</td>
                      <td>
                        <span className={`panel-badge ${collection.status === 'active' ? 'panel-badge-success' : collection.status === 'draft' ? 'panel-badge-neutral' : 'panel-badge-warn'}`}>
                          {collection.status === 'active' ? 'Ativa' : collection.status === 'draft' ? 'Rascunho' : 'Arquivada'}
                        </span>
                      </td>
                      <td>{formatDate(collection.updatedAt)}</td>
                      <td>
                        <button className="panel-link-button" type="button" onClick={() => void startEditingCollection(collection.id)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!collectionsLoading && collections.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="panel-muted">
                        Nenhuma coleção cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
