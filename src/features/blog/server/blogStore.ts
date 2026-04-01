import 'server-only';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { nowIso, randomToken } from '@/features/ecommpanel/server/crypto';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import {
  sanitizeImageUrl,
  sanitizeMultilineText as sanitizeSafeMultilineText,
  sanitizeSingleLineText,
} from '@/utils/inputSecurity';
import type {
  BlogComment,
  BlogCommentStatus,
  BlogContentSection,
  BlogPost,
  BlogPostListItem,
  BlogPostStatus,
  BlogPublishedPost,
  BlogReactionEntry,
  BlogReactionSummary,
  BlogReactionValue,
} from '../types';
import { normalizeBlogSlug } from '../slug';
import {
  countBlogPostsInDatabase,
  getBlogPostByIdFromDatabase,
  getBlogPostBySlugFromDatabase,
  getPublishedBlogPostBySlugFromDatabase,
  getBlogReactionSummaryFromDatabase,
  listBlogCommentsFromDatabase,
  listBlogPostsFromDatabase,
  listPublishedBlogPostsFromDatabase,
  listReactionEntriesFromDatabase,
  replaceBlogCommentsInDatabase,
  replaceBlogReactionsInDatabase,
  upsertBlogPostInDatabase,
} from './blogDatabaseStore';

const BLOG_RUNTIME_SCHEMA_VERSION = 1;
const ADMIN_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/blog');
const ADMIN_POSTS_DIR = path.join(ADMIN_ROOT, 'posts');
const ADMIN_INDEX_FILE = path.join(ADMIN_ROOT, 'posts-index.json');
const RUNTIME_INDEX_FILE_NAME = 'posts-index.published.json';
const RUNTIME_MANIFEST_FILE_NAME = 'manifest.json';

type PersistedAdminIndex = {
  schemaVersion: number;
  updatedAt: string;
  posts: BlogPostListItem[];
};

type PersistedRuntimeIndex = {
  schemaVersion: number;
  generatedAt: string;
  posts: BlogPostListItem[];
};

type PersistedRuntimeManifest = {
  schemaVersion: number;
  generatedAt: string;
  source: 'blog';
  postsCount: number;
  snapshotFile: string;
  checksumSha256: string;
};

type PersistedCommentsDocument = {
  postSlug: string;
  comments: BlogComment[];
};

type PersistedReactionsDocument = {
  postSlug: string;
  entries: BlogReactionEntry[];
};

type BlogPersistenceMode = 'files' | 'hybrid' | 'database';

declare global {
  var __BLOG_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

type CreateBlogPostInput = {
  title: string;
  slug: string;
  category?: string;
  excerpt?: string;
  authorName?: string;
  actor?: {
    userId?: string;
    name?: string;
  };
};

type UpdateBlogPostInput = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  coverImageAlt: string;
  intro: string;
  sections: BlogContentSection[];
  outro: string;
  readTimeMinutes: number;
  featured: boolean;
  author: BlogPost['author'];
  interaction: BlogPost['interaction'];
  seo: BlogPost['seo'];
  governance?: {
    ownerUserId?: string;
    ownerName?: string;
  };
  actor?: {
    userId?: string;
    name?: string;
  };
};

type CreateBlogCommentInput = {
  authorName: string;
  content: string;
};

type SetBlogReactionInput = {
  value: BlogReactionValue | 'clear';
  fingerprintHash: string;
};

export type BlogOperationalSummary = {
  totalPosts: number;
  draftPosts: number;
  publishedPosts: number;
  archivedPosts: number;
  featuredPosts: number;
  pendingComments: number;
  approvedComments: number;
  rejectedComments: number;
  latestPublishedAt?: string;
  latestPublishedTitle?: string;
  owners: Array<{
    ownerName: string;
    posts: number;
  }>;
};

function getRuntimeRoot(): string {
  const envPath = process.env.ECOM_CONTENT_PATH?.trim();
  const base = envPath ? path.resolve(envPath) : path.join(process.cwd(), 'src/data/site-runtime');
  return path.join(base, 'blog');
}

function getRuntimePostsDir(): string {
  return path.join(getRuntimeRoot(), 'posts');
}

function getRuntimeCommentsDir(): string {
  return path.join(getRuntimeRoot(), 'comments');
}

function getRuntimeReactionsDir(): string {
  return path.join(getRuntimeRoot(), 'reactions');
}

function getRuntimeIndexPath(): string {
  return path.join(getRuntimeRoot(), RUNTIME_INDEX_FILE_NAME);
}

function getRuntimeManifestPath(): string {
  return path.join(getRuntimeRoot(), RUNTIME_MANIFEST_FILE_NAME);
}

function getAdminPostPath(postId: string): string {
  return path.join(ADMIN_POSTS_DIR, `${postId}.json`);
}

function getRuntimePostPath(slug: string): string {
  return path.join(getRuntimePostsDir(), `${slug}.published.json`);
}

function getCommentsPath(slug: string): string {
  return path.join(getRuntimeCommentsDir(), `${slug}.json`);
}

