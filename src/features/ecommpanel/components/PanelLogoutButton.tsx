'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type MeResponse = {
  csrfToken?: string;
};

export default function PanelLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    try {
      const meRequest = await fetch('/api/ecommpanel/auth/me', { cache: 'no-store' });
      const mePayload = (await meRequest.json().catch(() => null)) as MeResponse | null;

      await fetch('/api/ecommpanel/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': mePayload?.csrfToken || '',
        },
      });
    } finally {
      setLoading(false);
      router.replace('/ecommpanel/login');
      router.refresh();
    }
  }

  return (
    <button className="panel-btn panel-btn-secondary panel-logout-button" type="button" onClick={onLogout} disabled={loading}>
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  );
}
