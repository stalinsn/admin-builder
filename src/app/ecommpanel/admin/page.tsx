import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { getPanelOperationalDashboard } from '@/features/ecommpanel/server/dashboardMetrics';

function formatDateTime(value?: string): string {
  if (!value) return 'Ainda não publicado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

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
    admin: 'admin',
    store_owner: 'dono da loja',
    site_editor: 'editor do site',
    content_author: 'autor',
    content_editor: 'editor de conteúdo',
    content_publisher: 'publicador',
    comment_moderator: 'moderador',
    catalog_manager: 'catálogo',
    logistics_manager: 'logística',
    settings_manager: 'configurações',
    viewer: 'leitura',
  };

  return labels[roleId] || roleId;
}

function formatAuditEventLabel(event: string): string {
  const labels: Record<string, string> = {
    'auth.login': 'Login realizado',
    'auth.login.locked': 'Tentativa de login em conta bloqueada',
    'auth.login.invalid-password': 'Tentativa de login com senha incorreta',
    'auth.logout': 'Logout realizado',
    'auth.forgot-password': 'Pedido de redefinição de senha',
    'auth.reset-password': 'Senha redefinida',
    'user.created': 'Usuário criado',
    'admin.users.create': 'Cadastro de usuário pelo painel',
    'seed.main-user-created': 'Usuário principal criado',
    'seed.store-owner-created': 'Usuário dono da loja criado',
    'seed.editorial-author-created': 'Usuário autor criado',
    'seed.editorial-editor-created': 'Usuário editor criado',
    'seed.editorial-publisher-created': 'Usuário publicador criado',
    'seed.editorial-moderator-created': 'Usuário moderador criado',
  };

  return labels[event] || event.replace(/\./g, ' / ');
}

const QUICK_ACTIONS = [
  {
    href: '/ecommpanel/admin/site/routes',
    title: 'Operar rotas e páginas',
    description: 'Criar, revisar e publicar páginas que entram direto na loja.',
  },
  {
    href: '/ecommpanel/admin/blog',
    title: 'Gerir blog e comentários',
    description: 'Criar posts, revisar conteúdo e moderar comentários.',
  },
  {
    href: '/ecommpanel/admin/site/template/home',
    title: 'Ajustar home da loja',
    description: 'Editar a home padrão ou trocar a entrada principal por uma página publicada.',
  },
  {
    href: '/ecommpanel/admin/analytics',
    title: 'Acompanhar analytics',
    description: 'Ler sessões, buscas, cliques, carrinhos e compras da loja.',
  },
  {
    href: '/ecommpanel/admin/users',
    title: 'Gerenciar usuários',
    description: 'Revisar perfis, acessos e responsabilidades de cada pessoa.',
  },
] as const;

