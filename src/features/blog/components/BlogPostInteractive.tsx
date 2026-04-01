'use client';

import { useEffect, useState } from 'react';

import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';
import type { BlogComment, BlogReactionSummary } from '../types';

type CommentsResponse = {
  comments?: BlogComment[];
  error?: string;
};

type ReactionsResponse = {
  summary?: BlogReactionSummary;
  error?: string;
};

type BlogPostInteractiveProps = {
  postSlug: string;
  commentsEnabled: boolean;
  reactionsEnabled: boolean;
  bookmarksEnabled: boolean;
  shareEnabled: boolean;
  initialComments: BlogComment[];
  initialSummary: BlogReactionSummary;
};

const BLOG_FAVORITES_KEY = withVersion('blog.favorites', 'v1');

function loadFavorites(): string[] {
  return safeJsonGet<string[]>(BLOG_FAVORITES_KEY, []);
}

export default function BlogPostInteractive({
  postSlug,
  commentsEnabled,
  reactionsEnabled,
  bookmarksEnabled,
  shareEnabled,
  initialComments,
  initialSummary,
}: BlogPostInteractiveProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [comments, setComments] = useState<BlogComment[]>(initialComments);
  const [summary, setSummary] = useState<BlogReactionSummary>(initialSummary);
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFavorite = favorites.includes(postSlug);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, [postSlug]);

  useEffect(() => {
    let active = true;

    async function refreshInteractiveState() {
      try {
        const [commentsReq, reactionsReq] = await Promise.all([
          commentsEnabled ? fetch(`/api/blog/posts/${postSlug}/comments`, { cache: 'no-store' }) : null,
          reactionsEnabled ? fetch(`/api/blog/posts/${postSlug}/reactions`, { cache: 'no-store' }) : null,
        ]);

        if (commentsReq) {
          const payload = (await commentsReq.json().catch(() => null)) as CommentsResponse | null;
          if (active && commentsReq.ok) {
            setComments(payload?.comments || []);
          }
        }

        if (reactionsReq) {
          const payload = (await reactionsReq.json().catch(() => null)) as ReactionsResponse | null;
          if (active && reactionsReq.ok && payload?.summary) {
            setSummary(payload.summary);
          }
        }
      } catch {
        // Keep SSR snapshot if runtime fetch fails.
      }
    }

    void refreshInteractiveState();

    return () => {
      active = false;
    };
  }, [commentsEnabled, postSlug, reactionsEnabled]);

  function toggleFavorite() {
    const current = loadFavorites();
    const next = current.includes(postSlug) ? current.filter((slug) => slug !== postSlug) : [...current, postSlug];
    safeJsonSet(BLOG_FAVORITES_KEY, next);
      setFavorites(next);
      setFeedback(next.includes(postSlug) ? 'Post salvo nos favoritos do navegador.' : 'Post removido dos favoritos do navegador.');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback('Link copiado para a área de transferência.');
      setError(null);
    } catch {
      setError('Não foi possível copiar o link deste post.');
    }
  }

  async function submitReaction(nextValue: 'like' | 'dislike') {
    if (!reactionsEnabled || busy) return;

    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const req = await fetch(`/api/blog/posts/${postSlug}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: summary.userReaction === nextValue ? 'clear' : nextValue,
        }),
      });

      const payload = (await req.json().catch(() => null)) as ReactionsResponse | null;
      if (!req.ok || !payload?.summary) {
        setError(payload?.error || 'Não foi possível registrar sua reação.');
        return;
      }

      setSummary(payload.summary);
      setFeedback('Interação registrada.');
    } catch {
      setError('Erro de rede ao registrar a reação.');
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentsEnabled || commentBusy) return;

    setCommentBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const req = await fetch(`/api/blog/posts/${postSlug}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorName: commentAuthorName,
          content: commentContent,
        }),
      });

      const payload = (await req.json().catch(() => null)) as { comment?: BlogComment; visibility?: string; error?: string } | null;
      if (!req.ok) {
        setError(payload?.error || 'Não foi possível enviar o comentário.');
        return;
      }

      if (payload?.visibility === 'approved' && payload.comment) {
        setComments((current) => [payload.comment!, ...current]);
        setFeedback('Comentário publicado com sucesso.');
      } else {
        setFeedback('Comentário enviado para moderação.');
      }

      setCommentAuthorName('');
      setCommentContent('');
    } catch {
      setError('Erro de rede ao enviar comentário.');
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <div className="ecom-blog-interactive-stack">
      <section className="ecom-blog-actions-panel" aria-label="Ações do post">
        <div className="ecom-blog-actions-grid">
          {reactionsEnabled ? (
            <>
              <button
                type="button"
                className={`ecom-blog-action-btn ${summary.userReaction === 'like' ? 'is-active' : ''}`}
                onClick={() => void submitReaction('like')}
                disabled={busy}
              >
                <strong>{summary.likes}</strong>
                <span>Gostei</span>
              </button>

              <button
                type="button"
                className={`ecom-blog-action-btn ${summary.userReaction === 'dislike' ? 'is-active' : ''}`}
                onClick={() => void submitReaction('dislike')}
                disabled={busy}
              >
                <strong>{summary.dislikes}</strong>
                <span>Não gostei</span>
              </button>
            </>
          ) : null}

          {bookmarksEnabled ? (
            <button type="button" className={`ecom-blog-action-btn ${isFavorite ? 'is-active' : ''}`} onClick={toggleFavorite}>
              <strong>{isFavorite ? 'Salvo' : 'Favorito'}</strong>
              <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>
          ) : null}

          {shareEnabled ? (
            <button type="button" className="ecom-blog-action-btn" onClick={() => void copyLink()}>
              <strong>Link</strong>
              <span>Copiar link</span>
            </button>
          ) : null}
        </div>

        {feedback ? <p className="ecom-blog-feedback is-success">{feedback}</p> : null}
        {error ? <p className="ecom-blog-feedback is-error">{error}</p> : null}
      </section>

      <section className="ecom-blog-comments-panel" aria-labelledby="blog-comments-title">
        <div className="ecom-blog-comments-header">
          <div>
            <span className="ecom-blog-kicker">Comentários</span>
            <h2 id="blog-comments-title">Conversa sobre o post</h2>
          </div>
          <span className="ecom-blog-comments-count">{comments.length} publicados</span>
        </div>

        {commentsEnabled ? (
          <form className="ecom-blog-comment-form" onSubmit={submitComment}>
            <div className="ecom-blog-form-grid">
              <label>
                <span>Nome</span>
                <input
                  value={commentAuthorName}
                  onChange={(event) => setCommentAuthorName(event.target.value)}
                  placeholder="Seu nome"
                  required
                  maxLength={60}
                />
              </label>

              <label className="is-full">
                <span>Comentário</span>
                <textarea
                  value={commentContent}
                  onChange={(event) => setCommentContent(event.target.value)}
                  placeholder="Compartilhe um contexto, pergunta ou observação sobre este post."
                  rows={5}
                  required
                  maxLength={2000}
                />
              </label>
            </div>

            <div className="ecom-blog-comment-form-footer">
              <p>Os comentários podem ser moderados antes de aparecer publicamente.</p>
              <button type="submit" disabled={commentBusy}>
                {commentBusy ? 'Enviando...' : 'Enviar comentário'}
              </button>
            </div>
          </form>
        ) : (
          <p className="ecom-blog-feedback">Comentários desativados para este post.</p>
        )}

        <div className="ecom-blog-comments-list">
          {comments.length ? (
            comments.map((comment) => (
              <article className="ecom-blog-comment" key={comment.id}>
                <div className="ecom-blog-comment-head">
                  <strong>{comment.authorName}</strong>
                  <span>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(comment.createdAt))}
                  </span>
                </div>
                <p>{comment.content}</p>
              </article>
            ))
          ) : (
            <p className="ecom-blog-feedback">Ainda não existem comentários publicados para este post.</p>
          )}
        </div>
      </section>
    </div>
  );
}
