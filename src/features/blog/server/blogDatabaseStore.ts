import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';

import type {
  BlogComment,
  BlogPost,
  BlogPostListItem,
  BlogPublishedPost,
  BlogReactionEntry,
  BlogReactionSummary,
  BlogReactionValue,
} from '../types';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: unknown;
  cover_image_url: string;
  cover_image_alt: string;
  author: unknown;
  intro: string;
  sections: unknown;
  outro: string;
  read_time_minutes: number;
  featured: boolean;
  status: BlogPost['status'];
  interaction: unknown;
  seo: unknown;
  governance: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
};

type BlogCommentRow = {
  id: string;
  post_slug: string;
  author_name: string;
  content: string;
  status: BlogComment['status'];
  created_at: string | Date;
  updated_at: string | Date;
  moderated_at: string | Date | null;
  moderation_note: string | null;
  fingerprint_hash: string;
};

type BlogReactionRow = {
  fingerprint_hash: string;
  value: BlogReactionValue;
  updated_at: string | Date;
};

declare global {
  var __BLOG_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function mapBlogPostRow(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    tags: parseJson<string[]>(row.tags, []),
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    author: parseJson<BlogPost['author']>(row.author, { name: 'Equipe Editorial', role: 'Editorial', avatarUrl: '' }),
    intro: row.intro,
    sections: parseJson<BlogPost['sections']>(row.sections, []),
    outro: row.outro,
    readTimeMinutes: Number(row.read_time_minutes || 0),
    featured: Boolean(row.featured),
    status: row.status,
    interaction: parseJson<BlogPost['interaction']>(row.interaction, {
      commentsEnabled: true,
      commentsRequireModeration: true,
      reactionsEnabled: true,
      bookmarksEnabled: true,
      shareEnabled: true,
    }),
    seo: parseJson<BlogPost['seo']>(row.seo, { title: row.title, description: row.excerpt, keywords: '', noIndex: true }),
    governance: parseJson<BlogPost['governance']>(row.governance, {
      ownerName: 'Equipe Editorial',
      lastEditedByName: 'Equipe Editorial',
    }),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    publishedAt: toIso(row.published_at),
  };
}

function toListItem(post: BlogPost): BlogPostListItem {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    coverImageUrl: post.coverImageUrl,
    coverImageAlt: post.coverImageAlt,
    readTimeMinutes: post.readTimeMinutes,
    featured: post.featured,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
    authorName: post.author.name,
    ownerUserId: post.governance.ownerUserId,
    ownerName: post.governance.ownerName,
    publishedByName: post.governance.publishedByName,
  };
}

function mapBlogCommentRow(row: BlogCommentRow): BlogComment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    authorName: row.author_name,
    content: row.content,
    status: row.status,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    moderatedAt: toIso(row.moderated_at),
    moderationNote: row.moderation_note || undefined,
    fingerprintHash: row.fingerprint_hash,
  };
}

function mapReactionRows(entries: BlogReactionRow[], fingerprintHash?: string): BlogReactionSummary {
  const likes = entries.filter((entry) => entry.value === 'like').length;
  const dislikes = entries.filter((entry) => entry.value === 'dislike').length;
  const userReaction = fingerprintHash ? entries.find((entry) => entry.fingerprint_hash === fingerprintHash)?.value || null : null;
  return { likes, dislikes, userReaction };
}

