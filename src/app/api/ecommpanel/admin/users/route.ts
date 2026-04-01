import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { randomToken } from '@/features/ecommpanel/server/crypto';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  addAuditEvent,
  createUser,
  deleteUser,
  getUserById,
  getUserByEmail,
  listUsers,
  updateUser,
} from '@/features/ecommpanel/server/panelStore';
import { hashPassword, validatePasswordPolicy } from '@/features/ecommpanel/server/password';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { canGrantPermissions, PANEL_ROLES_MAP } from '@/features/ecommpanel/server/rbac';
import {
  PANEL_PERMISSIONS,
  PANEL_ROLES,
  type PanelPermission,
  type PanelRoleId,
} from '@/features/ecommpanel/types/auth';

export const dynamic = 'force-dynamic';

type CreateUserBody = {
  email?: string;
  name?: string;
  active?: boolean;
  roleIds?: string[];
  permissionsAllow?: string[];
  permissionsDeny?: string[];
  temporaryPassword?: string;
};

type UpdateUserBody = CreateUserBody & {
  userId?: string;
};

type DeleteUserBody = {
  userId?: string;
};

function normalizeRoleIds(value: string[] | undefined): PanelRoleId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(PANEL_ROLES);
  const unique = Array.from(new Set(value.map((entry) => entry.trim())));
  return unique.filter((entry): entry is PanelRoleId => allowed.has(entry as PanelRoleId));
}

function normalizePermissions(value: string[] | undefined): PanelPermission[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(PANEL_PERMISSIONS);
  const unique = Array.from(new Set(value.map((entry) => entry.trim())));
  return unique.filter((entry): entry is PanelPermission => allowed.has(entry as PanelPermission));
}

function generateTemporaryPassword(): string {
  const seed = randomToken(8);
  return `Tmp@${seed.slice(0, 5)}A9${seed.slice(-4)}`;
}

function listAvailableRoles() {
  return PANEL_ROLES.map((roleId) => PANEL_ROLES_MAP[roleId]);
}

async function countActiveMainAdmins(): Promise<number> {
  const users = await listUsers();
  return users.filter((user) => user.active && user.roleIds.includes('main_admin')).length;
}

