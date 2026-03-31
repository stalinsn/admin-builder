'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { BlogComment, BlogContentSection, BlogPost, BlogPostListItem } from '@/features/blog/types';

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

type PostDetailResponse = {
  post?: BlogPost;
  comments?: BlogComment[];
  error?: string;
};

type ApiErrorResponse = {
  error?: string;
};

type BlogAuthorOption = {
  id: string;
  name: string;
  email: string;
  roleIds: string[];
  permissions: string[];
};

type AuthorsResponse = {
  authors?: BlogAuthorOption[];
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

function makeSection(): BlogContentSection {
  return {
    id: `section-${Math.random().toString(36).slice(2, 8)}`,
    eyebrow: '',
    title: 'Nova seção',
    body: 'Descreva o conteúdo desta seção.',
    imageUrl: '',
    imageAlt: '',
    caption: '',
  };
}

export default function BlogEditorManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredPostId = searchParams.get('postId');

  const [csrfToken, setCsrfToken] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [canModerateComments, setCanModerateComments] = useState(false);
  const [authorOptions, setAuthorOptions] = useState<BlogAuthorOption[]>([]);
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moderatingCommentId, setModeratingCommentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<BlogPost['status']>('draft');
  const [publishedAt, setPublishedAt] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [intro, setIntro] = useState('');
  const [outro, setOutro] = useState('');
  const [readTimeMinutes, setReadTimeMinutes] = useState(4);
  const [featured, setFeatured] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [lastEditedByName, setLastEditedByName] = useState('');
  const [publishedByName, setPublishedByName] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState('');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [commentsRequireModeration, setCommentsRequireModeration] = useState(true);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [bookmarksEnabled, setBookmarksEnabled] = useState(true);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoNoIndex, setSeoNoIndex] = useState(true);
  const [sections, setSections] = useState<BlogContentSection[]>([]);

  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (!term) return true;
      return post.title.toLowerCase().includes(term) || post.slug.toLowerCase().includes(term) || post.category.toLowerCase().includes(term);
    });
  }, [posts, query]);
  const canPublishPosts = useMemo(
    () => ['blog.posts.manage', 'blog.posts.publish'].some((permission) => permissions.includes(permission)),
    [permissions],
  );
  const canManageAuthors = useMemo(
    () => ['blog.posts.manage', 'blog.authors.manage'].some((permission) => permissions.includes(permission)),
    [permissions],
  );
  const canEditCurrentPost = useMemo(() => {
    if (!selectedPostId) return false;
    if (permissions.includes('blog.posts.manage') || permissions.includes('blog.authors.manage')) {
      return true;
    }

    if (!permissions.includes('blog.posts.edit')) {
      return false;
    }

    if (!ownerUserId) {
      return true;
    }

    return ownerUserId === currentUserId;
  }, [currentUserId, ownerUserId, permissions, selectedPostId]);
  const selectedOwnerOption = useMemo(
    () => authorOptions.find((option) => option.id === ownerUserId) || null,
    [authorOptions, ownerUserId],
  );

  function assignOwner(nextOwnerUserId: string) {
    const nextOwner = authorOptions.find((option) => option.id === nextOwnerUserId) || null;
    const previousOwnerName = ownerName;

    setOwnerUserId(nextOwner?.id || '');
    setOwnerName(nextOwner?.name || '');

    if (!nextOwner) return;

    if (!authorName || authorName === previousOwnerName) {
      setAuthorName(nextOwner.name);
    }

    if (!authorRole) {
      setAuthorRole(nextOwner.roleIds.join(', '));
    }
  }

  function applyPost(post: BlogPost, nextComments: BlogComment[]) {
    setSelectedPostId(post.id);
    setStatus(post.status);
    setPublishedAt(post.publishedAt || '');
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setCategory(post.category);
    setTags(post.tags.join(', '));
    setCoverImageUrl(post.coverImageUrl);
    setCoverImageAlt(post.coverImageAlt);
    setIntro(post.intro);
    setOutro(post.outro);
    setReadTimeMinutes(post.readTimeMinutes);
    setFeatured(post.featured);
    setOwnerUserId(post.governance.ownerUserId || '');
    setOwnerName(post.governance.ownerName || post.author.name);
    setLastEditedByName(post.governance.lastEditedByName || post.governance.ownerName || post.author.name);
    setPublishedByName(post.governance.publishedByName || '');
    setAuthorName(post.author.name);
    setAuthorRole(post.author.role);
    setAuthorAvatarUrl(post.author.avatarUrl);
    setCommentsEnabled(post.interaction.commentsEnabled);
    setCommentsRequireModeration(post.interaction.commentsRequireModeration);
    setReactionsEnabled(post.interaction.reactionsEnabled);
    setBookmarksEnabled(post.interaction.bookmarksEnabled);
    setShareEnabled(post.interaction.shareEnabled);
    setSeoTitle(post.seo.title);
    setSeoDescription(post.seo.description);
    setSeoKeywords(post.seo.keywords);
    setSeoNoIndex(post.seo.noIndex);
    setSections(post.sections.length ? post.sections : [makeSection()]);
    setComments(nextComments);
  }

  async function fetchBaseData() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, postsReq, authorsReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/blog/posts', { cache: 'no-store' }),
        fetch('/api/ecommpanel/blog/authors', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      const postsPayload = (await postsReq.json().catch(() => null)) as PostsResponse | null;
      const authorsPayload = (await authorsReq.json().catch(() => null)) as AuthorsResponse | null;

      if (mePayload?.csrfToken) setCsrfToken(mePayload.csrfToken);
      setCurrentUserId(mePayload?.user?.id || '');
      setCurrentUserName(mePayload?.user?.name || '');
      setPermissions(mePayload?.user?.permissions || []);
      setCanModerateComments(
        Boolean(
          mePayload?.user?.permissions?.includes('blog.comments.moderate') ||
            mePayload?.user?.permissions?.includes('blog.posts.manage'),
        ),
      );

      if (!postsReq.ok) {
        setError(postsPayload?.error || 'Não foi possível carregar os posts do blog.');
        return;
      }

      if (authorsReq.ok) {
        setAuthorOptions(authorsPayload?.authors || []);
      }

      const nextPosts = postsPayload?.posts || [];
      setPosts(nextPosts);

      const nextSelectedId =
        (preferredPostId && nextPosts.some((post) => post.id === preferredPostId) ? preferredPostId : '') ||
        nextPosts[0]?.id ||
        '';

      if (nextSelectedId) {
        setSelectedPostId(nextSelectedId);
      }
    } catch {
      setError('Erro de rede ao carregar o editor do blog.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBaseData();
  }, [preferredPostId]);

  useEffect(() => {
    if (!selectedPostId) return;

    let active = true;

    async function fetchDetail() {
      setDetailLoading(true);
      setError(null);

      try {
        const req = await fetch(`/api/ecommpanel/blog/posts/${selectedPostId}`, { cache: 'no-store' });
        const payload = (await req.json().catch(() => null)) as PostDetailResponse | null;
        if (!req.ok || !payload?.post) {
          if (active) {
            setError(payload?.error || 'Não foi possível carregar os detalhes do post.');
          }
          return;
        }

        if (active) {
          applyPost(payload.post, payload.comments || []);
        }
      } catch {
        if (active) {
          setError('Erro de rede ao carregar o post selecionado.');
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    void fetchDetail();

    return () => {
      active = false;
    };
  }, [selectedPostId]);

  function selectPost(postId: string) {
    setSuccess(null);
    setError(null);
    setSelectedPostId(postId);
    router.replace(`/ecommpanel/admin/blog/editor?postId=${postId}`);
  }

  function updateSection(sectionId: string, field: keyof BlogContentSection, value: string) {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, [field]: value } : section)),
    );
  }

  function addSection() {
    setSections((current) => [...current, makeSection()]);
  }

  function removeSection(sectionId: string) {
    setSections((current) => {
      if (current.length <= 1) return current;
      return current.filter((section) => section.id !== sectionId);
    });
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      if (index < 0) return current;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function persistPost(nextStatus?: 'draft' | 'published') {
    if (!selectedPostId || !csrfToken || saving) return;
    if (!canEditCurrentPost && !(nextStatus === 'published' && canPublishPosts)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let resolvedPost: BlogPost | null = null;
      let resolvedComments = comments;

      if (canEditCurrentPost) {
        const saveReq = await fetch(`/api/ecommpanel/blog/posts/${selectedPostId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({
            slug,
            title,
            excerpt,
            category,
            tags: tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            coverImageUrl,
            coverImageAlt,
            intro,
            sections,
            outro,
            readTimeMinutes,
            featured,
            author: {
              name: authorName,
              role: authorRole,
              avatarUrl: authorAvatarUrl,
            },
            interaction: {
              commentsEnabled,
              commentsRequireModeration,
              reactionsEnabled,
              bookmarksEnabled,
              shareEnabled,
            },
            seo: {
              title: seoTitle,
              description: seoDescription,
              keywords: seoKeywords,
              noIndex: seoNoIndex,
            },
            governance: canManageAuthors
              ? {
                  ownerUserId,
                  ownerName: ownerName || authorName,
                }
              : undefined,
          }),
        });

        const savePayload = (await saveReq.json().catch(() => null)) as PostDetailResponse | null;
        if (!saveReq.ok || !savePayload?.post) {
          setError(savePayload?.error || 'Não foi possível salvar o post.');
          return;
        }

        resolvedPost = savePayload.post;
        resolvedComments = savePayload.comments || [];
      } else if (!nextStatus) {
        setError('Seu perfil pode revisar o post, mas não alterar o conteúdo.');
        return;
      }

      if (nextStatus) {
        const statusReq = await fetch(`/api/ecommpanel/blog/posts/${selectedPostId}/${nextStatus}`, {
          method: 'POST',
          headers: {
            'x-csrf-token': csrfToken,
          },
        });

        const statusPayload = (await statusReq.json().catch(() => null)) as { post?: BlogPost; error?: string } | null;
        if (!statusReq.ok || !statusPayload?.post) {
          setError(statusPayload?.error || 'Não foi possível atualizar o status do post.');
          return;
        }

        resolvedPost = statusPayload.post;
      }

      if (!resolvedPost) {
        setError('Não foi possível resolver o estado final do post.');
        return;
      }

      applyPost(resolvedPost, resolvedComments);
      await fetchBaseData();
      setSuccess(nextStatus === 'published' ? 'Post salvo e publicado.' : nextStatus === 'draft' ? 'Post salvo e mantido como rascunho.' : 'Post salvo.');
    } catch {
      setError('Erro de rede ao salvar o post.');
    } finally {
      setSaving(false);
    }
  }

  async function moderateComment(commentId: string, nextStatus: 'approved' | 'rejected') {
    if (!selectedPostId || !csrfToken || moderatingCommentId || !canModerateComments) return;

    setModeratingCommentId(commentId);
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch(`/api/ecommpanel/blog/posts/${selectedPostId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await req.json().catch(() => null)) as { comment?: BlogComment; error?: string } | null;
      if (!req.ok || !payload?.comment) {
        setError(payload?.error || 'Não foi possível moderar o comentário.');
        return;
      }

      setComments((current) => current.map((comment) => (comment.id === commentId ? payload.comment! : comment)));
      setSuccess(nextStatus === 'approved' ? 'Comentário aprovado.' : 'Comentário rejeitado.');
    } catch {
      setError('Erro de rede ao moderar o comentário.');
    } finally {
      setModeratingCommentId(null);
    }
  }

  if (!loading && posts.length === 0) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Editor do blog</h1>
          <p className="panel-muted">Nenhum post foi criado ainda. Cadastre o primeiro em `Blog / Visão geral`.</p>
          <Link href="/ecommpanel/admin/blog" className="panel-btn panel-btn-secondary">
            Ir para gestão de posts
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="panel-grid" aria-labelledby="blog-editor-title">
      <article className="panel-card panel-card-hero">
        <p className="panel-kicker">Blog</p>
        <h1 id="blog-editor-title">Editor do blog e comentários</h1>
        <p className="panel-muted">
          Aqui você ajusta o conteúdo do post, o que aparece no Google e como os comentários funcionam no site.
        </p>
        <p className="panel-muted">
          Sessão atual: <strong>{currentUserName || 'Usuário autenticado'}</strong> · Responsáveis:{' '}
          <strong>{canManageAuthors ? 'você pode trocar quem responde por este post' : 'somente leitura do responsável atual'}</strong>
        </p>
      </article>

      {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
      {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

      <div className="panel-blog-editor-layout">
        <aside className="panel-card panel-blog-sidebar">
          <div className="panel-users-toolbar">
            <h2>Posts</h2>
            <input
              className="panel-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar post"
              aria-label="Buscar post"
            />
          </div>

          <div className="panel-blog-post-list">
            {filteredPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                className={`panel-blog-post-chip ${post.id === selectedPostId ? 'is-active' : ''}`}
                onClick={() => selectPost(post.id)}
              >
                <strong>{post.title}</strong>
                <span>{post.category}</span>
                <small>Responsável: {post.ownerName || post.authorName}</small>
                <small>/blog/{post.slug}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="panel-grid panel-blog-main">
          <article className="panel-card">
            <div className="panel-users-toolbar">
              <div>
                <h2>Configuração do post</h2>
                <p className="panel-muted">
                  Status atual: <strong>{status === 'published' ? 'Publicado' : status === 'draft' ? 'Rascunho' : 'Arquivado'}</strong> · Publicado em{' '}
                  <strong>{formatDate(publishedAt)}</strong>
                </p>
                <p className="panel-muted">
                  Responsável: <strong>{ownerName || '-'}</strong> · Última edição por <strong>{lastEditedByName || '-'}</strong>
                  {publishedByName ? (
                    <>
                      {' '}
                      · Última publicação por <strong>{publishedByName}</strong>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="panel-inline panel-inline-wrap">
                <Link href="/ecommpanel/admin/blog" className="panel-btn panel-btn-secondary">
                  Voltar
                </Link>
                {status === 'published' ? (
                  <Link href={`/e-commerce/blog/${slug}`} className="panel-btn panel-btn-secondary" target="_blank">
                    Abrir post
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="panel-btn panel-btn-secondary"
                  disabled={saving || detailLoading || !canEditCurrentPost}
                  onClick={() => void persistPost('draft')}
                >
                  {saving ? 'Salvando...' : 'Salvar rascunho'}
                </button>
                <button
                  type="button"
                  className="panel-btn panel-btn-primary"
                  disabled={saving || detailLoading || !canPublishPosts}
                  onClick={() => void persistPost('published')}
                >
                  {saving ? 'Publicando...' : 'Salvar e publicar'}
                </button>
              </div>
            </div>

            {!detailLoading && !canEditCurrentPost ? (
              <p className="panel-feedback panel-feedback-error">
                Seu perfil não pode editar o conteúdo deste post. Você ainda pode revisar o material ou executar apenas as ações liberadas para o seu acesso.
              </p>
            ) : null}

            {!detailLoading && canPublishPosts && !canEditCurrentPost ? (
              <p className="panel-feedback panel-feedback-success">
                Seu acesso atual permite publicar o post, mesmo sem alterar o conteúdo.
              </p>
            ) : null}

            {detailLoading ? <p className="panel-muted">Carregando post...</p> : null}

            {!detailLoading ? (
              <fieldset className="panel-plain-fieldset" disabled={!canEditCurrentPost || detailLoading}>
                <div className="panel-blog-form-grid">
                  <div className="panel-field">
                    <label htmlFor="blog-editor-title-input">Título</label>
                    <input id="blog-editor-title-input" className="panel-input" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-slug-input">Slug</label>
                    <input id="blog-editor-slug-input" className="panel-input" value={slug} onChange={(event) => setSlug(event.target.value)} />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-category-input">Categoria</label>
                    <input id="blog-editor-category-input" className="panel-input" value={category} onChange={(event) => setCategory(event.target.value)} />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-tags-input">Tags</label>
                    <input
                      id="blog-editor-tags-input"
                      className="panel-input"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="blog, conteúdo, loja"
                    />
                  </div>

                  <div className="panel-field panel-field-full">
                    <label htmlFor="blog-editor-excerpt-input">Resumo</label>
                    <textarea
                      id="blog-editor-excerpt-input"
                      className="panel-textarea"
                      rows={3}
                      value={excerpt}
                      onChange={(event) => setExcerpt(event.target.value)}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-cover-url">Imagem de capa</label>
                    <input
                      id="blog-editor-cover-url"
                      className="panel-input"
                      value={coverImageUrl}
                      onChange={(event) => setCoverImageUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-cover-alt">Alt da capa</label>
                    <input
                      id="blog-editor-cover-alt"
                      className="panel-input"
                      value={coverImageAlt}
                      onChange={(event) => setCoverImageAlt(event.target.value)}
                    />
                  </div>

                  <div className="panel-field panel-field-full">
                    <label htmlFor="blog-editor-intro">Introdução</label>
                    <textarea id="blog-editor-intro" className="panel-textarea" rows={4} value={intro} onChange={(event) => setIntro(event.target.value)} />
                  </div>

                  <div className="panel-field panel-field-full">
                    <label htmlFor="blog-editor-outro">Fechamento</label>
                    <textarea id="blog-editor-outro" className="panel-textarea" rows={4} value={outro} onChange={(event) => setOutro(event.target.value)} />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="blog-editor-read-time">Tempo de leitura</label>
                    <input
                      id="blog-editor-read-time"
                      className="panel-input"
                      type="number"
                      min={1}
                      max={60}
                      value={readTimeMinutes}
                      onChange={(event) => setReadTimeMinutes(Number(event.target.value || 1))}
                    />
                  </div>

                  <label className="panel-checkbox">
                    <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
                    <span>Marcar como destaque</span>
                  </label>
                </div>
              </fieldset>
            ) : null}
          </article>

          <article className="panel-card">
            <div className="panel-users-toolbar">
              <div>
                <h2>Autor e SEO</h2>
                <p className="panel-muted">
                  Você pode definir quem responde pelo post internamente e também o nome público exibido como autor.
                </p>
              </div>
            </div>

            <fieldset className="panel-plain-fieldset" disabled={!canEditCurrentPost || detailLoading}>
              <div className="panel-blog-form-grid">
                <div className="panel-field">
                  <label htmlFor="blog-editor-owner-user">Responsável interno</label>
                  <select
                    id="blog-editor-owner-user"
                    className="panel-input"
                    value={ownerUserId}
                    onChange={(event) => assignOwner(event.target.value)}
                    disabled={!canManageAuthors}
                  >
                    <option value="">Sem responsável vinculado</option>
                    {authorOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.roleIds.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="panel-field">
                  <label htmlFor="blog-editor-owner-name">Nome do responsável</label>
                  <input
                    id="blog-editor-owner-name"
                    className="panel-input"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    disabled={!canManageAuthors}
                  />
                </div>

                {selectedOwnerOption ? (
                  <div className="panel-field panel-field-full">
                    <label>Pessoa vinculada</label>
                    <div className="panel-dashboard-row">
                      <strong>{selectedOwnerOption.name}</strong>
                      <span>{selectedOwnerOption.email}</span>
                      <small>{selectedOwnerOption.roleIds.join(', ')}</small>
                    </div>
                  </div>
                ) : null}

                <div className="panel-field">
                  <label htmlFor="blog-editor-author-name">Nome do autor</label>
                  <input id="blog-editor-author-name" className="panel-input" value={authorName} onChange={(event) => setAuthorName(event.target.value)} />
                </div>

                <div className="panel-field">
                  <label htmlFor="blog-editor-author-role">Papel do autor</label>
                  <input id="blog-editor-author-role" className="panel-input" value={authorRole} onChange={(event) => setAuthorRole(event.target.value)} />
                </div>

                <div className="panel-field panel-field-full">
                  <label htmlFor="blog-editor-author-avatar">Avatar do autor</label>
                  <input
                    id="blog-editor-author-avatar"
                    className="panel-input"
                    value={authorAvatarUrl}
                    onChange={(event) => setAuthorAvatarUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="panel-field">
                  <label htmlFor="blog-editor-seo-title">SEO title</label>
                  <input id="blog-editor-seo-title" className="panel-input" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
                </div>

                <div className="panel-field">
                  <label htmlFor="blog-editor-seo-keywords">SEO keywords</label>
                  <input
                    id="blog-editor-seo-keywords"
                    className="panel-input"
                    value={seoKeywords}
                    onChange={(event) => setSeoKeywords(event.target.value)}
                    placeholder="blog, cms, operação"
                  />
                </div>

                <div className="panel-field panel-field-full">
                  <label htmlFor="blog-editor-seo-description">SEO description</label>
                  <textarea
                    id="blog-editor-seo-description"
                    className="panel-textarea"
                    rows={3}
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                </div>

                <label className="panel-checkbox">
                  <input type="checkbox" checked={seoNoIndex} onChange={(event) => setSeoNoIndex(event.target.checked)} />
                  <span>Manter noindex quando fizer sentido</span>
                </label>
              </div>
            </fieldset>
          </article>

          <article className="panel-card">
            <div className="panel-users-toolbar">
              <h2>Interações do post</h2>
            </div>

            <fieldset className="panel-plain-fieldset" disabled={!canEditCurrentPost || detailLoading}>
              <div className="panel-blog-toggle-grid">
                <label className="panel-checkbox">
                  <input type="checkbox" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />
                  <span>Comentários habilitados</span>
                </label>

                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={commentsRequireModeration}
                    onChange={(event) => setCommentsRequireModeration(event.target.checked)}
                  />
                  <span>Comentários passam por moderação</span>
                </label>

                <label className="panel-checkbox">
                  <input type="checkbox" checked={reactionsEnabled} onChange={(event) => setReactionsEnabled(event.target.checked)} />
                  <span>Reações habilitadas</span>
                </label>

                <label className="panel-checkbox">
                  <input type="checkbox" checked={bookmarksEnabled} onChange={(event) => setBookmarksEnabled(event.target.checked)} />
                  <span>Favoritos locais habilitados</span>
                </label>

                <label className="panel-checkbox">
                  <input type="checkbox" checked={shareEnabled} onChange={(event) => setShareEnabled(event.target.checked)} />
                  <span>Ação de copiar link habilitada</span>
                </label>
              </div>
            </fieldset>
          </article>

          <article className="panel-card">
            <div className="panel-users-toolbar">
              <div>
                <h2>Seções de conteúdo</h2>
                <p className="panel-muted">Cada seção organiza uma parte do post com imagem e texto, deixando a edição mais simples.</p>
              </div>
              <button type="button" className="panel-btn panel-btn-secondary" onClick={addSection} disabled={!canEditCurrentPost || detailLoading}>
                Adicionar seção
              </button>
            </div>

            <fieldset className="panel-plain-fieldset" disabled={!canEditCurrentPost || detailLoading}>
              <div className="panel-blog-sections">
                {sections.map((section, index) => (
                  <article className="panel-blog-section-card" key={section.id}>
                    <div className="panel-users-toolbar">
                      <div>
                        <strong>Seção {index + 1}</strong>
                        <p className="panel-muted">Bloco de conteúdo com imagem e texto.</p>
                      </div>
                      <div className="panel-inline panel-inline-wrap">
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => moveSection(section.id, -1)}>
                          Subir
                        </button>
                        <button type="button" className="panel-btn panel-btn-secondary panel-btn-xs" onClick={() => moveSection(section.id, 1)}>
                          Descer
                        </button>
                        <button type="button" className="panel-btn panel-btn-danger panel-btn-xs" onClick={() => removeSection(section.id)}>
                          Remover
                        </button>
                      </div>
                    </div>

                    <div className="panel-blog-form-grid">
                      <div className="panel-field">
                        <label>Eyebrow</label>
                        <input className="panel-input" value={section.eyebrow} onChange={(event) => updateSection(section.id, 'eyebrow', event.target.value)} />
                      </div>

                      <div className="panel-field">
                        <label>Título</label>
                        <input className="panel-input" value={section.title} onChange={(event) => updateSection(section.id, 'title', event.target.value)} />
                      </div>

                      <div className="panel-field">
                        <label>Imagem</label>
                        <input className="panel-input" value={section.imageUrl} onChange={(event) => updateSection(section.id, 'imageUrl', event.target.value)} />
                      </div>

                      <div className="panel-field">
                        <label>Alt da imagem</label>
                        <input className="panel-input" value={section.imageAlt} onChange={(event) => updateSection(section.id, 'imageAlt', event.target.value)} />
                      </div>

                      <div className="panel-field panel-field-full">
                        <label>Legenda</label>
                        <input className="panel-input" value={section.caption} onChange={(event) => updateSection(section.id, 'caption', event.target.value)} />
                      </div>

                      <div className="panel-field panel-field-full">
                        <label>Corpo</label>
                        <textarea className="panel-textarea" rows={6} value={section.body} onChange={(event) => updateSection(section.id, 'body', event.target.value)} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </fieldset>
          </article>

          <article className="panel-card">
            <div className="panel-users-toolbar">
              <div>
                <h2>Moderação de comentários</h2>
                <p className="panel-muted">Fila operacional do post atual.</p>
              </div>
            </div>

            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Comentário</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((comment) => (
                    <tr key={comment.id}>
                      <td>
                        <strong>{comment.authorName}</strong>
                        <br />
                        <span className="panel-muted">{comment.content}</span>
                      </td>
                      <td>
                        <span className={`panel-badge ${comment.status === 'approved' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {comment.status === 'approved' ? 'Aprovado' : comment.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                        </span>
                      </td>
                      <td>{formatDate(comment.createdAt)}</td>
                      <td>
                        {canModerateComments ? (
                          <div className="panel-inline panel-inline-wrap">
                            <button
                              type="button"
                              className="panel-btn panel-btn-secondary panel-btn-xs"
                              disabled={moderatingCommentId === comment.id || comment.status === 'approved'}
                              onClick={() => void moderateComment(comment.id, 'approved')}
                            >
                              Aprovar
                            </button>

                            <button
                              type="button"
                              className="panel-btn panel-btn-danger panel-btn-xs"
                              disabled={moderatingCommentId === comment.id || comment.status === 'rejected'}
                              onClick={() => void moderateComment(comment.id, 'rejected')}
                            >
                              Rejeitar
                            </button>
                          </div>
                        ) : (
                          <span className="panel-muted">Sem permissão de moderação</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!comments.length ? <p className="panel-table-empty">Nenhum comentário registrado para este post.</p> : null}
          </article>
        </div>
      </div>
    </section>
  );
}
