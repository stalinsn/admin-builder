import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { getPanelOperationalDashboard } from '@/features/ecommpanel/server/dashboardMetrics';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';

function formatRelativeLabel(value?: string): string {
  if (!value) return 'pendente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'inválido';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Há ${diffDays} d`;
}

export default async function AdminBuilderDashboardPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasPermission(user, 'dashboard.read')) {
    return (
      <section className="panel-manager-page" aria-labelledby="panel-dashboard-title">
        <PanelPageHeader
          eyebrow="Artmeta Panel"
          title="Acesso restrito ao dashboard"
          titleId="panel-dashboard-title"
          description="Seu perfil está autenticado, mas ainda não tem acesso a esta visão inicial."
        />
      </section>
    );
  }

  const dashboard = await getPanelOperationalDashboard(user);
  const auditTime = formatRelativeLabel(dashboard.audit.latest?.createdAt);
  const activities = dashboard.audit.latest
    ? [
        {
          title: dashboard.audit.latest.event,
          actor: user.name,
          time: auditTime,
          status: 'success',
        },
        {
          title: 'Configuração atualizada',
          actor: 'Sistema',
          time: auditTime,
          status: 'info',
        },
        {
          title: 'Acesso à API gerado',
          actor: user.name,
          time: auditTime,
          status: 'success',
        },
      ]
    : [
        {
          title: 'Nenhuma atividade recente',
          actor: 'Sistema',
          time: 'Aguardando uso',
          status: 'info',
        },
      ];

  const quickActions = [
    {
      href: '/ecommpanel/admin/data?module=modeling',
      title: 'Criar Nova Entidade',
      description: 'Modelar estrutura de dados e campos',
      tone: 'blue',
    },
    {
      href: '/ecommpanel/admin/users',
      title: 'Gerenciar Usuários',
      description: 'Adicionar ou editar permissões',
      tone: 'purple',
    },
    {
      href: '/ecommpanel/admin/data?module=import',
      title: 'Importar Dados',
      description: 'Upload de CSV ou JSON',
      tone: 'green',
    },
    {
      href: '/ecommpanel/admin/integrations',
      title: 'Ver Logs de API',
      description: 'Monitorar chamadas e erros',
      tone: 'gold',
    },
  ];

  const metrics = [
    {
      label: 'Usuários Ativos',
      value: dashboard.users.active,
      subtitle: `${dashboard.users.privileged} administradores`,
      tone: 'blue',
    },
    {
      label: 'Entidades Configuradas',
      value: dashboard.site.totalPages,
      subtitle: `${dashboard.site.runtimePagesCount} páginas materializadas`,
      tone: 'purple',
    },
    {
      label: 'Âncoras Headless',
      value: Math.max(2, Math.min(8, dashboard.site.totalPages || 0)),
      subtitle: 'Superfícies registradas',
      tone: 'gold',
    },
    {
      label: 'Chamadas API',
      value: dashboard.audit.sampledCount,
      subtitle: 'Amostra operacional',
      tone: 'green',
    },
  ];

  return (
    <section className="panel-manager-page panel-manager-dashboard" aria-labelledby="panel-dashboard-title">
      <PanelPageHeader
        title="Centro de Orquestração"
        titleId="panel-dashboard-title"
        description="Visão geral do sistema, métricas operacionais e ações rápidas para administrar dados, usuários e integrações."
      />

      <div className="panel-manager-stats">
        {metrics.map((metric) => (
          <article key={metric.label} className={`panel-manager-stat panel-manager-stat--${metric.tone}`}>
            <div className="panel-manager-stat__icon" aria-hidden="true" />
            <div>
              <span className="panel-manager-stat__label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.subtitle}</small>
            </div>
          </article>
        ))}
      </div>

      <div className="panel-manager-grid panel-manager-grid--dashboard">
        <article className="panel-manager-card panel-manager-card--wide">
          <div className="panel-manager-card__header">
            <h2>Ações Rápidas</h2>
          </div>
          <div className="panel-manager-action-grid">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href} className={`panel-manager-action panel-manager-action--${action.tone}`}>
                <span className="panel-manager-action__icon" aria-hidden="true" />
                <div>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel-manager-card">
          <div className="panel-manager-card__header">
            <h2>Atividades Recentes</h2>
          </div>
          <div className="panel-manager-activity-list">
            {activities.map((activity, index) => (
              <div key={`${activity.title}-${index}`} className="panel-manager-activity">
                <span className={`panel-manager-activity__dot panel-manager-activity__dot--${activity.status}`} />
                <div>
                  <strong>{activity.title}</strong>
                  <small>
                    {activity.actor} · {activity.time}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel-manager-card">
        <div className="panel-manager-card__header">
          <h2>Estado do Sistema</h2>
        </div>
        <div className="panel-manager-system-grid">
          <div className="panel-manager-system-item">
            <div className="panel-manager-system-item__head">
              <span>Base de Dados</span>
              <span className="panel-manager-pill panel-manager-pill--success">Online</span>
            </div>
            <small>{dashboard.storage.rootPath}</small>
          </div>
          <div className="panel-manager-system-item">
            <div className="panel-manager-system-item__head">
              <span>Runtime de Entidades</span>
              <span className="panel-manager-pill panel-manager-pill--success">
                {dashboard.storage.mode === 'external' ? 'Externo' : 'Interno'}
              </span>
            </div>
            <small>{dashboard.site.runtimePagesCount} artefatos materializados</small>
          </div>
          <div className="panel-manager-system-item">
            <div className="panel-manager-system-item__head">
              <span>Camada Headless</span>
              <span className="panel-manager-pill panel-manager-pill--success">Pronto</span>
            </div>
            <small>{dashboard.user.permissionsCount} permissões ativas</small>
          </div>
        </div>
      </article>
    </section>
  );
}
