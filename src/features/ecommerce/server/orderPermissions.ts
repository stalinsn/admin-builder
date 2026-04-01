import 'server-only';

import type { AuthenticatedPanelUser } from '@/features/ecommpanel/types/auth';

export function canAccessOrderWorkspace(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('orders.manage') || user.permissions.includes('logistics.manage');
}

export function canManageOrders(user: AuthenticatedPanelUser): boolean {
  return canAccessOrderWorkspace(user);
}

export function canAccessCustomerWorkspace(user: AuthenticatedPanelUser): boolean {
  return (
    canAccessOrderWorkspace(user) ||
    user.permissions.includes('catalog.content.manage') ||
    user.permissions.includes('customers.manage') ||
    user.permissions.includes('customers.lgpd.read') ||
    user.permissions.includes('customers.lgpd.request') ||
    user.permissions.includes('customers.lgpd.approve') ||
    user.permissions.includes('customers.lgpd.execute')
  );
}

export function canManageCustomers(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('customers.manage') || user.permissions.includes('security.superuser');
}

export function canReadCustomerLgpd(user: AuthenticatedPanelUser): boolean {
  return (
    user.permissions.includes('customers.lgpd.read') ||
    user.permissions.includes('customers.lgpd.request') ||
    user.permissions.includes('customers.lgpd.approve') ||
    user.permissions.includes('customers.lgpd.execute') ||
    user.permissions.includes('security.superuser')
  );
}

export function canRequestCustomerLgpd(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('customers.lgpd.request') || user.permissions.includes('security.superuser');
}

export function canApproveCustomerLgpd(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('customers.lgpd.approve') || user.permissions.includes('security.superuser');
}

export function canExecuteCustomerLgpd(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('customers.lgpd.execute') || user.permissions.includes('security.superuser');
}

export function canManageCustomerRetention(user: AuthenticatedPanelUser): boolean {
  return user.permissions.includes('privacy.retention.manage') || user.permissions.includes('security.superuser');
}
