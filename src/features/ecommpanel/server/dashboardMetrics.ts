import 'server-only';

import type { AuthenticatedPanelUser, PanelAuditEvent, PanelRoleId } from '@/features/ecommpanel/types/auth';
import { getSiteBuilderOperationalSummaryRuntime } from '@/features/ecommpanel/server/siteBuilderStore';
import { getStorefrontTemplateRuntime } from '@/features/ecommpanel/server/storefrontTemplateStore';
import { listAuditEvents, listUsers } from '@/features/ecommpanel/server/panelStore';
import { getBlogOperationalSummaryRuntime, readBlogRuntimeManifestRuntime } from '@/features/blog/server/blogStore';
import {
  getPublishedRuntimeContentRoot,
  readPublishedRuntimeManifest,
} from '@/features/site-runtime/server/publishedStore';
import { readPublishedRuntimeStorefrontTemplate } from '@/features/site-runtime/server/publishedTemplateStore';

type DashboardAlertTone = 'info' | 'warning' | 'success';

export type DashboardOperationalAlert = {
  tone: DashboardAlertTone;
  title: string;
  description: string;
};

export type PanelOperationalDashboard = {
  user: {
    id: string;
    name: string;
    email: string;
    roleIds: PanelRoleId[];
    permissionsCount: number;
  };
  storage: {
    rootPath: string;
    mode: 'workspace' | 'external';
  };
  site: Awaited<ReturnType<typeof getSiteBuilderOperationalSummaryRuntime>> & {
    runtimeGeneratedAt?: string;
    runtimePagesCount: number;
    inSync: boolean;
  };
  blog: Awaited<ReturnType<typeof getBlogOperationalSummaryRuntime>> & {
    runtimeGeneratedAt?: string;
    runtimePostsCount: number;
    inSync: boolean;
  };
  template: {
    updatedAt: string;
    publishedAt?: string;
    themePreset: string;
    campaign: string;
    homeOverrideEnabled: boolean;
    homeOverridePageSlug: string;
    hideHeaderOnHomeOverride: boolean;
    hideFooterOnHomeOverride: boolean;
  };
  users: {
    total: number;
    active: number;
    editorial: number;
    privileged: number;
    mustRotatePassword: number;
  };
  audit: {
    sampledCount: number;
    successCount: number;
    failureCount: number;
    latest?: PanelAuditEvent;
    recent: PanelAuditEvent[];
  };
  alerts: DashboardOperationalAlert[];
};

function buildAlerts(input: {
  site: PanelOperationalDashboard['site'];
  blog: PanelOperationalDashboard['blog'];
  template: PanelOperationalDashboard['template'];
  storage: PanelOperationalDashboard['storage'];
  audit: PanelOperationalDashboard['audit'];
}): DashboardOperationalAlert[] {
  const alerts: DashboardOperationalAlert[] = [];

  if (input.storage.mode === 'workspace') {
    alerts.push({
      tone: 'warning',
      title: 'O conteúdo publicado ainda está salvo dentro do app',
      description:
        'Antes de ir para produção, vale mover esse conteúdo para uma pasta fora da aplicação. Isso reduz risco ao atualizar ou reinstalar o projeto.',
    });
  } else {
    alerts.push({
      tone: 'success',
      title: 'O conteúdo publicado já está separado do código',
      description: 'A loja está lendo dados de uma pasta externa, o que deixa atualização, deploy e manutenção mais seguros.',
    });
  }

  if (!input.site.inSync) {
    alerts.push({
      tone: 'warning',
      title: 'As páginas publicadas precisam ser atualizadas',
      description:
        'A quantidade de páginas marcadas como publicadas no painel não bate com o que a loja está lendo. Publique novamente antes de liberar mudanças.',
    });
  }

  if (!input.blog.inSync) {
    alerts.push({
      tone: 'warning',
      title: 'Os posts do blog publicados precisam ser atualizados',
      description:
        'A quantidade de posts marcados como publicados no painel não bate com o que o blog está mostrando. Publique novamente para alinhar o site.',
    });
  }

  if (input.blog.pendingComments > 0) {
    alerts.push({
      tone: 'info',
      title: 'Comentários aguardando moderação',
      description: `${input.blog.pendingComments} comentários ainda estão pendentes e podem exigir triagem editorial antes de ganharem visibilidade pública.`,
    });
  }

  if (input.template.homeOverrideEnabled) {
    alerts.push({
      tone: 'info',
      title: 'A home personalizada da loja está ativa',
      description: `A loja está abrindo pela página "${input.template.homeOverridePageSlug}" em vez da home padrão.`,
    });
  }

  if (input.audit.failureCount > 0) {
    alerts.push({
      tone: 'info',
      title: 'Há ações com erro no histórico recente',
      description: `${input.audit.failureCount} ações com erro apareceram no histórico recente. Vale revisar login, permissões e operações administrativas.`,
    });
  }

  return alerts;
}

