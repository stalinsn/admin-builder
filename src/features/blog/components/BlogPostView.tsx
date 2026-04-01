import { Breadcrumbs } from '@/features/ecommerce/components/common/Breadcrumbs';
import { sanitizeImageUrl, serializeJsonForHtmlScript } from '@/utils/inputSecurity';
import type { BlogComment, BlogPublishedPost, BlogReactionSummary } from '../types';
import BlogPostInteractive from './BlogPostInteractive';

type BlogPostViewProps = {
  post: BlogPublishedPost;
  initialComments: BlogComment[];
  initialSummary: BlogReactionSummary;
  siteUrl?: string;
};

function formatDate(value?: string): string {
  if (!value) return 'Não publicado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não publicado';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function buildSchema(post: BlogPublishedPost, siteUrl?: string) {
  const url = siteUrl ? `${siteUrl}${post.canonicalPath}` : post.canonicalPath;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seo.title || post.title,
    description: post.seo.description || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    articleSection: post.category,
    keywords: post.tags.join(', '),
    image: post.coverImageUrl || undefined,
    author: {
      '@type': 'Person',
      name: post.author.name,
      jobTitle: post.author.role,
    },
    mainEntityOfPage: url,
    url,
  };
}

export default function BlogPostView({ post, initialComments, initialSummary, siteUrl }: BlogPostViewProps) {
  const schema = buildSchema(post, siteUrl);
  const authorAvatarUrl = sanitizeImageUrl(post.author.avatarUrl, '');
  const coverImageUrl = sanitizeImageUrl(post.coverImageUrl, '');

  return (
    <article className="ecom-blog-shell ecom-blog-shell--post">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonForHtmlScript(schema) }} />

      <div className="ecom-blog-container">
        <Breadcrumbs
          items={[
            { href: '/e-commerce/blog', label: 'Blog' },
            { href: post.canonicalPath, label: post.title, current: true },
          ]}
        />

        <header className="ecom-blog-post-hero">
          <div className="ecom-blog-post-copy">
            <div className="ecom-blog-post-meta">
              <span>{post.category || 'Editorial'}</span>
              <span>{post.readTimeMinutes} min</span>
              {post.featured ? <span>Destaque</span> : null}
            </div>

            <h1>{post.title}</h1>
            <p>{post.excerpt}</p>

            <div className="ecom-blog-author-row">
              <div className="ecom-blog-author-avatar" aria-hidden="true">
                {authorAvatarUrl ? <img src={authorAvatarUrl} alt="" /> : <span>{post.author.name.charAt(0)}</span>}
              </div>

              <div className="ecom-blog-author-copy">
                <strong>{post.author.name}</strong>
                <span>{post.author.role || 'Editorial'}</span>
                <small>{formatDate(post.publishedAt)}</small>
              </div>
            </div>

            {post.tags.length ? (
              <div className="ecom-blog-tag-row" aria-label="Tags do post">
                {post.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ecom-blog-post-cover">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt={post.coverImageAlt || post.title} />
            ) : (
              <div className="ecom-blog-card-placeholder" aria-hidden="true">
                <span>{post.category || 'Editorial'}</span>
              </div>
            )}
          </div>
        </header>

        <div className="ecom-blog-post-layout">
          <div className="ecom-blog-post-content">
            {post.intro ? <p className="ecom-blog-richtext ecom-blog-intro">{post.intro}</p> : null}

            {post.sections.map((section) => (
              <section className="ecom-blog-section" key={section.id}>
                {sanitizeImageUrl(section.imageUrl, '') ? (
                  <figure className="ecom-blog-section-media">
                    <img src={sanitizeImageUrl(section.imageUrl, '')} alt={section.imageAlt || section.title} loading="lazy" />
                    {section.caption ? <figcaption>{section.caption}</figcaption> : null}
                  </figure>
                ) : null}

                <div className="ecom-blog-section-copy">
                  {section.eyebrow ? <span className="ecom-blog-kicker">{section.eyebrow}</span> : null}
                  <h2>{section.title}</h2>
                  <p className="ecom-blog-richtext">{section.body}</p>
                </div>
              </section>
            ))}

            {post.outro ? (
              <section className="ecom-blog-outro">
                <h2>Fechamento</h2>
                <p className="ecom-blog-richtext">{post.outro}</p>
              </section>
            ) : null}
          </div>

          <aside className="ecom-blog-post-sidebar">
            <div className="ecom-blog-sidebar-card">
              <span className="ecom-blog-kicker">Status do post</span>
              <strong>Publicado</strong>
              <p>Schema, comentários e reações ficam desacoplados do documento principal para facilitar evolução para banco.</p>
            </div>

            <div className="ecom-blog-sidebar-card">
              <span className="ecom-blog-kicker">Permissões futuras</span>
              <p>Esta estrutura já separa conteúdo, interação e moderação. Isso facilita introduzir perfis de autor, editor e moderador depois.</p>
            </div>
          </aside>
        </div>

        <BlogPostInteractive
          postSlug={post.slug}
          commentsEnabled={post.interaction.commentsEnabled}
          reactionsEnabled={post.interaction.reactionsEnabled}
          bookmarksEnabled={post.interaction.bookmarksEnabled}
          shareEnabled={post.interaction.shareEnabled}
          initialComments={initialComments}
          initialSummary={initialSummary}
        />
      </div>
    </article>
  );
}
