import type { NextRequest } from 'next/server';

import { getApiAuthContext } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { listUsers } from '@/features/ecommpanel/server/panelStore';
import { withResolvedPermissions } from '@/features/ecommpanel/server/rbac';
import type { PanelPermission } from '@/features/ecommpanel/types/auth';
import { canAccessBlogWorkspace } from '@/features/blog/server/permissions';

export const dynamic = 'force-dynamic';

const BLOG_AUTHOR_PERMISSIONS: PanelPermission[] = [
  'blog.posts.manage',
  'blog.posts.create',
  'blog.posts.edit',
  'blog.posts.publish',
  'blog.authors.manage',
];

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Não autenticado.');
  }

  if (!canAccessBlogWorkspace(auth.user)) {
    return errorNoStore(403, 'Sem permissão para acessar os autores editoriais.');
  }

  const authors = (await listUsers())
    .filter((user) => user.active)
    .map((user) => withResolvedPermissions(user))
    .filter((user) =>
      BLOG_AUTHOR_PERMISSIONS.some((permission) => user.permissions.includes(permission)),
    )
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleIds: user.roleIds,
      permissions: user.permissions,
    }));

  return jsonNoStore({ authors });
}