function getReactionsPath(slug: string): string {
  return path.join(getRuntimeReactionsDir(), `${slug}.json`);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function removeFileIfExists(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  fs.unlinkSync(filePath);
}

function ensureAdminDirs(): void {
  fs.mkdirSync(ADMIN_POSTS_DIR, { recursive: true });
}

function ensureRuntimeDirs(): void {
  fs.mkdirSync(getRuntimePostsDir(), { recursive: true });
  fs.mkdirSync(getRuntimeCommentsDir(), { recursive: true });
  fs.mkdirSync(getRuntimeReactionsDir(), { recursive: true });
}

function sanitizeLine(value: string): string {
  return sanitizeSingleLineText(value);
}

function sanitizeMultilineText(value: string): string {
  return sanitizeSafeMultilineText(value);
}

function sanitizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => sanitizeLine(tag).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function createDefaultSeo(input: { title: string; excerpt: string }): BlogPost['seo'] {
  return {
    title: input.title,
    description: input.excerpt,
    keywords: '',
    noIndex: true,
  };
}

function createDefaultInteraction(): BlogPost['interaction'] {
  return {
    commentsEnabled: true,
    commentsRequireModeration: true,
    reactionsEnabled: true,
    bookmarksEnabled: true,
    shareEnabled: true,
  };
}

function createDefaultAuthor(name?: string): BlogPost['author'] {
  return {
    name: sanitizeLine(name || 'Equipe de Conteúdo'),
    role: 'Editorial',
    avatarUrl: '',
  };
}

function normalizeUserId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createDefaultGovernance(actor?: { userId?: string; name?: string }, authorName?: string): BlogPost['governance'] {
  const fallbackName = sanitizeLine(actor?.name || authorName || 'Equipe Editorial');

  return {
    ownerUserId: normalizeUserId(actor?.userId),
    ownerName: fallbackName,
    lastEditedByUserId: normalizeUserId(actor?.userId),
    lastEditedByName: fallbackName,
  };
}

function normalizeGovernance(
  governance: Partial<BlogPost['governance']> | undefined,
  authorName?: string,
): BlogPost['governance'] {
  const fallbackName = sanitizeLine(governance?.ownerName || governance?.lastEditedByName || authorName || 'Equipe Editorial');
  const publishedByName = sanitizeLine(governance?.publishedByName || '');

  return {
    ownerUserId: normalizeUserId(governance?.ownerUserId),
    ownerName: sanitizeLine(governance?.ownerName || fallbackName),
    lastEditedByUserId: normalizeUserId(governance?.lastEditedByUserId || governance?.ownerUserId),
    lastEditedByName: sanitizeLine(governance?.lastEditedByName || governance?.ownerName || fallbackName),
    publishedByUserId: normalizeUserId(governance?.publishedByUserId),
    publishedByName: publishedByName || undefined,
  };
}

function hydrateBlogPost(post: BlogPost): BlogPost {
  const fallbackAuthor = createDefaultAuthor(post.author?.name);

  return {
    ...post,
    author: {
      name: sanitizeLine(post.author?.name || fallbackAuthor.name),
      role: sanitizeLine(post.author?.role || fallbackAuthor.role),
      avatarUrl: sanitizeImageUrl(post.author?.avatarUrl, ''),
    },
    interaction: post.interaction || createDefaultInteraction(),
    seo: post.seo || createDefaultSeo({ title: post.title, excerpt: post.excerpt }),
    governance: normalizeGovernance(post.governance, post.author?.name),
    sections: Array.isArray(post.sections) && post.sections.length ? post.sections : [createDefaultSection()],
  };
}

function hydrateListItem(item: BlogPostListItem): BlogPostListItem {
  return {
    ...item,
    ownerUserId: normalizeUserId(item.ownerUserId),
    ownerName: sanitizeLine(item.ownerName || item.authorName || 'Equipe Editorial'),
    publishedByName: sanitizeLine(item.publishedByName || '') || undefined,
  };
}

function createDefaultSection(): BlogContentSection {
  return {
    id: `section-${randomToken(4)}`,
    eyebrow: 'Contexto',
    title: 'Novo bloco de conteúdo',
    body: 'Escreva aqui o conteúdo principal desta seção.',
    imageUrl: '',
    imageAlt: '',
    caption: '',
  };
}

function sortAdminPosts(posts: BlogPostListItem[]): BlogPostListItem[] {
  return [...posts].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

function sortPublishedPosts(posts: BlogPostListItem[]): BlogPostListItem[] {
  return [...posts].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    const leftTime = new Date(left.publishedAt || left.updatedAt).getTime();
    const rightTime = new Date(right.publishedAt || right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

function toListItem(post: BlogPost): BlogPostListItem {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    coverImageUrl: sanitizeImageUrl(post.coverImageUrl, ''),
    coverImageAlt: sanitizeLine(post.coverImageAlt),
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

function toPublishedPost(post: BlogPost): BlogPublishedPost {
  return {
    ...post,
    canonicalPath: `/e-commerce/blog/${post.slug}`,
  };
}

function readAdminIndex(): PersistedAdminIndex {
  ensureAdminDirs();
  const stored = readJsonFile<PersistedAdminIndex>(ADMIN_INDEX_FILE);
  if (stored?.posts) {
    return {
      schemaVersion: stored.schemaVersion || BLOG_RUNTIME_SCHEMA_VERSION,
      updatedAt: stored.updatedAt || nowIso(),
      posts: sortAdminPosts(stored.posts.map(hydrateListItem)),
    };
  }

  const empty: PersistedAdminIndex = {
    schemaVersion: BLOG_RUNTIME_SCHEMA_VERSION,
    updatedAt: nowIso(),
    posts: [],
  };
  writeJsonAtomic(ADMIN_INDEX_FILE, empty);
  return empty;
}

function writeAdminIndex(posts: BlogPostListItem[]): PersistedAdminIndex {
  const payload: PersistedAdminIndex = {
    schemaVersion: BLOG_RUNTIME_SCHEMA_VERSION,
    updatedAt: nowIso(),
    posts: sortAdminPosts(posts),
  };
  writeJsonAtomic(ADMIN_INDEX_FILE, payload);
  return payload;
}

function writeAdminPost(post: BlogPost): BlogPost {
  ensureAdminDirs();
  const hydrated = hydrateBlogPost(post);
  writeJsonAtomic(getAdminPostPath(hydrated.id), hydrated);
  const index = readAdminIndex();
  const next = index.posts.filter((item) => item.id !== hydrated.id);
  next.push(toListItem(hydrated));
  writeAdminIndex(next);
  return hydrated;
}

function readAdminPostByListItem(item: BlogPostListItem): BlogPost | null {
  const post = readJsonFile<BlogPost>(getAdminPostPath(item.id));
  return post ? hydrateBlogPost(post) : null;
}

function listAllAdminPosts(): BlogPost[] {
  const index = readAdminIndex();
  return index.posts
    .map((item) => readAdminPostByListItem(item))
    .filter((post): post is BlogPost => Boolean(post))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function migratePostInteractions(previousSlug: string, nextSlug: string): void {
  if (!previousSlug || previousSlug === nextSlug) return;

  ensureRuntimeDirs();

  const previousCommentsPath = getCommentsPath(previousSlug);
  const nextCommentsPath = getCommentsPath(nextSlug);
  const commentsDocument = readJsonFile<PersistedCommentsDocument>(previousCommentsPath);
  if (commentsDocument) {
    const migrated: PersistedCommentsDocument = {
      postSlug: nextSlug,
      comments: commentsDocument.comments.map((comment) => ({
        ...comment,
        postSlug: nextSlug,
        updatedAt: nowIso(),
      })),
    };
    writeJsonAtomic(nextCommentsPath, migrated);
    removeFileIfExists(previousCommentsPath);
  }

  const previousReactionsPath = getReactionsPath(previousSlug);
  const nextReactionsPath = getReactionsPath(nextSlug);
  const reactionsDocument = readJsonFile<PersistedReactionsDocument>(previousReactionsPath);
  if (reactionsDocument) {
    const migrated: PersistedReactionsDocument = {
      postSlug: nextSlug,
      entries: reactionsDocument.entries,
    };
    writeJsonAtomic(nextReactionsPath, migrated);
    removeFileIfExists(previousReactionsPath);
  }
}

function syncPublishedRuntimeSnapshot(): void {
  ensureRuntimeDirs();

  const publishedPosts = listAllAdminPosts().filter((post) => post.status === 'published');
  const runtimeIndex: PersistedRuntimeIndex = {
    schemaVersion: BLOG_RUNTIME_SCHEMA_VERSION,
    generatedAt: nowIso(),
    posts: sortPublishedPosts(publishedPosts.map((post) => toListItem(post))),
  };

  const activeFileNames = new Set<string>();
  for (const post of publishedPosts) {
    const filePath = getRuntimePostPath(post.slug);
    activeFileNames.add(path.basename(filePath));
    writeJsonAtomic(filePath, toPublishedPost(post));
  }

  if (fs.existsSync(getRuntimePostsDir())) {
    for (const entry of fs.readdirSync(getRuntimePostsDir())) {
      if (!activeFileNames.has(entry)) {
        removeFileIfExists(path.join(getRuntimePostsDir(), entry));
      }
    }
  }

  writeJsonAtomic(getRuntimeIndexPath(), runtimeIndex);

  const raw = JSON.stringify(runtimeIndex);
  const manifest: PersistedRuntimeManifest = {
    schemaVersion: BLOG_RUNTIME_SCHEMA_VERSION,
    generatedAt: runtimeIndex.generatedAt,
    source: 'blog',
    postsCount: runtimeIndex.posts.length,
    snapshotFile: RUNTIME_INDEX_FILE_NAME,
    checksumSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  };

  writeJsonAtomic(getRuntimeManifestPath(), manifest);
}

function readRuntimeComments(slug: string): PersistedCommentsDocument {
  ensureRuntimeDirs();
  const stored = readJsonFile<PersistedCommentsDocument>(getCommentsPath(slug));
  return {
    postSlug: slug,
    comments: stored?.comments || [],
  };
}

function writeRuntimeComments(slug: string, comments: BlogComment[]): PersistedCommentsDocument {
  const payload: PersistedCommentsDocument = {
    postSlug: slug,
    comments,
  };
  writeJsonAtomic(getCommentsPath(slug), payload);
  return payload;
}

function readRuntimeReactions(slug: string): PersistedReactionsDocument {
  ensureRuntimeDirs();
  const stored = readJsonFile<PersistedReactionsDocument>(getReactionsPath(slug));
  return {
    postSlug: slug,
    entries: stored?.entries || [],
  };
}

function writeRuntimeReactions(slug: string, entries: BlogReactionEntry[]): PersistedReactionsDocument {
  const payload: PersistedReactionsDocument = {
    postSlug: slug,
    entries,
  };
  writeJsonAtomic(getReactionsPath(slug), payload);
  return payload;
}

function summarizeReactions(entries: BlogReactionEntry[], fingerprintHash?: string): BlogReactionSummary {
  const likes = entries.filter((entry) => entry.value === 'like').length;
  const dislikes = entries.filter((entry) => entry.value === 'dislike').length;
  const userReaction = fingerprintHash
    ? entries.find((entry) => entry.fingerprintHash === fingerprintHash)?.value || null
    : null;

  return {
    likes,
    dislikes,
    userReaction,
  };
}

function getBlogPersistenceMode(): BlogPersistenceMode {
  const value = process.env.ECOM_BLOG_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Blog em modo database exige PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

async function seedBlogDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getBlogPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__BLOG_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__BLOG_DB_FILE_SEEDED_KEYS__ = seededKeys;
  if (seededKeys.has(runtime.key)) return;

  const count = await countBlogPostsInDatabase();
  if (!count.available) return;

  if (count.value > 0) {
    seededKeys.add(runtime.key);
    return;
  }

  const posts = listAllAdminPosts();
  for (const post of posts) {
    await upsertBlogPostInDatabase(post);
    await replaceBlogCommentsInDatabase(post.id, post.slug, readRuntimeComments(post.slug).comments);
    await replaceBlogReactionsInDatabase(post.id, post.slug, readRuntimeReactions(post.slug).entries);
  }

  seededKeys.add(runtime.key);
}

async function syncBlogPostToDatabase(post: BlogPost | null): Promise<void> {
  if (!post) return;
  await seedBlogDatabaseFromFilesIfNeeded();
  await upsertBlogPostInDatabase(post);
}

async function syncBlogInteractionsToDatabase(post: BlogPost | null): Promise<void> {
  if (!post) return;
  await seedBlogDatabaseFromFilesIfNeeded();
  await replaceBlogCommentsInDatabase(post.id, post.slug, readRuntimeComments(post.slug).comments);
  await replaceBlogReactionsInDatabase(post.id, post.slug, readRuntimeReactions(post.slug).entries);
}

function buildBlogManifestFromList(posts: BlogPostListItem[]): PersistedRuntimeManifest | null {
  if (!posts.length) return null;

  const generatedAt =
    [...posts]
      .map((post) => post.publishedAt || post.updatedAt || post.createdAt)
      .sort()
      .at(-1) || nowIso();
  const raw = JSON.stringify(posts);

  return {
    schemaVersion: BLOG_RUNTIME_SCHEMA_VERSION,
    generatedAt,
    source: 'blog',
    postsCount: posts.length,
    snapshotFile: RUNTIME_INDEX_FILE_NAME,
    checksumSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

export function listBlogPosts(): BlogPostListItem[] {
  return readAdminIndex().posts;
}

export function getBlogPostById(postId: string): BlogPost | null {
  if (!postId) return null;
  const post = readJsonFile<BlogPost>(getAdminPostPath(postId));
  return post ? hydrateBlogPost(post) : null;
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return null;

  const item = readAdminIndex().posts.find((post) => post.slug === safeSlug);
  return item ? getBlogPostById(item.id) : null;
}

export function createBlogPost(input: CreateBlogPostInput): BlogPost {
  return writeAdminPost(buildNewBlogPost(input));
}

function buildNewBlogPost(input: CreateBlogPostInput): BlogPost {
  const title = sanitizeLine(input.title);
  const slug = normalizeBlogSlug(input.slug);
  const excerpt = sanitizeLine(input.excerpt || 'Resumo editorial da publicação.');
  const createdAt = nowIso();
  const governance = createDefaultGovernance(input.actor, input.authorName);

  const post: BlogPost = {
    id: `post-${randomToken(5)}`,
    slug,
    title,
    excerpt,
    category: sanitizeLine(input.category || 'Editorial'),
    tags: [],
    coverImageUrl: '',
    coverImageAlt: '',
    author: createDefaultAuthor(input.authorName),
    intro: 'Introduza aqui o contexto principal do post.',
    sections: [createDefaultSection()],
    outro: 'Feche o texto com próximos passos, recomendações ou CTA.',
    readTimeMinutes: 4,
    featured: false,
    status: 'draft',
    interaction: createDefaultInteraction(),
    seo: createDefaultSeo({ title, excerpt }),
    governance,
    createdAt,
    updatedAt: createdAt,
  };

  return post;
}

function buildUpdatedBlogPost(current: BlogPost, input: UpdateBlogPostInput): BlogPost {
  const nextSlug = normalizeBlogSlug(input.slug);
  const updatedAt = nowIso();
  const nextOwnerUserId =
    input.governance && Object.prototype.hasOwnProperty.call(input.governance, 'ownerUserId')
      ? normalizeUserId(input.governance.ownerUserId)
      : current.governance.ownerUserId;
  const nextOwnerName =
    input.governance && Object.prototype.hasOwnProperty.call(input.governance, 'ownerName')
      ? sanitizeLine(input.governance.ownerName || input.author.name || current.governance.ownerName)
      : current.governance.ownerName;

  return {
    ...current,
    slug: nextSlug,
    title: sanitizeLine(input.title),
    excerpt: sanitizeLine(input.excerpt),
    category: sanitizeLine(input.category),
    tags: sanitizeTags(input.tags),
    coverImageUrl: sanitizeImageUrl(input.coverImageUrl, ''),
    coverImageAlt: sanitizeLine(input.coverImageAlt),
    intro: sanitizeMultilineText(input.intro),
    sections: input.sections.map((section) => ({
      id: section.id || `section-${randomToken(4)}`,
      eyebrow: sanitizeLine(section.eyebrow),
      title: sanitizeLine(section.title),
      body: sanitizeMultilineText(section.body),
      imageUrl: sanitizeImageUrl(section.imageUrl, ''),
      imageAlt: sanitizeLine(section.imageAlt),
      caption: sanitizeLine(section.caption),
    })),
    outro: sanitizeMultilineText(input.outro),
    readTimeMinutes: Math.max(1, Math.min(60, Math.floor(input.readTimeMinutes || current.readTimeMinutes || 1))),
    featured: Boolean(input.featured),
    author: {
      name: sanitizeLine(input.author.name),
      role: sanitizeLine(input.author.role),
      avatarUrl: sanitizeImageUrl(input.author.avatarUrl, ''),
    },
    interaction: {
      commentsEnabled: Boolean(input.interaction.commentsEnabled),
      commentsRequireModeration: Boolean(input.interaction.commentsRequireModeration),
      reactionsEnabled: Boolean(input.interaction.reactionsEnabled),
      bookmarksEnabled: Boolean(input.interaction.bookmarksEnabled),
      shareEnabled: Boolean(input.interaction.shareEnabled),
    },
    seo: {
      title: sanitizeLine(input.seo.title),
      description: sanitizeLine(input.seo.description),
      keywords: sanitizeLine(input.seo.keywords),
      noIndex: Boolean(input.seo.noIndex),
    },
    governance: {
      ...current.governance,
      ownerUserId: nextOwnerUserId,
      ownerName: nextOwnerName,
      lastEditedByUserId: normalizeUserId(input.actor?.userId) || current.governance.lastEditedByUserId,
      lastEditedByName: sanitizeLine(input.actor?.name || current.governance.lastEditedByName || nextOwnerName),
    },
    updatedAt,
  };
}

export function updateBlogPost(postId: string, input: UpdateBlogPostInput): BlogPost | null {
  const current = getBlogPostById(postId);
  if (!current) return null;

  const next = buildUpdatedBlogPost(current, input);

  migratePostInteractions(current.slug, next.slug);
  writeAdminPost(next);
  syncPublishedRuntimeSnapshot();
  return next;
}

function buildStatusChangedBlogPost(
  current: BlogPost,
  status: BlogPostStatus,
  actor?: {
    userId?: string;
    name?: string;
  },
): BlogPost {
  const updatedAt = nowIso();

  return {
    ...current,
    status,
    updatedAt,
    publishedAt: status === 'published' ? current.publishedAt || updatedAt : current.publishedAt,
    seo: {
      ...current.seo,
      noIndex: status === 'published' ? false : true,
    },
    governance: {
      ...current.governance,
      lastEditedByUserId: normalizeUserId(actor?.userId) || current.governance.lastEditedByUserId,
      lastEditedByName: sanitizeLine(actor?.name || current.governance.lastEditedByName || current.governance.ownerName),
      publishedByUserId: status === 'published' ? normalizeUserId(actor?.userId) || current.governance.publishedByUserId : current.governance.publishedByUserId,
      publishedByName:
        status === 'published'
          ? sanitizeLine(actor?.name || current.governance.publishedByName || current.governance.lastEditedByName || current.governance.ownerName) ||
            current.governance.publishedByName
          : current.governance.publishedByName,
    },
  };
}

export function setBlogPostStatus(
  postId: string,
  status: BlogPostStatus,
  actor?: {
    userId?: string;
    name?: string;
  },
): BlogPost | null {
  const current = getBlogPostById(postId);
  if (!current) return null;

  const next = buildStatusChangedBlogPost(current, status, actor);

  writeAdminPost(next);
  syncPublishedRuntimeSnapshot();
  return next;
}

export function listPublishedBlogPosts(): BlogPostListItem[] {
  const stored = readJsonFile<PersistedRuntimeIndex>(getRuntimeIndexPath());
  return sortPublishedPosts((stored?.posts || []).map(hydrateListItem));
}

export function getPublishedBlogPostBySlug(slug: string): BlogPublishedPost | null {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return null;
  const post = readJsonFile<BlogPublishedPost>(getRuntimePostPath(safeSlug));
  return post ? ({ ...hydrateBlogPost(post), canonicalPath: `/e-commerce/blog/${safeSlug}` } as BlogPublishedPost) : null;
}

export function listPublicBlogComments(slug: string): BlogComment[] {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return [];
  const comments = readRuntimeComments(safeSlug).comments;
  return comments
    .filter((comment) => comment.status === 'approved')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function listAdminBlogComments(postId: string): BlogComment[] {
  const post = getBlogPostById(postId);
  if (!post) return [];

  return readRuntimeComments(post.slug).comments.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function createBlogComment(slug: string, input: CreateBlogCommentInput, fingerprintHash: string): {
  comment: BlogComment;
  visibility: 'pending' | 'approved';
} | null {
  const post = getPublishedBlogPostBySlug(slug);
  if (!post || !post.interaction.commentsEnabled) return null;

  const authorName = sanitizeLine(input.authorName).slice(0, 60);
  const content = sanitizeMultilineText(input.content).slice(0, 2000);
  if (!authorName || !content) return null;

  const status: BlogCommentStatus = post.interaction.commentsRequireModeration ? 'pending' : 'approved';
  const createdAt = nowIso();
  const comment: BlogComment = {
    id: `comment-${randomToken(5)}`,
    postSlug: post.slug,
    authorName,
    content,
    status,
    createdAt,
    updatedAt: createdAt,
    fingerprintHash,
  };

  const document = readRuntimeComments(post.slug);
  document.comments.unshift(comment);
  writeRuntimeComments(post.slug, document.comments);

  return {
    comment,
    visibility: status === 'approved' ? 'approved' : 'pending',
  };
}

function buildModeratedComment(
  comment: BlogComment,
  status: Extract<BlogCommentStatus, 'approved' | 'rejected'>,
  note?: string,
): BlogComment {
  return {
    ...comment,
    status,
    moderationNote: sanitizeLine(note || ''),
    moderatedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function moderateBlogComment(postId: string, commentId: string, status: Extract<BlogCommentStatus, 'approved' | 'rejected'>, note?: string): BlogComment | null {
  const post = getBlogPostById(postId);
  if (!post) return null;

  const document = readRuntimeComments(post.slug);
  const index = document.comments.findIndex((comment) => comment.id === commentId);
  if (index < 0) return null;

  const updated = buildModeratedComment(document.comments[index], status, note);

  document.comments[index] = updated;
  writeRuntimeComments(post.slug, document.comments);
  return updated;
}

export function getBlogReactionSummary(slug: string, fingerprintHash?: string): BlogReactionSummary {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) {
    return { likes: 0, dislikes: 0, userReaction: null };
  }

  const document = readRuntimeReactions(safeSlug);
  return summarizeReactions(document.entries, fingerprintHash);
}

export function setBlogReaction(slug: string, input: SetBlogReactionInput): BlogReactionSummary | null {
  const post = getPublishedBlogPostBySlug(slug);
  if (!post || !post.interaction.reactionsEnabled) return null;

  const fingerprintHash = input.fingerprintHash.trim();
  if (!fingerprintHash) return null;

  const document = readRuntimeReactions(post.slug);
  document.entries = applyReactionUpdate(document.entries, input);

  writeRuntimeReactions(post.slug, document.entries);
  return summarizeReactions(document.entries, fingerprintHash);
}

function applyReactionUpdate(entries: BlogReactionEntry[], input: SetBlogReactionInput): BlogReactionEntry[] {
  const next = [...entries];
  const fingerprintHash = input.fingerprintHash.trim();
  const existingIndex = next.findIndex((entry) => entry.fingerprintHash === fingerprintHash);

  if (input.value === 'clear') {
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    }
    return next;
  }

  if (existingIndex >= 0) {
    next[existingIndex] = {
      fingerprintHash,
      value: input.value,
      updatedAt: nowIso(),
    };
    return next;
  }

  next.push({
    fingerprintHash,
    value: input.value,
    updatedAt: nowIso(),
  });
  return next;
}

export function readBlogRuntimeManifest(): PersistedRuntimeManifest | null {
  return readJsonFile<PersistedRuntimeManifest>(getRuntimeManifestPath());
}

export function getBlogOperationalSummary(): BlogOperationalSummary {
  const posts = listAllAdminPosts();
  const ownerCounts = new Map<string, number>();
  let pendingComments = 0;
  let approvedComments = 0;
  let rejectedComments = 0;

  for (const post of posts) {
    const ownerName = post.governance.ownerName || post.author.name || 'Equipe Editorial';
    ownerCounts.set(ownerName, (ownerCounts.get(ownerName) || 0) + 1);

    const comments = readRuntimeComments(post.slug).comments;
    for (const comment of comments) {
      if (comment.status === 'pending') pendingComments += 1;
      if (comment.status === 'approved') approvedComments += 1;
      if (comment.status === 'rejected') rejectedComments += 1;
    }
  }

  const latestPublished = [...posts]
    .filter((post) => post.status === 'published' && post.publishedAt)
    .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())[0];

  return {
    totalPosts: posts.length,
    draftPosts: posts.filter((post) => post.status === 'draft').length,
    publishedPosts: posts.filter((post) => post.status === 'published').length,
    archivedPosts: posts.filter((post) => post.status === 'archived').length,
    featuredPosts: posts.filter((post) => post.featured).length,
    pendingComments,
    approvedComments,
    rejectedComments,
    latestPublishedAt: latestPublished?.publishedAt,
    latestPublishedTitle: latestPublished?.title,
    owners: Array.from(ownerCounts.entries())
      .map(([ownerName, ownerPosts]) => ({ ownerName, posts: ownerPosts }))
      .sort((left, right) => right.posts - left.posts)
      .slice(0, 5),
  };
}

export async function listBlogPostsRuntime(): Promise<BlogPostListItem[]> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return listBlogPosts();

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await listBlogPostsFromDatabase();
  if (mode === 'database') return requireDatabaseValue(result, 'listar posts do blog');
  return result.available ? result.value : listBlogPosts();
}

export async function getBlogPostByIdRuntime(postId: string): Promise<BlogPost | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return getBlogPostById(postId);

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await getBlogPostByIdFromDatabase(postId);
  if (mode === 'database') return requireDatabaseValue(result, 'ler post do blog por id');
  return result.available ? result.value : getBlogPostById(postId);
}

export async function getBlogPostBySlugRuntime(slug: string): Promise<BlogPost | null> {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return null;

  const mode = getBlogPersistenceMode();
  if (mode === 'files') return getBlogPostBySlug(safeSlug);

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await getBlogPostBySlugFromDatabase(safeSlug);
  if (mode === 'database') return requireDatabaseValue(result, 'ler post do blog por slug');
  return result.available ? result.value : getBlogPostBySlug(safeSlug);
}

export async function createBlogPostRuntime(input: CreateBlogPostInput): Promise<BlogPost> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return createBlogPost(input);

  if (mode === 'database') {
    const post = buildNewBlogPost(input);
    const result = await upsertBlogPostInDatabase(post);
    return requireDatabaseValue(result, 'criar post do blog');
  }

  const post = createBlogPost(input);
  await syncBlogPostToDatabase(post);
  return post;
}

export async function updateBlogPostRuntime(postId: string, input: UpdateBlogPostInput): Promise<BlogPost | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return updateBlogPost(postId, input);

  if (mode === 'database') {
    const currentResult = await getBlogPostByIdFromDatabase(postId);
    const current = requireDatabaseValue(currentResult, 'carregar post para atualizar');
    if (!current) return null;

    const next = buildUpdatedBlogPost(current, input);
    if (current.slug !== next.slug) {
      const commentsResult = await listBlogCommentsFromDatabase(current.slug, { publicOnly: false });
      if (commentsResult.available) {
        await replaceBlogCommentsInDatabase(next.id, next.slug, commentsResult.value.map((comment) => ({ ...comment, postSlug: next.slug })));
      }

      const reactionsResult = await listReactionEntriesFromDatabase(current.slug);
      if (reactionsResult.available) {
        await replaceBlogReactionsInDatabase(next.id, next.slug, reactionsResult.value);
      }
    }

    const saved = await upsertBlogPostInDatabase(next);
    return requireDatabaseValue(saved, 'atualizar post do blog');
  }

  const post = updateBlogPost(postId, input);
  await syncBlogPostToDatabase(post);
  await syncBlogInteractionsToDatabase(post);
  return post;
}

export async function setBlogPostStatusRuntime(
  postId: string,
  status: BlogPostStatus,
  actor?: {
    userId?: string;
    name?: string;
  },
): Promise<BlogPost | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return setBlogPostStatus(postId, status, actor);

  if (mode === 'database') {
    const currentResult = await getBlogPostByIdFromDatabase(postId);
    const current = requireDatabaseValue(currentResult, 'carregar post para alterar status');
    if (!current) return null;

    const next = buildStatusChangedBlogPost(current, status, actor);
    const saved = await upsertBlogPostInDatabase(next);
    return requireDatabaseValue(saved, 'alterar status do post do blog');
  }

  const post = setBlogPostStatus(postId, status, actor);
  await syncBlogPostToDatabase(post);
  return post;
}

export async function listPublishedBlogPostsRuntime(): Promise<BlogPostListItem[]> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return listPublishedBlogPosts();

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await listPublishedBlogPostsFromDatabase();
  if (mode === 'database') return requireDatabaseValue(result, 'listar posts publicados do blog');
  return result.available ? result.value : listPublishedBlogPosts();
}

export async function getPublishedBlogPostBySlugRuntime(slug: string): Promise<BlogPublishedPost | null> {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return null;

  const mode = getBlogPersistenceMode();
  if (mode === 'files') return getPublishedBlogPostBySlug(safeSlug);

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await getPublishedBlogPostBySlugFromDatabase(safeSlug);
  if (mode === 'database') return requireDatabaseValue(result, 'ler post publicado do blog');
  return result.available ? result.value : getPublishedBlogPostBySlug(safeSlug);
}

export async function listPublicBlogCommentsRuntime(slug: string): Promise<BlogComment[]> {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return [];

  const mode = getBlogPersistenceMode();
  if (mode === 'files') return listPublicBlogComments(safeSlug);

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await listBlogCommentsFromDatabase(safeSlug, { publicOnly: true });
  if (mode === 'database') return requireDatabaseValue(result, 'listar comentarios publicos do blog');
  return result.available ? result.value : listPublicBlogComments(safeSlug);
}

export async function listAdminBlogCommentsRuntime(postId: string): Promise<BlogComment[]> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return listAdminBlogComments(postId);

  const post = await getBlogPostByIdRuntime(postId);
  if (!post) return [];

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await listBlogCommentsFromDatabase(post.slug, { publicOnly: false });
  if (mode === 'database') return requireDatabaseValue(result, 'listar comentarios administrativos do blog');
  return result.available ? result.value : listAdminBlogComments(postId);
}

export async function createBlogCommentRuntime(
  slug: string,
  input: CreateBlogCommentInput,
  fingerprintHash: string,
): Promise<{
  comment: BlogComment;
  visibility: 'pending' | 'approved';
} | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return createBlogComment(slug, input, fingerprintHash);

  if (mode === 'database') {
    const postResult = await getPublishedBlogPostBySlugFromDatabase(normalizeBlogSlug(slug));
    const post = requireDatabaseValue(postResult, 'carregar post publicado para comentario');
    if (!post || !post.interaction.commentsEnabled) return null;

    const authorName = sanitizeLine(input.authorName).slice(0, 60);
    const content = sanitizeMultilineText(input.content).slice(0, 2000);
    if (!authorName || !content) return null;

    const status: BlogCommentStatus = post.interaction.commentsRequireModeration ? 'pending' : 'approved';
    const createdAt = nowIso();
    const comment: BlogComment = {
      id: `comment-${randomToken(5)}`,
      postSlug: post.slug,
      authorName,
      content,
      status,
      createdAt,
      updatedAt: createdAt,
      fingerprintHash,
    };

    const commentsResult = await listBlogCommentsFromDatabase(post.slug, { publicOnly: false });
    const comments = requireDatabaseValue(commentsResult, 'listar comentarios para incluir novo comentario');
    comments.unshift(comment);
    await requireDatabaseValue(await replaceBlogCommentsInDatabase(post.id, post.slug, comments), 'salvar comentario do blog');

    return {
      comment,
      visibility: status === 'approved' ? 'approved' : 'pending',
    };
  }

  const result = createBlogComment(slug, input, fingerprintHash);
  if (!result) return null;

  const post = getBlogPostBySlug(slug);
  await syncBlogInteractionsToDatabase(post);
  return result;
}

export async function moderateBlogCommentRuntime(
  postId: string,
  commentId: string,
  status: Extract<BlogCommentStatus, 'approved' | 'rejected'>,
  note?: string,
): Promise<BlogComment | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return moderateBlogComment(postId, commentId, status, note);

  if (mode === 'database') {
    const postResult = await getBlogPostByIdFromDatabase(postId);
    const post = requireDatabaseValue(postResult, 'carregar post para moderacao de comentario');
    if (!post) return null;

    const commentsResult = await listBlogCommentsFromDatabase(post.slug, { publicOnly: false });
    const comments = requireDatabaseValue(commentsResult, 'listar comentarios para moderacao');
    const index = comments.findIndex((comment) => comment.id === commentId);
    if (index < 0) return null;

    const updated = buildModeratedComment(comments[index], status, note);
    comments[index] = updated;
    await requireDatabaseValue(await replaceBlogCommentsInDatabase(post.id, post.slug, comments), 'salvar moderacao de comentario');
    return updated;
  }

  const comment = moderateBlogComment(postId, commentId, status, note);
  const post = getBlogPostById(postId);
  await syncBlogInteractionsToDatabase(post);
  return comment;
}

