import { redirect } from 'next/navigation';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function EcommPanelEntryPage() {
  const user = await getPanelUserFromCookies();
  if (user) {
    redirect('/ecommpanel/admin');
  }
  redirect('/ecommpanel/login');
}
