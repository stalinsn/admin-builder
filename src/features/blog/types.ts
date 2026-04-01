export const BLOG_POST_STATUSES = ['draft', 'published', 'archived'] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_COMMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type BlogCommentStatus = (typeof BLOG_COMMENT_STATUSES)[number];

export const BLOG_REACTION_VALUES = ['like', 'dislike'] as const;
export type BlogReactionValue = (typeof BLOG_REACTION_VALUES)[number];

export type BlogSeo = {
  title: string;
  description: string;
  keywords: string;
  noIndex: boolean;
};

export type BlogAuthor = {
  name: string;
  role: string;
  avatarUrl: string;
};

export type BlogPostGovernance = {
  ownerUserId?: string;
  ownerName: string;
  lastEditedByUserId?: string;
  lastEditedByName: string;
  publishedByUserId?: string;
  publishedByName?: string;
};

export type BlogContentSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  caption: string;
};

export type BlogInteractionSettings = {
  commentsEnabled: boolean;
  commentsRequireModeration: boolean;
  reactionsEnabled: boolean;
  bookmarksEnabled: boolean;
  shareEnabled: boolean;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  coverImageAlt: string;
  author: BlogAuthor;
  intro: string;
  sections: BlogContentSection[];
  outro: string;
  readTimeMinutes: number;
  featured: boolean;
  status: BlogPostStatus;
  interaction: BlogInteractionSettings;
  seo: BlogSeo;
  governance: BlogPostGovernance;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type BlogPostListItem = Pick<
  BlogPost,
  | 'id'
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'category'
  | 'tags'
  | 'coverImageUrl'
  | 'coverImageAlt'
  | 'readTimeMinutes'
  | 'featured'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'publishedAt'
> & {
  authorName: string;
  ownerUserId?: string;
  ownerName: string;
  publishedByName?: string;
};

export type BlogPublishedPost = BlogPost & {
  canonicalPath: string;
};

export type BlogComment = {
  id: string;
  postSlug: string;
  authorName: string;
  content: string;
  status: BlogCommentStatus;
  createdAt: string;
  updatedAt: string;
  moderatedAt?: string;
  moderationNote?: string;
  fingerprintHash: string;
};

export type BlogReactionEntry = {
  fingerprintHash: string;
  value: BlogReactionValue;
  updatedAt: string;
};

export type BlogReactionSummary = {
  likes: number;
  dislikes: number;
  userReaction: BlogReactionValue | null;
};
