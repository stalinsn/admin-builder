import 'server-only';

import type { AuthenticatedPanelUser } from '@/features/ecommpanel/types/auth';

export function canReadPanelMedia(user: AuthenticatedPanelUser): boolean {
  return (
    user.permissions.includes('dashboard.read') ||
    user.permissions.includes('data.read') ||
    user.permissions.includes('data.records.manage') ||
    user.permissions.includes('data.entities.manage') ||
    user.permissions.includes('store.settings.manage') ||
    user.permissions.includes('integrations.manage')
  );
}

export function canManagePanelMedia(user: AuthenticatedPanelUser): boolean {
  return (
    user.permissions.includes('data.records.manage') ||
    user.permissions.includes('data.entities.manage') ||
    user.permissions.includes('store.settings.manage') ||
    user.permissions.includes('integrations.manage') ||
    user.permissions.includes('security.superuser')
  );
}
