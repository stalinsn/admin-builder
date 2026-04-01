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
    title: 'Modelar base',
    description: 'Abrir conexões, bootstrap, entidades, imports e pacote base.',
  },
  {
    href: '/ecommpanel/admin/data/dictionary',
    title: 'Revisar dicionário',
    description: 'Conferir tabelas, campos, tipos e finalidade do banco atual.',
  },
  {
    href: '/ecommpanel/admin/users',
    title: 'Gerenciar acessos',
    description: 'Revisar usuários administrativos, papéis e permissões.',
  },
  {
    href: '/ecommpanel/admin/settings/auth',
    title: 'Configurar auth',
    description: 'Ajustar caixa de autenticação, SMTP e políticas de acesso.',
  },
  {
    href: '/ecommpanel/admin/integrations',
    title: 'Abrir integrações',
    description: 'Gerenciar clientes de API, escopos, segredos e contratos autenticados.',
  },
  {
    href: '/ecommpanel/admin/catalog/media',
    title: 'Operar mídia',
    description: 'Enviar imagens, reutilizar assets e revisar processamento.',
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
          <p className="panel-kicker">Admin Builder</p>
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
    <section className="panel-dashboard panel-grid" aria-labelledby="panel-dashboard-title">
      <article className="panel-card panel-card-hero panel-dashboard-hero">
        <div className="panel-dashboard-hero__header">
          <div>
            <p className="panel-kicker">Admin Builder</p>
            <h1 id="panel-dashboard-title">Centro de orquestração da base e da plataforma</h1>
            <p className="panel-muted">
              Esta visão inicial serve para administrar estrutura de dados, autenticação, mídia e integrações do sistema, sem dependência de fluxo comercial.
            </p>
          </div>
          <div className="panel-dashboard-hero__badges">
            <span className="panel-badge panel-badge-success">
              {dashboard.storage.mode === 'external' ? 'runtime externo' : 'runtime interno'}
            </span>
            <span className="panel-badge panel-badge-neutral">{dashboard.user.permissionsCount} permissões ativas</span>
          </div>
        </div>

        <div className="panel-dashboard-hero__meta">
          <div>
            <span className="panel-muted">Operador atual</span>
            <strong>{dashboard.user.name}</strong>
            <span>{dashboard.user.email}</span>
          </div>
          <div>
            <span className="panel-muted">Papéis ativos</span>
            <strong>{dashboard.user.roleIds.length}</strong>
            <span>{dashboard.user.roleIds.map(formatRoleLabel).join(', ')}</span>
          </div>
          <div>
            <span className="panel-muted">Leitura principal do runtime</span>
            <strong>{dashboard.storage.mode === 'external' ? 'Pasta externa' : 'Pasta interna do projeto'}</strong>
            <span>{dashboard.storage.rootPath}</span>
          </div>
        </div>
      </article>

      <div className="panel-stats panel-dashboard-metrics">
        <article className="panel-stat">
          <span className="panel-muted">Usuários ativos</span>
          <strong>{dashboard.users.active}</strong>
          <span>{dashboard.users.total} contas administrativas cadastradas</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Perfis com poder amplo</span>
          <strong>{dashboard.users.privileged}</strong>
          <span>{dashboard.users.editorial} perfis especializados adicionais</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Eventos recentes</span>
          <strong>{dashboard.audit.sampledCount}</strong>
          <span>auditorias registradas nos últimos 7 dias</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Último evento</span>
          <strong>{formatRelativeLabel(dashboard.audit.latest?.createdAt)}</strong>
          <span>{dashboard.audit.latest?.event || 'Sem eventos recentes'}</span>
        </article>
      </div>

      <div className="panel-dashboard-layout">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Base ativa</p>
              <h2>Estado estrutural do admin</h2>
            </div>
            <span className="panel-badge panel-badge-neutral">
              {dashboard.storage.mode === 'external' ? 'projeto isolado' : 'projeto embutido'}
            </span>
          </div>

          <div className="panel-dashboard-list">
            <div className="panel-dashboard-row">
              <strong>Root operacional</strong>
              <span>{dashboard.storage.rootPath}</span>
              <small>É daqui que o sistema lê snapshots, runtime e arquivos publicados.</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Camada dinâmica</strong>
              <span>{dashboard.site.totalPages} rotas internas conhecidas pelo runtime</span>
              <small>{dashboard.site.runtimePagesCount} rotas publicadas atualmente no snapshot ativo.</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Trilha de auditoria</strong>
              <span>{dashboard.audit.sampledCount} eventos recentes</span>
              <small>Último evento em {dashboard.audit.latest?.createdAt || 'não registrado'}.</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Estrutura de usuários</strong>
              <span>{dashboard.users.active} contas ativas e {dashboard.users.privileged} perfis elevados</span>
              <small>Controle de acesso segue papéis + permissões granulares no painel.</small>
            </div>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Fluxos principais</p>
              <h2>Entradas mais úteis do builder</h2>
            </div>
          </div>

          <div className="panel-dashboard-actions">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="panel-dashboard-action">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
