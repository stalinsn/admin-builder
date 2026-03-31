'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { BlogPostListItem } from '@/features/blog/types';
import { normalizeBlogSlug } from '@/features/blog/slug';

type MeResponse = {
  csrfToken?: string;
  user?: {
    id?: string;
    name?: string;
    permissions?: string[];
  };
};

type PostsResponse = {
  posts?: BlogPostListItem[];
  error?: string;
};

type CreateResponse = {
  error?: string;
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function BlogPostsManager() {
  const [csrfToken, setCsrfToken] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Editorial');
  const [authorName, setAuthorName] = useState('Equipe de Conteúdo');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BlogPostListItem['status']>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => normalizeBlogSlug(slug), [slug]);
  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
      const matchesTerm =
        !term ||
        post.title.toLowerCase().includes(term) ||
        post.slug.toLowerCase().includes(term) ||
        post.category.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [posts, query, statusFilter]);

  const stats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === 'published').length,
      drafts: posts.filter((post) => post.status === 'draft').length,
      publishedWithGovernance: posts.filter((post) => post.status === 'published' && post.publishedByName).length,
    }),
    [posts],
  );
  const canCreatePosts = useMemo(
    () => ['blog.posts.manage', 'blog.posts.create', 'blog.posts.edit'].some((permission) => permissions.includes(permission)),
    [permissions],
  );
  const canPublishPosts = useMemo(
    () => ['blog.posts.manage', 'blog.posts.publish'].some((permission) => permissions.includes(permission)),
    [permissions],
  );

  async function fetchPosts() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, postsReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/blog/posts', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      const postsPayload = (await postsReq.json().catch(() => null)) as PostsResponse | null;

      if (mePayload?.csrfToken) {
        setCsrfToken(mePayload.csrfToken);
      }
      setCurrentUserName(mePayload?.user?.name || '');
      setPermissions(mePayload?.user?.permissions || []);

      if (!postsReq.ok) {
        setError(postsPayload?.error || 'Não foi possível carregar os posts do blog.');
        return;
      }

      setPosts(postsPayload?.posts || []);
    } catch {
      setError('Erro de rede ao carregar os posts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPosts();
  }, []);

  async function createPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || !normalizedSlug || saving || !canCreatePosts) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch('/api/ecommpanel/blog/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          title,
          slug: normalizedSlug,
          category,
          authorName,
        }),
      });

      const payload = (await req.json().catch(() => null)) as CreateResponse | null;
      if (!req.ok) {
        setError(payload?.error || 'Não foi possível criar o post.');
        return;
      }

      setTitle('');
      setSlug('');
      setCategory('Editorial');
      setAuthorName('Equipe de Conteúdo');
      setSuccess('Post criado como rascunho. Agora você pode abrir o editor para completar texto, imagens, SEO e comentários.');
      await fetchPosts();
    } catch {
      setError('Erro de rede ao criar o post.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="blog-posts-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Blog</p>
        <h1 id="blog-posts-title">Gestão do blog do site</h1>
        <p className="panel-muted">
          Cadastre posts, acompanhe o que já foi publicado no site e entre no editor para ajustar texto, imagem, SEO e comentários.
        </p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Posts cadastrados</span>
          <strong>{stats.total}</strong>
          <span>Total disponível no painel</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Publicados</span>
          <strong>{stats.published}</strong>
          <span>Já visíveis no site</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Rascunhos</span>
          <strong>{stats.drafts}</strong>
          <span>Prontos para refinamento</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Publicações rastreadas</span>
          <strong>{stats.publishedWithGovernance}</strong>
          <span>Com responsável registrado</span>
        </article>
      </div>

      <div className="panel-workspace">
        <article className="panel-card panel-users-form-card panel-workspace__sidebar">
          <h2>Novo post</h2>
          <p className="panel-muted">
            Responsável atual: <strong>{currentUserName || 'Usuário autenticado'}</strong>
          </p>

          {!canCreatePosts ? (
            <p className="panel-feedback panel-feedback-error">
              Seu perfil pode consultar a operação editorial, mas não pode criar novos posts.
            </p>
          ) : null}

          <form className="panel-form" onSubmit={createPost}>
            <div className="panel-field">
              <label htmlFor="blog-post-title">Título</label>
              <input
                id="blog-post-title"
                className="panel-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Como organizar páginas e conteúdo no site"
                required
              />
            </div>

            <div className="panel-field">
              <label htmlFor="blog-post-slug">Slug</label>
              <input
                id="blog-post-slug"
                className="panel-input"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="organizacao-do-site"
                required
              />
              <small className="panel-muted">Resultado público: `/e-commerce/blog/{normalizedSlug || 'slug-do-post'}`</small>
            </div>

            <div className="panel-field">
              <label htmlFor="blog-post-category">Categoria</label>
              <input
                id="blog-post-category"
                className="panel-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Arquitetura"
                required
              />
            </div>

            <div className="panel-field">
              <label htmlFor="blog-post-author">Autor</label>
              <input
                id="blog-post-author"
                className="panel-input"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="Equipe de Conteúdo"
                required
              />
            </div>

            <button type="submit" className="panel-btn panel-btn-primary" disabled={saving || !normalizedSlug || !canCreatePosts}>
              {saving ? 'Criando...' : 'Criar post'}
            </button>
          </form>
        </article>

        <article className="panel-card panel-workspace__main">
          <div className="panel-toolbar">
            <div className="panel-toolbar__top">
              <div className="panel-toolbar__copy">
                <h2>Posts existentes</h2>
                <p className="panel-muted">Acompanhe status editorial, busque por assunto e abra o editor do post escolhido.</p>
              </div>
              <div className="panel-toolbar__filters">
                <select
                  className="panel-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  aria-label="Filtrar por status"
                >
                  <option value="all">Todos os status</option>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>

                <input
                  className="panel-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por título, slug ou categoria"
                  aria-label="Buscar posts"
                />
              </div>
            </div>
          </div>

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}
          {loading ? <p className="panel-muted">Carregando posts...</p> : null}

          {!loading ? (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Status</th>
                    <th>Atualizado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <strong>{post.title}</strong>
                        <br />
                        <span className="panel-badge panel-badge-neutral">{post.category || 'Editorial'}</span>
                        <br />
                        <span className="panel-muted">Responsável: {post.ownerName || post.authorName}</span>
                        <br />
                        <span className="panel-muted">/blog/{post.slug}</span>
                      </td>
                      <td>
                        <span className={`panel-badge ${post.status === 'published' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {post.status === 'published' ? 'Publicado' : post.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                        </span>
                      </td>
                      <td>{formatDate(post.updatedAt)}</td>
                      <td>
                        <div className="panel-inline panel-inline-wrap">
                          <Link href={`/ecommpanel/admin/blog/editor?postId=${post.id}`} className="panel-btn panel-btn-secondary panel-btn-sm">
                            Editar
                          </Link>

                          {post.status === 'published' ? (
                            <Link href={`/e-commerce/blog/${post.slug}`} className="panel-btn panel-btn-secondary panel-btn-sm" target="_blank">
                              Abrir
                            </Link>
                          ) : null}

                          {post.status === 'published' && canPublishPosts ? (
                            <span className="panel-badge panel-badge-success">{post.publishedByName || 'Publicado com responsável'}</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && filteredPosts.length === 0 ? <p className="panel-table-empty">Nenhum post encontrado para o filtro atual.</p> : null}
        </article>
      </div>
    </section>
  );
}
