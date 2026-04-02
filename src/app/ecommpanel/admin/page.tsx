import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { getPanelOperationalDashboard } from '@/features/ecommpanel/server/dashboardMetrics';

function formatRelativeLabel(value?: string): string {
  if (!value) return 'pendente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'inválido';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h atrás`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} d atrás`;
}

function formatRoleLabel(roleId: string): string {
  const labels: Record<string, string> = {
    main_admin: 'admin principal',
    store_owner: 'owner',
    admin: 'admin',
    viewer: 'leitura',
    data_manager: 'gestão de dados',
    data_editor: 'edição de dados',
    data_viewer: 'leitura de dados',
  };

  return labels[roleId] || roleId;
}

const QUICK_ACTIONS = [
  {
    href: '/ecommpanel/admin/data',
    title: 'Conexão e acesso',
    description: 'Configure perfis de conexão e valide a comunicação da plataforma com o banco.',
    cta: 'Ver detalhes',
    tone: 'blue',
  },
  {
    href: '/ecommpanel/admin/data',
    title: 'Importação inicial',
    description: 'Execute validações, provisionamento e confirmação do bootstrap da base.',
    cta: 'Executar agora',
    tone: 'green',
  },
  {
    href: '/ecommpanel/admin/data',
    title: 'Modelar entidades',
    description: 'Defina estruturas de tabelas, campos e atributos operacionais das entidades.',
    cta: 'Ver detalhes',
    tone: 'violet',
  },
  {
    href: '/ecommpanel/admin/records',
    title: 'Entidades e registros',
    description: 'Listar entidades em tabela, adicionar registros e editar atributos diretamente no painel.',
    cta: 'Ver detalhes',
    tone: 'orange',
  },
  {
    href: '/ecommpanel/admin/integrations',
    title: 'Ativar registros',
    description: 'Preparar leitura headless, autenticação técnica e operação externa por token.',
    cta: 'Ver detalhes',
    tone: 'indigo',
  },
  {
    href: '/ecommpanel/admin/data',
    title: 'Sincronizar CSV',
    description: 'Exportar tabelas, revisar cabeçalhos e sincronizar dados com planilhas externas.',
    cta: 'Ver detalhes',
    tone: 'pink',
  },
] as const;