async function ensureBlogSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__BLOG_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__BLOG_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      category TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      cover_image_url TEXT NOT NULL DEFAULT '',
      cover_image_alt TEXT NOT NULL DEFAULT '',
      author JSONB NOT NULL,
      intro TEXT NOT NULL,
      sections JSONB NOT NULL DEFAULT '[]'::jsonb,
      outro TEXT NOT NULL,
      read_time_minutes INTEGER NOT NULL DEFAULT 1,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      interaction JSONB NOT NULL,
      seo JSONB NOT NULL,
      governance JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts (published_at DESC);

    CREATE TABLE IF NOT EXISTS blog_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      post_slug TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      moderated_at TIMESTAMPTZ NULL,
      moderation_note TEXT NULL,
      fingerprint_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments (post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_comments_post_slug ON blog_comments (post_slug);
    CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON blog_comments (status);

    CREATE TABLE IF NOT EXISTS blog_reactions (
      post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      post_slug TEXT NOT NULL,
      fingerprint_hash TEXT NOT NULL,
      value TEXT NOT NULL CHECK (value IN ('like', 'dislike')),
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (post_id, fingerprint_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_blog_reactions_post_id ON blog_reactions (post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_reactions_post_slug ON blog_reactions (post_slug);
  `);

  ensured.add(runtimeKey);
}

async function withBlogDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureBlogSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function countBlogPostsInDatabase(): Promise<StoreAvailability<number>> {
  return withBlogDb(async (client) => {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM blog_posts');
    return Number(result.rows[0]?.count || 0);
  });
}

export async function listBlogPostsFromDatabase(): Promise<StoreAvailability<BlogPostListItem[]>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogPostRow>('SELECT * FROM blog_posts ORDER BY updated_at DESC');
    return result.rows.map((row) => toListItem(mapBlogPostRow(row)));
  });
}

export async function getBlogPostByIdFromDatabase(postId: string): Promise<StoreAvailability<BlogPost | null>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogPostRow>('SELECT * FROM blog_posts WHERE id = $1 LIMIT 1', [postId]);
    return result.rows[0] ? mapBlogPostRow(result.rows[0]) : null;
  });
}

export async function getBlogPostBySlugFromDatabase(slug: string): Promise<StoreAvailability<BlogPost | null>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogPostRow>('SELECT * FROM blog_posts WHERE slug = $1 LIMIT 1', [slug]);
    return result.rows[0] ? mapBlogPostRow(result.rows[0]) : null;
  });
}

export async function upsertBlogPostInDatabase(post: BlogPost): Promise<StoreAvailability<BlogPost>> {
  return withBlogDb(async (client) => {
    await client.query(
      `INSERT INTO blog_posts (
        id, slug, title, excerpt, category, tags, cover_image_url, cover_image_alt,
        author, intro, sections, outro, read_time_minutes, featured, status,
        interaction, seo, governance, created_at, updated_at, published_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
        $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15,
        $16::jsonb, $17::jsonb, $18::jsonb, $19::timestamptz, $20::timestamptz, $21::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        excerpt = EXCLUDED.excerpt,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        cover_image_url = EXCLUDED.cover_image_url,
        cover_image_alt = EXCLUDED.cover_image_alt,
        author = EXCLUDED.author,
        intro = EXCLUDED.intro,
        sections = EXCLUDED.sections,
        outro = EXCLUDED.outro,
        read_time_minutes = EXCLUDED.read_time_minutes,
        featured = EXCLUDED.featured,
        status = EXCLUDED.status,
        interaction = EXCLUDED.interaction,
        seo = EXCLUDED.seo,
        governance = EXCLUDED.governance,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        published_at = EXCLUDED.published_at`,
      [
        post.id,
        post.slug,
        post.title,
        post.excerpt,
        post.category,
        JSON.stringify(post.tags),
        post.coverImageUrl,
        post.coverImageAlt,
        JSON.stringify(post.author),
        post.intro,
        JSON.stringify(post.sections),
        post.outro,
        post.readTimeMinutes,
        post.featured,
        post.status,
        JSON.stringify(post.interaction),
        JSON.stringify(post.seo),
        JSON.stringify(post.governance),
        post.createdAt,
        post.updatedAt,
        post.publishedAt || null,
      ],
    );

    return post;
  });
}

export async function listPublishedBlogPostsFromDatabase(): Promise<StoreAvailability<BlogPostListItem[]>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogPostRow>(
      `SELECT * FROM blog_posts
       WHERE status = 'published'
       ORDER BY featured DESC, COALESCE(published_at, updated_at) DESC`,
    );
    return result.rows.map((row) => toListItem(mapBlogPostRow(row)));
  });
}

export async function getPublishedBlogPostBySlugFromDatabase(slug: string): Promise<StoreAvailability<BlogPublishedPost | null>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogPostRow>(
      `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug],
    );

    if (!result.rows[0]) return null;
    return {
      ...mapBlogPostRow(result.rows[0]),
      canonicalPath: `/e-commerce/blog/${slug}`,
    };
  });
}

export async function listBlogCommentsFromDatabase(
  slug: string,
  options?: { publicOnly?: boolean },
): Promise<StoreAvailability<BlogComment[]>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogCommentRow>(
      `SELECT * FROM blog_comments
       WHERE post_slug = $1
         AND ($2::boolean = FALSE OR status = 'approved')
       ORDER BY created_at DESC`,
      [slug, Boolean(options?.publicOnly)],
    );
    return result.rows.map(mapBlogCommentRow);
  });
}

export async function replaceBlogCommentsInDatabase(
  postId: string,
  slug: string,
  comments: BlogComment[],
): Promise<StoreAvailability<void>> {
  return withBlogDb(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM blog_comments WHERE post_id = $1', [postId]);

      for (const comment of comments) {
        await client.query(
          `INSERT INTO blog_comments (
            id, post_id, post_slug, author_name, content, status,
            created_at, updated_at, moderated_at, moderation_note, fingerprint_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10, $11)`,
          [
            comment.id,
            postId,
            slug,
            comment.authorName,
            comment.content,
            comment.status,
            comment.createdAt,
            comment.updatedAt,
            comment.moderatedAt || null,
            comment.moderationNote || null,
            comment.fingerprintHash,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function listReactionEntriesFromDatabase(slug: string): Promise<StoreAvailability<BlogReactionEntry[]>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogReactionRow>(
      `SELECT fingerprint_hash, value, updated_at FROM blog_reactions WHERE post_slug = $1`,
      [slug],
    );

    return result.rows.map((row) => ({
      fingerprintHash: row.fingerprint_hash,
      value: row.value,
      updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    }));
  });
}

export async function getBlogReactionSummaryFromDatabase(
  slug: string,
  fingerprintHash?: string,
): Promise<StoreAvailability<BlogReactionSummary>> {
  return withBlogDb(async (client) => {
    const result = await client.query<BlogReactionRow>(
      `SELECT fingerprint_hash, value, updated_at FROM blog_reactions WHERE post_slug = $1`,
      [slug],
    );

    return mapReactionRows(result.rows, fingerprintHash);
  });
}

export async function replaceBlogReactionsInDatabase(
  postId: string,
  slug: string,
  entries: BlogReactionEntry[],
): Promise<StoreAvailability<void>> {
  return withBlogDb(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM blog_reactions WHERE post_id = $1', [postId]);

      for (const entry of entries) {
        await client.query(
          `INSERT INTO blog_reactions (post_id, post_slug, fingerprint_hash, value, updated_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz)`,
          [postId, slug, entry.fingerprintHash, entry.value, entry.updatedAt],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
