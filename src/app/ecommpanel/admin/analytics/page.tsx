import { redirect } from 'next/navigation';

import AnalyticsDashboardManager from '@/features/ecommpanel/components/AnalyticsDashboardManager';
import { getAnalyticsConfigRuntime, readPublishedRuntimeAnalyticsConfig } from '@/features/analytics/server/configStore';
import { getAnalyticsDashboard } from '@/features/analytics/server/eventStore';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';

function parseRangeDays(value: string | string[] | undefined): number {
  const first = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(first || '7', 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(Math.max(parsed, 1), 30);
}

export default async function AnalyticsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasPermission(user, 'analytics.read')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `analytics.read`.</p>
        </article>
      </section>
    );
  }

  const resolvedSearchParams = (await searchParams) || {};
  const rangeDays = parseRangeDays(resolvedSearchParams.range);
  try {
    const config = await getAnalyticsConfigRuntime();
    const dashboard = await getAnalyticsDashboard(rangeDays, config);
    const publishedConfig = readPublishedRuntimeAnalyticsConfig();

    return (
      <AnalyticsDashboardManager
        initialConfig={config}
        dashboard={dashboard}
        canManage={hasPermission(user, 'analytics.manage')}
        runtimeGeneratedAt={publishedConfig?.generatedAt}
      />
    );
  } catch (error) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Analytics indisponível</h1>
          <p className="panel-muted">{error instanceof Error ? error.message : 'Não foi possível carregar as configurações de analytics.'}</p>
        </article>
      </section>
    );
  }
}