export default async function AdminBuilderDashboardPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasPermission(user, 'dashboard.read')) {
    return (
      <section className="panel-dashboard panel-grid" aria-labelledby="panel-dashboard-title">
        <article className="panel-card panel-card-hero">
          <p className="panel-kicker">Artmeta Panel</p>
          <h1 id="panel-dashboard-title">Acesso restrito ao dashboard</h1>
          <p className="panel-muted">
            Seu perfil está autenticado, mas ainda não tem acesso a esta visão inicial. Use as telas liberadas para o seu perfil ou ajuste os acessos do usuário.
          </p>
        </article>
      </section>
    );
  }

  const dashboard = await getPanelOperationalDashboard(user);

  return (
    <section className="panel-dashboard panel-grid panel-dashboard--rework" aria-labelledby="panel-dashboard-title">
      <article className="panel-card panel-page-intro">
        <div className="panel-page-intro__copy">
          <h1 id="panel-dashboard-title">Centro de Orquestração</h1>
          <p className="panel-muted">
            Esta trilha inicial centraliza dados, sustentação, gestão e integração da plataforma em um shell mais compacto e navegável.
          </p>
        </div>
        <div className="panel-page-intro__meta">
          <span className="panel-badge panel-badge-success">
            {dashboard.storage.mode === 'external' ? 'runtime externo' : 'runtime interno'}
          </span>
          <span className="panel-badge panel-badge-neutral">{dashboard.user.permissionsCount} permissões ativas</span>
        </div>
      </article>

      <div className="panel-stats panel-stats--compact panel-dashboard-metrics">
        <article className="panel-stat">
          <span className="panel-muted">Usuários ativos</span>
          <strong>{dashboard.users.active}</strong>
          <span>{dashboard.users.total} administradores cadastrados</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Usuários existentes</span>
          <strong>{dashboard.users.privileged}</strong>
          <span>{dashboard.users.total - dashboard.users.privileged} perfis complementares ativos</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Âncoras headless</span>
          <strong>{Math.max(2, Math.min(4, dashboard.site.totalPages || 0))}</strong>
          <span>Superfícies prontas para integração</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Perfil de acesso</span>
          <strong>{formatRelativeLabel(dashboard.audit.latest?.createdAt)}</strong>
          <span>Última atualização do runtime</span>
        </article>
      </div>

      <div className="panel-operations-grid">
        {QUICK_ACTIONS.map((action) => (
          <article key={`${action.href}-${action.title}`} className={`panel-card panel-operation-card panel-operation-card--${action.tone}`}>
            <div className="panel-operation-card__head">
              <span className="panel-operation-card__icon" aria-hidden="true" />
              <span className={`panel-badge panel-badge-soft panel-badge-soft--${action.tone}`}>
                {action.tone === 'green' ? 'Executar' : action.tone === 'blue' ? 'Configurar' : 'Pendente'}
              </span>
            </div>
            <h2>{action.title}</h2>
            <p>{action.description}</p>
            <Link href={action.href} className={`panel-operation-card__cta panel-operation-card__cta--${action.tone}`}>
              {action.cta}
            </Link>
          </article>
        ))}
      </div>

      <div className="panel-dashboard-layout panel-dashboard-layout--compact">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <h2>Passos ativos</h2>
              <p className="panel-muted">Camadas do ambiente prontas para manutenção direta.</p>
            </div>
            <span className="panel-badge panel-badge-success">Pronto · Executar</span>
          </div>

          <div className="panel-dashboard-actions panel-dashboard-actions--stacked">
          <Link href="/ecommpanel/admin/data" className="panel-dashboard-action panel-dashboard-action--stacked">
              <strong>Dados e estrutura</strong>
              <span>{dashboard.storage.rootPath}</span>
              <small>Acessar estado →</small>
            </Link>
            <Link href="/ecommpanel/admin/records" className="panel-dashboard-action panel-dashboard-action--stacked">
              <strong>Entidades e registros</strong>
              <span>Leia entidades modeladas, popule linhas e edite registros num workspace direto.</span>
              <small>Abrir workspace →</small>
            </Link>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <h2>Atividades recentes</h2>
              <p className="panel-muted">Leitura rápida do que mudou na plataforma.</p>
            </div>
            <Link href="/ecommpanel/admin/users" className="panel-link-chip">
              Ver todas
            </Link>
          </div>

          <div className="panel-activity-feed">
            {(dashboard.audit.latest
              ? [
                  dashboard.audit.latest,
                  ...Array.from({ length: Math.max(0, Math.min(2, dashboard.audit.sampledCount - 1)) }).map((_, index) => ({
                    event: index === 0 ? 'configuração atualizada' : 'acesso à API gerado',
                    createdAt: dashboard.audit.latest?.createdAt,
                    actor: index === 0 ? dashboard.user.name : 'Sistema',
                  })),
                ]
              : []
            ).map((entry, index) => (
              <div key={`${entry.event}-${index}`} className="panel-activity-feed__item">
                <span className={`panel-activity-feed__dot ${index === 2 ? 'is-warning' : ''}`} />
                <div>
                  <strong>{entry.event}</strong>
                  <small>
                    {(entry as { actor?: string }).actor || dashboard.user.name} · {formatRelativeLabel(entry.createdAt)}
                  </small>
                </div>
              </div>
            ))}
            {!dashboard.audit.latest ? (
              <div className="panel-activity-feed__item">
                <span className="panel-activity-feed__dot" />
                <div>
                  <strong>Nenhuma atividade recente</strong>
                  <small>O painel ainda não registrou operações recentes nesta instância.</small>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
