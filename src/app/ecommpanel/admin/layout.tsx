import { redirect } from 'next/navigation';
import PanelAdminFrame from '@/features/ecommpanel/components/PanelAdminFrame';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function EcommPanelAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  const canManageUsers = user.permissions.includes('users.manage');
  const canReadAnalytics = user.permissions.includes('analytics.read');
  const canReadDataStudio = user.permissions.includes('data.admin.manage') || user.permissions.includes('data.read');
  const canReadCatalog =
    user.permissions.includes('catalog.products.manage') ||
    user.permissions.includes('catalog.content.manage') ||
    user.permissions.includes('catalog.pricing.manage') ||
    user.permissions.includes('logistics.manage');
  const canReadOrders = user.permissions.includes('orders.manage') || user.permissions.includes('logistics.manage');
  const canReadPanelSettings =
    user.permissions.includes('store.settings.manage') || user.permissions.includes('integrations.manage');
  const canReadIntegrations =
    user.permissions.includes('integrations.manage') || user.permissions.includes('api.keys.manage');

  return (
    <PanelAdminFrame
      userName={user.name}
      userEmail={user.email}
      canManageUsers={canManageUsers}
      canReadAnalytics={canReadAnalytics}
      canReadDataStudio={canReadDataStudio}
      canReadCatalog={canReadCatalog}
      canReadOrders={canReadOrders}
      canReadPanelSettings={canReadPanelSettings}
      canReadIntegrations={canReadIntegrations}
    >
      {children}
    </PanelAdminFrame>
  );
}