export async function getBlogReactionSummaryRuntime(slug: string, fingerprintHash?: string): Promise<BlogReactionSummary> {
  const safeSlug = normalizeBlogSlug(slug);
  if (!safeSlug) return { likes: 0, dislikes: 0, userReaction: null };

  const mode = getBlogPersistenceMode();
  if (mode === 'files') return getBlogReactionSummary(safeSlug, fingerprintHash);

  await seedBlogDatabaseFromFilesIfNeeded();
  const result = await getBlogReactionSummaryFromDatabase(safeSlug, fingerprintHash);
  if (mode === 'database') return requireDatabaseValue(result, 'ler reacoes do blog');
  return result.available ? result.value : getBlogReactionSummary(safeSlug, fingerprintHash);
}

export async function setBlogReactionRuntime(slug: string, input: SetBlogReactionInput): Promise<BlogReactionSummary | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return setBlogReaction(slug, input);

  if (mode === 'database') {
    const postResult = await getPublishedBlogPostBySlugFromDatabase(normalizeBlogSlug(slug));
    const post = requireDatabaseValue(postResult, 'carregar post para registrar reacao');
    if (!post || !post.interaction.reactionsEnabled) return null;

    const fingerprintHash = input.fingerprintHash.trim();
    if (!fingerprintHash) return null;

    const entriesResult = await listReactionEntriesFromDatabase(post.slug);
    const entries = requireDatabaseValue(entriesResult, 'listar reacoes do blog');
    const nextEntries = applyReactionUpdate(entries, input);
    await requireDatabaseValue(await replaceBlogReactionsInDatabase(post.id, post.slug, nextEntries), 'salvar reacoes do blog');
    return summarizeReactions(nextEntries, fingerprintHash);
  }

  const summary = setBlogReaction(slug, input);
  if (!summary) return null;

  const post = getBlogPostBySlug(slug);
  await syncBlogInteractionsToDatabase(post);
  return summary;
}

