import 'server-only';
import {
  PANEL_PERMISSIONS,
  type AuthenticatedPanelUser,
  type PanelPermission,
  type PanelRole,
  type PanelRoleId,
  type PanelUser,
} from '../types/auth';

const ALL_PERMISSIONS = [...PANEL_PERMISSIONS];

export const PANEL_ROLES_MAP: Record<PanelRoleId, PanelRole> = {
  main_admin: {
    id: 'main_admin',
    name: 'Main Admin',
    description: 'Full control. Can manage all users, roles, permissions and critical settings.',
    permissions: ALL_PERMISSIONS,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'Operational full-access except superuser permission.',
    permissions: ALL_PERMISSIONS.filter(
      (permission) => !['security.superuser', 'data.connection.manage', 'data.bootstrap.manage'].includes(permission),
    ),
  },
  store_owner: {
    id: 'store_owner',
    name: 'Store Owner',
    description: 'Owns store operations and configuration without user/permission administration.',
    permissions: ALL_PERMISSIONS.filter((permission) => {
      return ![
        'users.manage',
        'roles.manage',
        'permissions.grant',
        'security.superuser',
        'data.admin.manage',
        'data.read',
        'data.connection.manage',
        'data.bootstrap.manage',
        'data.entities.manage',
        'data.records.manage',
      ].includes(permission);
    }),
  },
  demo_operator: {
    id: 'demo_operator',
    name: 'Demo Operator',
    description: 'Demonstration access with broad visibility and temporary sandboxed catalog changes only.',
    permissions: [
      'dashboard.read',
      'analytics.read',
      'data.read',
      'catalog.products.manage',
      'catalog.content.manage',
      'catalog.pricing.manage',
      'users.manage',
      'audit.read',
    ],
  },
  site_editor: {
    id: 'site_editor',
    name: 'Site Editor',
    description: 'Can update storefront layout/content and feature modules.',
    permissions: [
      'dashboard.read',
      'analytics.read',
      'site.layout.manage',
      'site.content.manage',
      'blog.posts.manage',
      'blog.posts.create',
      'blog.posts.edit',
      'blog.posts.publish',
      'blog.comments.moderate',
      'blog.authors.manage',
      'featureFlags.manage',
    ],
  },
  content_author: {
    id: 'content_author',
    name: 'Content Author',
    description: 'Can create and refine blog drafts under editorial governance.',
    permissions: ['dashboard.read', 'blog.posts.create', 'blog.posts.edit'],
  },
  content_editor: {
    id: 'content_editor',
    name: 'Content Editor',
    description: 'Can review and edit editorial content across the blog operation.',
    permissions: ['dashboard.read', 'blog.posts.create', 'blog.posts.edit', 'blog.authors.manage'],
  },
  content_publisher: {
    id: 'content_publisher',
    name: 'Content Publisher',
    description: 'Can publish blog posts and coordinate storefront editorial releases.',
    permissions: ['dashboard.read', 'blog.posts.publish', 'blog.authors.manage'],
  },
  comment_moderator: {
    id: 'comment_moderator',
    name: 'Comment Moderator',
    description: 'Can moderate blog interactions without broader content permissions.',
    permissions: ['dashboard.read', 'blog.comments.moderate'],
  },
  catalog_manager: {
    id: 'catalog_manager',
    name: 'Catalog Manager',
    description: 'Can manage products, descriptions and pricing.',
    permissions: ['dashboard.read', 'analytics.read', 'catalog.products.manage', 'catalog.content.manage', 'catalog.pricing.manage'],
  },
  logistics_manager: {
    id: 'logistics_manager',
    name: 'Logistics Manager',
    description: 'Can manage shipping/logistics and order operations.',
    permissions: ['dashboard.read', 'analytics.read', 'logistics.manage', 'orders.manage', 'customers.lgpd.read'],
  },
  settings_manager: {
    id: 'settings_manager',
    name: 'Settings Manager',
    description: 'Can update store settings including minimum purchase amount.',
    permissions: [
      'dashboard.read',
      'analytics.read',
      'analytics.manage',
      'store.settings.manage',
      'store.minimumPurchase.manage',
      'integrations.manage',
      'api.keys.manage',
    ],
  },
  data_manager: {
    id: 'data_manager',
    name: 'Data Manager',
    description: 'Can maintain entities, imports and operational data structure without changing database connection/bootstrap.',
    permissions: ['dashboard.read', 'data.read', 'data.entities.manage', 'data.records.manage'],
  },
  data_editor: {
    id: 'data_editor',
    name: 'Data Editor',
    description: 'Can import and manipulate records without changing entities or connection state.',
    permissions: ['dashboard.read', 'data.read', 'data.records.manage'],
  },
  data_viewer: {
    id: 'data_viewer',
    name: 'Data Viewer',
    description: 'Read-only visibility over entities, bootstrap state and bundle output.',
    permissions: ['dashboard.read', 'data.read'],
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only visibility for dashboard and logs.',
    permissions: ['dashboard.read', 'analytics.read', 'audit.read', 'data.read'],
  },
};

export function isDemoUser(user: Pick<PanelUser, 'roleIds'>): boolean {
  return user.roleIds.includes('demo_operator');
}

export function resolvePermissions(user: PanelUser): PanelPermission[] {
  const granted = new Set<PanelPermission>();

  for (const roleId of user.roleIds) {
    const role = PANEL_ROLES_MAP[roleId];
    if (!role) continue;
    role.permissions.forEach((permission) => granted.add(permission));
  }

  user.permissionsAllow.forEach((permission) => granted.add(permission));
  user.permissionsDeny.forEach((permission) => granted.delete(permission));

  return Array.from(granted);
}

export function withResolvedPermissions(user: PanelUser): AuthenticatedPanelUser {
  return { ...user, permissions: resolvePermissions(user) };
}

export function hasPermission(user: AuthenticatedPanelUser, permission: PanelPermission): boolean {
  return user.permissions.includes(permission);
}

export function assertPermission(user: AuthenticatedPanelUser, permission: PanelPermission): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function canGrantPermissions(actor: AuthenticatedPanelUser, requestedPermissions: PanelPermission[]): boolean {
  if (hasPermission(actor, 'security.superuser')) return true;
  return requestedPermissions.every((permission) => hasPermission(actor, permission));
}