export default async function EcommPanelDashboardPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasPermission(user, 'dashboard.read')) {
    return (
      <section className="panel-dashboard panel-grid" aria-labelledby="panel-dashboard-title">
        <article className="panel-card panel-card-hero">
          <p className="panel-kicker">Painel operacional</p>
          <h1 id="panel-dashboard-title">Acesso restrito ao dashboard</h1>
          <p className="panel-muted">
            Seu perfil está autenticado, mas ainda não tem acesso a esta área. Use as páginas liberadas para o seu perfil ou ajuste os acessos desse usuário.
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
            <p className="panel-kicker">Painel operacional</p>
            <h1 id="panel-dashboard-title">Centro de operação da loja e do conteúdo</h1>
            <p className="panel-muted">
              Esta tela mostra o que já foi publicado, quem está operando o painel e o que precisa de atenção para a loja continuar organizada.
            </p>
          </div>
          <div className="panel-dashboard-hero__badges">
            <span className="panel-badge panel-badge-success">{dashboard.storage.mode === 'external' ? 'conteúdo fora do app' : 'conteúdo dentro do app'}</span>
            <span className="panel-badge panel-badge-neutral">{dashboard.user.permissionsCount} acessos liberados</span>
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
            <span className="panel-muted">Onde a loja lê o conteúdo</span>
            <strong>{dashboard.storage.mode === 'external' ? 'Pasta externa' : 'Pasta interna do projeto'}</strong>
            <span>{dashboard.storage.rootPath}</span>
          </div>
        </div>
      </article>

      <div className="panel-stats panel-dashboard-metrics">
        <article className="panel-stat">
          <span className="panel-muted">Páginas dinâmicas</span>
          <strong>{dashboard.site.publishedPages}</strong>
          <span>{dashboard.site.totalPages} páginas disponíveis no painel</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Blog publicado</span>
          <strong>{dashboard.blog.publishedPosts}</strong>
          <span>{dashboard.blog.pendingComments} comentários aguardando revisão</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Usuários operacionais</span>
          <strong>{dashboard.users.active}</strong>
          <span>{dashboard.users.editorial} pessoas ligadas a conteúdo</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Último evento</span>
          <strong>{formatRelativeLabel(dashboard.audit.latest?.createdAt)}</strong>
          <span>{dashboard.audit.latest ? formatAuditEventLabel(dashboard.audit.latest.event) : 'Sem eventos recentes'}</span>
        </article>
      </div>

      <div className="panel-dashboard-layout">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Publicação</p>
              <h2>O que já está valendo na loja</h2>
            </div>
            <span className={`panel-badge ${dashboard.site.inSync && dashboard.blog.inSync ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
              {dashboard.site.inSync && dashboard.blog.inSync ? 'publicação alinhada' : 'revisão necessária'}
            </span>
          </div>

          <div className="panel-dashboard-list">
            <div className="panel-dashboard-row">
              <strong>Páginas da loja</strong>
              <span>{dashboard.site.runtimePagesCount} já aparecem na versão publicada do site</span>
              <small>{dashboard.site.publishedPages} páginas estão marcadas como publicadas no painel. Última atualização em {formatDateTime(dashboard.site.runtimeGeneratedAt)}</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Blog publicado</strong>
              <span>{dashboard.blog.runtimePostsCount} posts já aparecem no blog da loja</span>
              <small>{dashboard.blog.publishedPosts} posts estão marcados como publicados no painel. Última atualização em {formatDateTime(dashboard.blog.runtimeGeneratedAt)}</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Template da loja</strong>
              <span>Tema {dashboard.template.themePreset} com campanha {dashboard.template.campaign}</span>
              <small>Última edição em {formatDateTime(dashboard.template.updatedAt)} e publicação em {formatDateTime(dashboard.template.publishedAt)}</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Home da loja</strong>
              <span>
                {dashboard.template.homeOverrideEnabled
                  ? `Entrada principal personalizada com a página "${dashboard.template.homeOverridePageSlug}"`
                  : 'A home padrão da loja está em uso'}
              </span>
              <small>
                Topo {dashboard.template.hideHeaderOnHomeOverride ? 'oculto' : 'visível'} • Rodapé {dashboard.template.hideFooterOnHomeOverride ? 'oculto' : 'visível'}
              </small>
            </div>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Fluxos</p>
              <h2>Entradas principais do painel</h2>
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

      <div className="panel-dashboard-layout">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Equipe</p>
              <h2>Pessoas, acesso e responsabilidades</h2>
            </div>
          </div>

          <div className="panel-dashboard-list">
            <div className="panel-dashboard-row">
              <strong>Usuários cadastrados</strong>
              <span>{dashboard.users.total} usuários, sendo {dashboard.users.active} ativos</span>
              <small>{dashboard.users.privileged} com acesso amplo e {dashboard.users.editorial} ligados à operação de conteúdo</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Troca de senha inicial</strong>
              <span>{dashboard.users.mustRotatePassword} usuários ainda precisam definir uma senha própria</span>
              <small>Isso ajuda a separar acessos temporários de acessos realmente assumidos pela equipe</small>
            </div>

            <div className="panel-dashboard-row">
              <strong>Responsáveis pelo blog</strong>
              <span>{dashboard.blog.owners.length} pessoas já têm posts vinculados</span>
              <small>
                {dashboard.blog.owners.length > 0
                  ? dashboard.blog.owners.map((owner) => `${owner.ownerName} (${owner.posts})`).join(' • ')
                  : 'Ainda não há responsáveis definidos nos posts'}
              </small>
            </div>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Atenção</p>
              <h2>Pontos que merecem acompanhamento</h2>
            </div>
          </div>

          <div className="panel-dashboard-alerts">
            {dashboard.alerts.map((alert) => (
              <article key={`${alert.tone}-${alert.title}`} className={`panel-dashboard-alert panel-dashboard-alert--${alert.tone}`}>
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
              </article>
            ))}
          </div>
        </article>
      </div>

      <article className="panel-card panel-dashboard-card">
        <div className="panel-dashboard-card__header">
          <div>
            <p className="panel-kicker">Histórico</p>
            <h2>Ações recentes no painel</h2>
          </div>
          <span className="panel-badge panel-badge-neutral">
            {dashboard.audit.successCount} concluídas • {dashboard.audit.failureCount} com erro
          </span>
        </div>

        <div className="panel-dashboard-list">
          {dashboard.audit.recent.map((event) => (
            <div key={event.id} className="panel-dashboard-row">
              <strong>{formatAuditEventLabel(event.event)}</strong>
              <span>{event.target || event.actorUserId || 'Sem referência direta'}</span>
              <small>{event.outcome === 'success' ? 'Concluída' : 'Com erro'} em {formatDateTime(event.createdAt)}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
