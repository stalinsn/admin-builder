import 'server-only';

import type { AuthenticatedPanelUser, PanelPermission } from '@/features/ecommpanel/types/auth';
import type { BlogPost } from '../types';

function has(user: AuthenticatedPanelUser, permission: string): boolean {
  return user.permissions.includes(permission as PanelPermission);
}

export function canAccessBlogWorkspace(user: AuthenticatedPanelUser): boolean {
  return [
    'blog.posts.manage',
    'blog.posts.create',
    'blog.posts.edit',
    'blog.posts.publish',
    'blog.comments.moderate',
    'blog.authors.manage',
  ].some((permission) => has(user, permission));
}

export function canCreateBlogPost(user: AuthenticatedPanelUser): boolean {
  return has(user, 'blog.posts.manage') || has(user, 'blog.posts.create') || has(user, 'blog.posts.edit');
}

export function canEditBlogPost(user: AuthenticatedPanelUser, post: BlogPost): boolean {
  if (has(user, 'blog.posts.manage') || has(user, 'blog.authors.manage')) {
    return true;
  }

  if (!has(user, 'blog.posts.edit')) {
    return false;
  }

  if (!post.governance.ownerUserId) {
    return true;
  }

  return post.governance.ownerUserId === user.id;
}

export function canPublishBlogPost(user: AuthenticatedPanelUser): boolean {
  return has(user, 'blog.posts.manage') || has(user, 'blog.posts.publish');
}

export function canModerateBlogComments(user: AuthenticatedPanelUser): boolean {
  return has(user, 'blog.comments.moderate') || has(user, 'blog.posts.manage');
}

export function canManageBlogAuthors(user: AuthenticatedPanelUser): boolean {
  return has(user, 'blog.authors.manage') || has(user, 'blog.posts.manage');
}