async function getAuthorizedContext(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'users.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para gerenciar usuários.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const context = await getAuthorizedContext(req);
  if ('error' in context) return context.error;

  return jsonNoStore({
    users: await listUsers(),
    roles: listAvailableRoles(),
    permissions: PANEL_PERMISSIONS,
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `admin:users:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.adminMutations.limit,
    PANEL_SECURITY.rateLimits.adminMutations.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas operações administrativas. Tente novamente em instantes.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const context = await getAuthorizedContext(req);
  if ('error' in context) return context.error;

  const { auth } = context;

  if (!hasPermission(auth.user, 'permissions.grant')) {
    return errorNoStore(403, 'Sem permissão para delegar permissões.');
  }

  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as CreateUserBody | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const name = body?.name?.trim() || '';
  const roleIds = normalizeRoleIds(body?.roleIds);
  const permissionsAllow = normalizePermissions(body?.permissionsAllow);
  const permissionsDeny = normalizePermissions(body?.permissionsDeny);
  const active = body?.active !== undefined ? Boolean(body.active) : true;

  if (!email || !name) {
    return errorNoStore(400, 'Nome e e-mail são obrigatórios.');
  }

  if (roleIds.length === 0) {
    return errorNoStore(400, 'Selecione ao menos um perfil de acesso.');
  }

  const invalidRoleCount = (body?.roleIds || []).length - roleIds.length;
  if (invalidRoleCount > 0) {
    return errorNoStore(400, 'Um ou mais perfis informados são inválidos.');
  }

  const invalidAllowCount = (body?.permissionsAllow || []).length - permissionsAllow.length;
  const invalidDenyCount = (body?.permissionsDeny || []).length - permissionsDeny.length;
  if (invalidAllowCount > 0 || invalidDenyCount > 0) {
    return errorNoStore(400, 'Uma ou mais permissões informadas são inválidas.');
  }

  if (await getUserByEmail(email)) {
    return errorNoStore(409, 'Já existe usuário com este e-mail.');
  }

  if (roleIds.includes('main_admin') && !hasPermission(auth.user, 'security.superuser')) {
    return errorNoStore(403, 'Apenas superusuário pode criar outro Main Admin.');
  }

  if (!canGrantPermissions(auth.user, [...permissionsAllow, ...permissionsDeny])) {
    return errorNoStore(403, 'Você tentou delegar permissões que não possui.');
  }

  const temporaryPassword = body?.temporaryPassword?.trim() || generateTemporaryPassword();
  const passwordValidation = validatePasswordPolicy(temporaryPassword);
  if (!passwordValidation.ok) {
    return errorNoStore(400, 'Senha temporária fora da política.', {
      reasons: passwordValidation.reasons,
    });
  }

  const passwordHash = await hashPassword(temporaryPassword);
  const createdUser = await createUser({
    email,
    name,
    roleIds,
    active,
    permissionsAllow,
    permissionsDeny,
    passwordHash,
    actorUserId: auth.user.id,
  });

  addAuditEvent({
    actorUserId: auth.user.id,
    event: 'admin.users.create',
    outcome: 'success',
    target: createdUser.email,
    details: {
      roleIds: roleIds.join(','),
    },
  });

  return jsonNoStore({
    ok: true,
    user: createdUser,
    temporaryPassword,
  });
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `admin:users:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.adminMutations.limit,
    PANEL_SECURITY.rateLimits.adminMutations.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas operações administrativas. Tente novamente em instantes.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const context = await getAuthorizedContext(req);
  if ('error' in context) return context.error;

  const { auth } = context;

  if (!hasPermission(auth.user, 'permissions.grant')) {
    return errorNoStore(403, 'Sem permissão para delegar permissões.');
  }

  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as UpdateUserBody | null;
  const userId = body?.userId?.trim() || '';
  const email = body?.email?.trim().toLowerCase() || '';
  const name = body?.name?.trim() || '';
  const roleIds = normalizeRoleIds(body?.roleIds);
  const permissionsAllow = normalizePermissions(body?.permissionsAllow);
  const permissionsDeny = normalizePermissions(body?.permissionsDeny);

  if (!userId) {
    return errorNoStore(400, 'Usuário alvo não informado.');
  }

  const targetUser = await getUserById(userId);
  if (!targetUser) {
    return errorNoStore(404, 'Usuário não encontrado.');
  }
  const active = body?.active !== undefined ? Boolean(body.active) : targetUser.active;

  if (!email || !name) {
    return errorNoStore(400, 'Nome e e-mail são obrigatórios.');
  }

  if (roleIds.length === 0) {
    return errorNoStore(400, 'Selecione ao menos um perfil de acesso.');
  }

  const invalidRoleCount = (body?.roleIds || []).length - roleIds.length;
  if (invalidRoleCount > 0) {
    return errorNoStore(400, 'Um ou mais perfis informados são inválidos.');
  }

  const invalidAllowCount = (body?.permissionsAllow || []).length - permissionsAllow.length;
  const invalidDenyCount = (body?.permissionsDeny || []).length - permissionsDeny.length;
  if (invalidAllowCount > 0 || invalidDenyCount > 0) {
    return errorNoStore(400, 'Uma ou mais permissões informadas são inválidas.');
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser && existingUser.id !== targetUser.id) {
    return errorNoStore(409, 'Já existe usuário com este e-mail.');
  }

  if ((targetUser.roleIds.includes('main_admin') || roleIds.includes('main_admin')) && !hasPermission(auth.user, 'security.superuser')) {
    return errorNoStore(403, 'Apenas superusuário pode alterar um Main Admin.');
  }

  if (targetUser.id === auth.user.id && !active) {
    return errorNoStore(400, 'Você não pode desativar a própria conta.');
  }

  const removingMainAdminRole = targetUser.roleIds.includes('main_admin') && !roleIds.includes('main_admin');
  const deactivatingMainAdmin = targetUser.roleIds.includes('main_admin') && !active;
  if (removingMainAdminRole || deactivatingMainAdmin) {
    const activeMainAdmins = await countActiveMainAdmins();
    if (activeMainAdmins <= 1) {
      return errorNoStore(400, 'Não é possível remover ou desativar o último Main Admin.');
    }
  }

  if (!canGrantPermissions(auth.user, [...permissionsAllow, ...permissionsDeny])) {
    return errorNoStore(403, 'Você tentou delegar permissões que não possui.');
  }

  let passwordHash: string | undefined;
  const temporaryPassword = body?.temporaryPassword?.trim() || '';
  if (temporaryPassword) {
    const passwordValidation = validatePasswordPolicy(temporaryPassword);
    if (!passwordValidation.ok) {
      return errorNoStore(400, 'Senha temporária fora da política.', {
        reasons: passwordValidation.reasons,
      });
    }
    passwordHash = await hashPassword(temporaryPassword);
  }

  const updatedUser = await updateUser({
    userId,
    email,
    name,
    roleIds,
    active,
    permissionsAllow,
    permissionsDeny,
    passwordHash,
    actorUserId: auth.user.id,
  });

  if (!updatedUser) {
    return errorNoStore(404, 'Usuário não encontrado.');
  }

  addAuditEvent({
    actorUserId: auth.user.id,
    event: 'admin.users.update',
    outcome: 'success',
    target: updatedUser.email,
    details: {
      roleIds: roleIds.join(','),
      passwordReset: Boolean(passwordHash),
    },
  });

  return jsonNoStore({
    ok: true,
    user: updatedUser,
    temporaryPassword: temporaryPassword || undefined,
  });
}

export async function DELETE(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `admin:users:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.adminMutations.limit,
    PANEL_SECURITY.rateLimits.adminMutations.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas operações administrativas. Tente novamente em instantes.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const context = await getAuthorizedContext(req);
  if ('error' in context) return context.error;

  const { auth } = context;

  if (!hasPermission(auth.user, 'permissions.grant')) {
    return errorNoStore(403, 'Sem permissão para remover usuários.');
  }

  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as DeleteUserBody | null;
  const userId = body?.userId?.trim() || '';
  if (!userId) {
    return errorNoStore(400, 'Usuário alvo não informado.');
  }

  const targetUser = await getUserById(userId);
  if (!targetUser) {
    return errorNoStore(404, 'Usuário não encontrado.');
  }

  if (targetUser.id === auth.user.id) {
    return errorNoStore(400, 'Você não pode excluir a própria conta.');
  }

  if (targetUser.roleIds.includes('main_admin')) {
    if (!hasPermission(auth.user, 'security.superuser')) {
      return errorNoStore(403, 'Apenas superusuário pode excluir um Main Admin.');
    }

    const activeMainAdmins = await countActiveMainAdmins();
    if (activeMainAdmins <= 1) {
      return errorNoStore(400, 'Não é possível excluir o último Main Admin.');
    }
  }

  const deleted = await deleteUser({
    userId,
    actorUserId: auth.user.id,
  });

  if (!deleted) {
    return errorNoStore(404, 'Usuário não encontrado.');
  }

  addAuditEvent({
    actorUserId: auth.user.id,
    event: 'admin.users.delete',
    outcome: 'success',
    target: targetUser.email,
    details: {
      userId,
    },
  });

  return jsonNoStore({
    ok: true,
  });
}