export async function getPanelOperationalDashboard(user: AuthenticatedPanelUser): Promise<PanelOperationalDashboard> {
  const contentRoot = getPublishedRuntimeContentRoot();
  const storageMode = process.env.ECOM_CONTENT_PATH?.trim() ? 'external' : 'workspace';
  const siteSummary = await getSiteBuilderOperationalSummaryRuntime();
  const siteManifest = readPublishedRuntimeManifest();
  const blogSummary = await getBlogOperationalSummaryRuntime();
  const blogManifest = await readBlogRuntimeManifestRuntime();
  const template = await getStorefrontTemplateRuntime();
  const publishedTemplate = readPublishedRuntimeStorefrontTemplate();
  const users = await listUsers();
  const auditEvents = await listAuditEvents(24);

  const dashboard: PanelOperationalDashboard = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleIds: user.roleIds,
      permissionsCount: user.permissions.length,
    },
    storage: {
      rootPath: contentRoot,
      mode: storageMode,
    },
    site: {
      ...siteSummary,
      runtimeGeneratedAt: siteManifest?.generatedAt,
      runtimePagesCount: siteManifest?.pagesCount || 0,
      inSync: (siteManifest?.pagesCount || 0) === siteSummary.publishedPages,
    },
    blog: {
      ...blogSummary,
      runtimeGeneratedAt: blogManifest?.generatedAt,
      runtimePostsCount: blogManifest?.postsCount || 0,
      inSync: (blogManifest?.postsCount || 0) === blogSummary.publishedPosts,
    },
    template: {
      updatedAt: template.updatedAt,
      publishedAt: publishedTemplate?.generatedAt,
      themePreset: template.theme.preset,
      campaign: template.theme.campaign,
      homeOverrideEnabled: template.home.override.enabled,
      homeOverridePageSlug: template.home.override.pageSlug,
      hideHeaderOnHomeOverride: template.home.override.hideHeader,
      hideFooterOnHomeOverride: template.home.override.hideFooter,
    },
    users: {
      total: users.length,
      active: users.filter((item) => item.active).length,
      editorial: users.filter((item) =>
        item.roleIds.some((roleId) =>
          ['content_author', 'content_editor', 'content_publisher', 'comment_moderator'].includes(roleId),
        ),
      ).length,
      privileged: users.filter((item) =>
        item.roleIds.some((roleId) =>
          ['main_admin', 'admin', 'store_owner'].includes(roleId),
        ),
      ).length,
      mustRotatePassword: users.filter((item) => item.mustChangePassword).length,
    },
    audit: {
      sampledCount: auditEvents.length,
      successCount: auditEvents.filter((item) => item.outcome === 'success').length,
      failureCount: auditEvents.filter((item) => item.outcome === 'failure').length,
      latest: auditEvents[0],
      recent: auditEvents.slice(0, 6),
    },
    alerts: [],
  };

  dashboard.alerts = buildAlerts({
    site: dashboard.site,
    blog: dashboard.blog,
    template: dashboard.template,
    storage: dashboard.storage,
    audit: dashboard.audit,
  });

  return dashboard;
}
