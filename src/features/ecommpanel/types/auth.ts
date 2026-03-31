export const PANEL_PERMISSIONS = [
  'dashboard.read',
  'analytics.read',
  'analytics.manage',
  'data.admin.manage',
  'data.read',
  'data.connection.manage',
  'data.bootstrap.manage',
  'data.entities.manage',
  'data.records.manage',
  'site.layout.manage',
  'site.content.manage',
  'blog.posts.manage',
  'blog.posts.create',
  'blog.posts.edit',
  'blog.posts.publish',
  'blog.comments.moderate',
  'blog.authors.manage',
  'featureFlags.manage',
  'catalog.products.manage',
  'catalog.content.manage',
  'catalog.pricing.manage',
  'logistics.manage',
  'orders.manage',
  'customers.manage',
  'customers.lgpd.read',
  'customers.lgpd.request',
  'customers.lgpd.approve',
  'customers.lgpd.execute',
  'privacy.retention.manage',
  'store.settings.manage',
  'store.minimumPurchase.manage',
  'integrations.manage',
  'api.keys.manage',
  'users.manage',
  'roles.manage',
  'permissions.grant',
  'audit.read',
  'security.superuser',
] as const;

export type PanelPermission = (typeof PANEL_PERMISSIONS)[number];

export const PANEL_ROLES = [
  'main_admin',
  'admin',
  'store_owner',
  'demo_operator',
  'site_editor',
  'content_author',
  'content_editor',
  'content_publisher',
  'comment_moderator',
  'catalog_manager',
  'logistics_manager',
  'settings_manager',
  'data_manager',
  'data_editor',
  'data_viewer',
  'viewer',
] as const;

export type PanelRoleId = (typeof PANEL_ROLES)[number];

export type PanelRole = {
  id: PanelRoleId;
  name: string;
  description: string;
  permissions: PanelPermission[];
};

export type PanelUser = {
  id: string;
  email: string;
  name: string;
  roleIds: PanelRoleId[];
  permissionsAllow: PanelPermission[];
  permissionsDeny: PanelPermission[];
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type PanelUserRecord = PanelUser & {
  passwordHash: string;
  failedAttempts: number;
  lockUntil?: string;
};

export type PanelSession = {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: string;
  hardExpiresAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgentHash: string;
  ipHash: string;
};

export type PanelResetToken = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type PanelLoginToken = {
  id: string;
  userId: string;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  channel: 'email';
};

export type PanelAuditEvent = {
  id: string;
  actorUserId?: string;
  event: string;
  outcome: 'success' | 'failure';
  ipHash?: string;
  userAgentHash?: string;
  target?: string;
  details?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type AuthenticatedPanelUser = PanelUser & {
  permissions: PanelPermission[];
};