export async function readBlogRuntimeManifestRuntime(): Promise<PersistedRuntimeManifest | null> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return readBlogRuntimeManifest();

  await seedBlogDatabaseFromFilesIfNeeded();
  const posts = await listPublishedBlogPostsRuntime();
  const manifest = buildBlogManifestFromList(posts);
  if (mode === 'database') return manifest;
  return manifest || readBlogRuntimeManifest();
}

export async function getBlogOperationalSummaryRuntime(): Promise<BlogOperationalSummary> {
  const mode = getBlogPersistenceMode();
  if (mode === 'files') return getBlogOperationalSummary();

  await seedBlogDatabaseFromFilesIfNeeded();
  const dbPosts = await listBlogPostsFromDatabase();
  if (mode === 'database') {
    const posts = requireDatabaseValue(dbPosts, 'montar resumo operacional do blog');
    const ownerCounts = new Map<string, number>();
    let pendingComments = 0;
    let approvedComments = 0;
    let rejectedComments = 0;

    for (const post of posts) {
      const ownerName = post.ownerName || post.authorName || 'Equipe Editorial';
      ownerCounts.set(ownerName, (ownerCounts.get(ownerName) || 0) + 1);

      const comments = requireDatabaseValue(await listBlogCommentsFromDatabase(post.slug, { publicOnly: false }), 'carregar comentarios para resumo operacional');
      for (const comment of comments) {
        if (comment.status === 'pending') pendingComments += 1;
        if (comment.status === 'approved') approvedComments += 1;
        if (comment.status === 'rejected') rejectedComments += 1;
      }
    }

    const latestPublished = [...posts]
      .filter((post) => post.status === 'published' && post.publishedAt)
      .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())[0];

    return {
      totalPosts: posts.length,
      draftPosts: posts.filter((post) => post.status === 'draft').length,
      publishedPosts: posts.filter((post) => post.status === 'published').length,
      archivedPosts: posts.filter((post) => post.status === 'archived').length,
      featuredPosts: posts.filter((post) => post.featured).length,
      pendingComments,
      approvedComments,
      rejectedComments,
      latestPublishedAt: latestPublished?.publishedAt,
      latestPublishedTitle: latestPublished?.title,
      owners: Array.from(ownerCounts.entries())
        .map(([ownerName, ownerPosts]) => ({ ownerName, posts: ownerPosts }))
        .sort((left, right) => right.posts - left.posts)
        .slice(0, 5),
    };
  }

  if (!dbPosts.available) {
    return getBlogOperationalSummary();
  }

  const posts = dbPosts.value;
  const ownerCounts = new Map<string, number>();
  let pendingComments = 0;
  let approvedComments = 0;
  let rejectedComments = 0;

  for (const post of posts) {
    const ownerName = post.ownerName || post.authorName || 'Equipe Editorial';
    ownerCounts.set(ownerName, (ownerCounts.get(ownerName) || 0) + 1);

    const comments = await listBlogCommentsFromDatabase(post.slug, { publicOnly: false });
    if (!comments.available) continue;

    for (const comment of comments.value) {
      if (comment.status === 'pending') pendingComments += 1;
      if (comment.status === 'approved') approvedComments += 1;
      if (comment.status === 'rejected') rejectedComments += 1;
    }
  }

  const latestPublished = [...posts]
    .filter((post) => post.status === 'published' && post.publishedAt)
    .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())[0];

  return {
    totalPosts: posts.length,
    draftPosts: posts.filter((post) => post.status === 'draft').length,
    publishedPosts: posts.filter((post) => post.status === 'published').length,
    archivedPosts: posts.filter((post) => post.status === 'archived').length,
    featuredPosts: posts.filter((post) => post.featured).length,
    pendingComments,
    approvedComments,
    rejectedComments,
    latestPublishedAt: latestPublished?.publishedAt,
    latestPublishedTitle: latestPublished?.title,
    owners: Array.from(ownerCounts.entries())
      .map(([ownerName, ownerPosts]) => ({ ownerName, posts: ownerPosts }))
      .sort((left, right) => right.posts - left.posts)
      .slice(0, 5),
  };
}
