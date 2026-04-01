import Link from 'next/link';

import { Breadcrumbs } from '@/features/ecommerce/components/common/Breadcrumbs';
import { sanitizeImageUrl } from '@/utils/inputSecurity';
import type { BlogPostListItem } from '../types';

function formatDate(value?: string): string {
  if (!value) return 'Rascunho';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Rascunho';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
  }).format(date);
}

export default function BlogListView({ posts }: { posts: BlogPostListItem[] }) {
  return (
    <section className="ecom-blog-shell">
      <div className="ecom-blog-container">
        <Breadcrumbs
          items={[
            { href: '/e-commerce/blog', label: 'Blog', current: true },
          ]}
        />

        <header className="ecom-blog-hero">
          <div>
            <span className="ecom-blog-kicker">Blog do ecossistema</span>
            <h1>Conteúdo operacional, produto e arquitetura em um fluxo editável.</h1>
            <p>
              O blog nasce como uma camada editorial da plataforma: posts com imagem, texto estruturado, schema, comentários moderados e
              interações prontas para migrar depois para banco de dados.
            </p>
          </div>

          <div className="ecom-blog-hero-card">
            <strong>{posts.length}</strong>
            <span>posts publicados</span>
            <p>Entradas renderizadas por documento publicado, com leitura granular no runtime.</p>
          </div>
        </header>

        {posts.length === 0 ? (
          <article className="ecom-blog-empty">
            <h2>Nenhum post publicado ainda</h2>
            <p>Crie e publique o primeiro post em `/ecommpanel/admin/blog` para ativar esta seção do site.</p>
          </article>
        ) : (
          <div className="ecom-blog-grid">
            {posts.map((post) => {
              const coverImageUrl = sanitizeImageUrl(post.coverImageUrl, '');
              return (
              <article className="ecom-blog-card" key={post.id}>
                <div className="ecom-blog-card-media">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt={post.coverImageAlt || post.title} loading="lazy" />
                  ) : (
                    <div className="ecom-blog-card-placeholder" aria-hidden="true">
                      <span>{post.category || 'Editorial'}</span>
                    </div>
                  )}
                </div>

                <div className="ecom-blog-card-body">
                  <div className="ecom-blog-card-meta">
                    <span>{post.category || 'Editorial'}</span>
                    <span>{post.readTimeMinutes} min</span>
                    {post.featured ? <span>Destaque</span> : null}
                  </div>

                  <h2>
                    <Link href={`/e-commerce/blog/${post.slug}`}>{post.title}</Link>
                  </h2>

                  <p>{post.excerpt}</p>

                  <div className="ecom-blog-card-footer">
                    <div>
                      <strong>{post.authorName}</strong>
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>

                    <Link href={`/e-commerce/blog/${post.slug}`} className="ecom-blog-card-link">
                      Ler post
                    </Link>
                  </div>

                  {post.tags.length ? (
                    <div className="ecom-blog-tag-row" aria-label="Tags do post">
                      {post.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
