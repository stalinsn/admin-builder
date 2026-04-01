import 'server-only';

import { createUser, ensurePanelAuthSchemaRuntime, ensureSeededUsers, listUsers } from '@/features/ecommpanel/server/panelStore';
import { hashPassword, validatePasswordPolicy } from '@/features/ecommpanel/server/password';
import { ensureCustomerAuthSchemaRuntime, listCustomerRetentionPoliciesAdmin } from '@/features/ecommerce/server/customerAccountStore';

export type AuthKitBootstrapInput = {
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  seedDefaultPanelUsers?: boolean;
};

export type AuthKitBootstrapResult = {
  panel: {
    storage: 'database' | 'mock';
    usersCount: number;
    adminCreated: boolean;
    seededDefaultUsers: boolean;
    adminEmail: string;
  };
  customer: {
    schemaReady: boolean;
    retentionPolicies: number;
  };
};

function normalizeRequired(value: string, label: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} é obrigatório para o bootstrap do auth kit.`);
  }
  return normalized;
}

export async function bootstrapAuthKitRuntime(input: AuthKitBootstrapInput): Promise<AuthKitBootstrapResult> {
  const adminEmail = normalizeRequired(input.adminEmail, 'Admin e-mail').toLowerCase();
  const adminName = normalizeRequired(input.adminName, 'Admin nome');
  const adminPassword = normalizeRequired(input.adminPassword, 'Admin senha');
  const passwordValidation = validatePasswordPolicy(adminPassword);
  if (!passwordValidation.ok) {
    throw new Error(`A senha inicial do admin não atende à política: ${passwordValidation.reasons.join(' ')}`);
  }

  const panelStorage = await ensurePanelAuthSchemaRuntime();
  let adminCreated = false;
  let seededDefaultUsers = false;

  if (input.seedDefaultPanelUsers) {
    await ensureSeededUsers();
    seededDefaultUsers = true;
  } else {
    const existingUsers = await listUsers();
    if (existingUsers.length === 0) {
      const passwordHash = await hashPassword(adminPassword);
      await createUser({
        email: adminEmail,
        name: adminName,
        roleIds: ['main_admin'],
        active: true,
        mustChangePassword: false,
        permissionsAllow: [],
        permissionsDeny: [],
        passwordHash,
      });
      adminCreated = true;
    }
  }

  const usersCount = (await listUsers()).length;
  const customerSchemaReady = await ensureCustomerAuthSchemaRuntime();
  if (!customerSchemaReady) {
    throw new Error('O bootstrap do auth kit exige PostgreSQL disponível para criar a base de clientes.');
  }

  const retentionPolicies = (await listCustomerRetentionPoliciesAdmin()).length;

  return {
    panel: {
      storage: panelStorage,
      usersCount,
      adminCreated,
      seededDefaultUsers,
      adminEmail,
    },
    customer: {
      schemaReady: customerSchemaReady,
      retentionPolicies,
    },
  };
}
