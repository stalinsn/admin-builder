'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  SITE_ROUTE_NAMESPACES,
  buildNamespacedRoutePath,
  describeSiteRoutePath,
  getSiteRouteNamespace,
  resolveSiteRouteNamespaceBySlug,
  type SiteRouteNamespaceId,
} from '@/features/ecommpanel/siteNamespaces';

type MeResponse = { csrfToken?: string };

type RouteItem = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
  publishedAt?: string;
  deleteExpiresAt?: string;
};

type ListRoutesResponse = { routes?: RouteItem[]; error?: string };

type ApiErrorResponse = { error?: string };

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function SiteRoutesManager() {
  const [csrfToken, setCsrfToken] = useState('');
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [trash, setTrash] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [namespaceId, setNamespaceId] = useState<SiteRouteNamespaceId>('landing');
  const [customPrefix, setCustomPrefix] = useState('');
  const [leafPath, setLeafPath] = useState('');
  const [query, setQuery] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<'all' | SiteRouteNamespaceId>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedNamespace = getSiteRouteNamespace(namespaceId);
  const composedPath = buildNamespacedRoutePath({ namespaceId, customPrefix, leafPath });
  const namespaceExample = describeSiteRoutePath(selectedNamespace.examplePath);

  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLowerCase();

    return routes.filter((route) => {
      const namespace = resolveSiteRouteNamespaceBySlug(route.slug);
      const matchesNamespace = namespaceFilter === 'all' || namespace.id === namespaceFilter;
      const matchesTerm = !term || route.title.toLowerCase().includes(term) || route.slug.toLowerCase().includes(term);
      return matchesNamespace && matchesTerm;
    });
  }, [namespaceFilter, query, routes]);

  async function fetchAll() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, routesReq, trashReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/site/routes', { cache: 'no-store' }),
        fetch('/api/ecommpanel/site/routes/trash', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      if (mePayload?.csrfToken) setCsrfToken(mePayload.csrfToken);

      const routesPayload = (await routesReq.json().catch(() => null)) as ListRoutesResponse | null;
      const trashPayload = (await trashReq.json().catch(() => null)) as ListRoutesResponse | null;

      if (!routesReq.ok) {
        setError(routesPayload?.error || 'Não foi possível carregar as rotas.');
        return;
      }

      if (!trashReq.ok) {
        setError(trashPayload?.error || 'Não foi possível carregar a lixeira.');
        return;
      }

      setRoutes(routesPayload?.routes || []);
      setTrash(trashPayload?.routes || []);
    } catch {
      setError('Erro de rede ao carregar rotas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  async function createRoute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || saving || !composedPath) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch('/api/ecommpanel/site/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ title, slug: composedPath }),
      });

      const payload = (await req.json().catch(() => null)) as ApiErrorResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Falha ao criar rota.');
        return;
      }

      setTitle('');
      setNamespaceId('landing');
      setCustomPrefix('');
      setLeafPath('');
      setSuccess('Rota criada em modo rascunho.');
      await fetchAll();
    } catch {
      setError('Erro de rede ao criar rota.');
    } finally {
      setSaving(false);
    }
  }

  async function removeRoute(pageId: string) {
    if (!csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/site/routes/${pageId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });

      const payload = (await req.json().catch(() => null)) as ApiErrorResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Falha ao excluir rota.');
        return;
      }

      setSuccess('Rota movida para lixeira por 30 dias.');
      await fetchAll();
    } catch {
      setError('Erro de rede ao excluir rota.');
    } finally {
      setSaving(false);
    }
  }

  async function restoreRoute(pageId: string) {
    if (!csrfToken || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/site/routes/${pageId}/restore`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });

      const payload = (await req.json().catch(() => null)) as ApiErrorResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Falha ao restaurar rota.');
        return;
      }

      setSuccess('Rota restaurada com sucesso.');
      await fetchAll();
    } catch {
      setError('Erro de rede ao restaurar rota.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="site-routes-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Experiência do Site · Rotas</p>
        <h1 id="site-routes-title">Cadastro de rotas e páginas</h1>
        <p className="panel-muted">
          Crie e gerencie páginas da loja. Depois de publicar, elas passam a valer no site sem precisar gerar arquivos novos nem refazer o build no modo servidor.
        </p>
      </article>

      <div className="panel-workspace">
        <article className="panel-card panel-users-form-card panel-workspace__sidebar">
          <h2>Nova rota</h2>
          <form className="panel-form" onSubmit={createRoute}>
            <div className="panel-field">
              <label htmlFor="route-title">Título da página</label>
              <input
                id="route-title"
                className="panel-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Landing de Black Friday"
                required
              />
            </div>

            <div className="panel-field">
              <label htmlFor="route-namespace">Namespace operacional</label>
              <select
                id="route-namespace"
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
                <label htmlFor="route-custom-prefix">Prefixo custom</label>
                <input
                  id="route-custom-prefix"
                  className="panel-input"
                  value={customPrefix}
                  onChange={(event) => setCustomPrefix(event.target.value)}
                  placeholder={namespaceExample.customPrefix || 'especial/parceiros'}
                  required
                />
              </div>
            ) : null}

            <div className="panel-field">
              <label htmlFor="route-slug">Caminho final</label>
              <input
                id="route-slug"
                className="panel-input"
                value={leafPath}
                onChange={(event) => setLeafPath(event.target.value)}
                placeholder={namespaceExample.leafPath || selectedNamespace.examplePath}
                required
              />
              <small className="panel-muted">Reservados: `plp`, `cart`, `checkout`, `paginas`.</small>
            </div>

            <div className="panel-template-callout panel-template-callout--inline">
              <div>
                <strong>/{composedPath || 'caminho-da-rota'}</strong>
                <p className="panel-muted">Preset sugerido: {selectedNamespace.layoutPreset}</p>
              </div>
              <span className="panel-badge panel-badge-neutral">{selectedNamespace.label}</span>
            </div>

            <button type="submit" className="panel-btn panel-btn-primary" disabled={saving || !composedPath}>
              {saving ? 'Salvando...' : 'Criar rota'}
            </button>
          </form>
        </article>

        <article className="panel-card panel-workspace__main">
          <div className="panel-toolbar">
            <div className="panel-toolbar__top">
              <div className="panel-toolbar__copy">
                <h2>Rotas existentes</h2>
                <p className="panel-muted">Filtre por namespace, encontre uma página e siga para edição ou restauração.</p>
              </div>
              <div className="panel-toolbar__filters">
                <select
                  className="panel-select"
                  value={namespaceFilter}
                  onChange={(event) => setNamespaceFilter(event.target.value as 'all' | SiteRouteNamespaceId)}
                  aria-label="Filtrar por namespace"
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
                  placeholder="Buscar por título ou caminho"
                  aria-label="Buscar rotas"
                />
              </div>
            </div>
          </div>

          {loading ? <p className="panel-muted">Carregando rotas...</p> : null}

          {!loading ? (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Rota</th>
                    <th>Status</th>
                    <th>Atualizado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route) => {
                    const namespace = resolveSiteRouteNamespaceBySlug(route.slug);
                    return (
                      <tr key={route.id}>
                        <td>
                          <strong>{route.title}</strong>
                          <br />
                          <span className="panel-badge panel-badge-neutral">{namespace.label}</span>
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
                          <div className="panel-inline panel-inline-wrap">
                            <Link className="panel-btn panel-btn-secondary panel-btn-sm" href={`/ecommpanel/admin/site/editor?pageId=${route.id}`}>
                              Editar
                            </Link>
                            <button
                              className="panel-btn panel-btn-danger panel-btn-sm"
                              type="button"
                              onClick={() => removeRoute(route.id)}
                              disabled={saving}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && filteredRoutes.length === 0 ? <p className="panel-table-empty">Nenhuma rota encontrada.</p> : null}

          <div className="panel-site-trash">
            <h3>Lixeira temporária (30 dias)</h3>
            {trash.length === 0 ? <p className="panel-muted">Nenhuma rota em lixeira.</p> : null}
            {trash.length > 0 ? (
              <ul className="panel-layer-list">
                {trash.map((route) => (
                  <li key={route.id} className="panel-site-trash-item">
                    <div>
                      <strong>{route.title}</strong>
                      <p className="panel-muted">
                        <span className="panel-badge panel-badge-neutral">{resolveSiteRouteNamespaceBySlug(route.slug).label}</span>
                      </p>
                      <p className="panel-muted">/{route.slug}</p>
                      <p className="panel-muted">Expira em: {formatDate(route.deleteExpiresAt)}</p>
                    </div>
                    <button
                      type="button"
                      className="panel-btn panel-btn-secondary panel-btn-sm"
                      onClick={() => restoreRoute(route.id)}
                      disabled={saving}
                    >
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}
        </article>
      </div>
    </section>
  );
}
