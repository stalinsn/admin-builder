import 'server-only';

import type { AuthenticatedPanelUser } from '@/features/ecommpanel/types/auth';

export function canAccessCatalogWorkspace(user: AuthenticatedPanelUser): boolean {
  return (
    user.permissions.includes('catalog.products.manage') ||
    user.permissions.includes('catalog.content.manage') ||
    user.permissions.includes('catalog.pricing.manage') ||
    user.permissions.includes('logistics.manage')
  );
}

export function canManageCatalogProducts(user: AuthenticatedPanelUser): boolean {
  return (
    user.permissions.includes('catalog.products.manage') ||
    user.permissions.includes('catalog.content.manage') ||
    user.permissions.includes('catalog.pricing.manage')
  );
}
