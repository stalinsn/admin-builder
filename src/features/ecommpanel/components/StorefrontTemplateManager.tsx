'use client';

import type { FormEvent, SyntheticEvent } from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  cloneStorefrontTemplate,
  createDefaultStorefrontTemplate,
  type StorefrontFooterModules,
  type StorefrontFooterSection,
  type StorefrontHeaderModules,
  type StorefrontHomeModules,
  type StorefrontServiceItem,
  type StorefrontTemplate,
  type StorefrontTemplateLink,
} from '@/features/site-runtime/storefrontTemplate';
import { countStorefrontThemeOverrides } from '@/features/site-runtime/storefrontTheme';
import {
  StorefrontPublishToolbar,
  type StorefrontToolbarMetric,
  TemplateFeatureToggle,
  TemplateStaticRow,
  TemplateToggleRow,
  formatStorefrontTemplateDate,
} from './storefrontTemplateUi';
import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';

type MeResponse = {
  csrfToken?: string;
};

type TemplateResponse = {
  template?: StorefrontTemplate;
  error?: string;
};

type TemplateUiState = {
  expanded: Record<string, boolean>;
};

type SaveState = 'idle' | 'saving' | 'saved';
type TemplateScope = 'all' | 'header' | 'home' | 'footer';
type SidebarStat = {
  label: string;
  value: string;
};
type SidebarConfig = {
  title: string;
  stats: SidebarStat[];
  bullets: string[];
  secondaryTitle: string;
  secondaryText: string[];
};

function countEnabledLinks(links: StorefrontTemplateLink[]): number {
  return links.filter((link) => link.enabled).length;
}

function countEnabledFooterLinks(section: StorefrontFooterSection): number {
  return countEnabledLinks(section.links);
}

const TEMPLATE_UI_STORAGE_KEY = withVersion('ecommpanel.storefront-template.ui', 'v1');

export default function StorefrontTemplateManager({ scope = 'all' }: { scope?: TemplateScope }) {
  const [csrfToken, setCsrfToken] = useState('');
  const [template, setTemplate] = useState<StorefrontTemplate>(() => createDefaultStorefrontTemplate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [uiStateLoaded, setUiStateLoaded] = useState(false);
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeOverrideCount = countStorefrontThemeOverrides(template.theme.overrides);
  const showOverview = scope === 'all';
  const showHeaderCard = scope === 'all' || scope === 'header';
  const showHomeCard = scope === 'all' || scope === 'home';
  const showFooterCard = scope === 'all' || scope === 'footer';
  const enabledUtilLinks = template.header.utilLinks.filter((link) => link.enabled).length;
  const enabledServices = template.home.services.filter((item) => item.enabled).length;
  const enabledStrips = template.home.strips.filter((item) => item.enabled).length;
  const enabledFooterSections = template.footer.sections.filter((section) => section.enabled).length;
  const enabledFooterSocial = template.footer.socialLinks.filter((link) => link.enabled).length;
  const enabledFooterApps = template.footer.appLinks.filter((link) => link.enabled).length;
  const heroCompact = scope !== 'all';
  const headerCardKey = scope === 'header' ? 'card:header:scoped' : 'card:header';
  const homeCardKey = scope === 'home' ? 'card:home:scoped' : 'card:home';
  const footerCardKey = scope === 'footer' ? 'card:footer:scoped' : 'card:footer';
  const headerCardExpanded = isAccordionExpanded(headerCardKey, true);
  const homeCardExpanded = isAccordionExpanded(homeCardKey, true);
  const footerCardExpanded = isAccordionExpanded(footerCardKey, scope === 'footer' ? true : false);

  const scopeConfig: Record<TemplateScope, { kicker: string; title: string; description: string; toolbarTitle: string }> = {
    all: {
      kicker: 'Experiência do Site · Template',
      title: 'Modificadores do template da loja',
      description: 'Ajuste header, home e rodapé em um formato mais operacional, mantendo a loja desacoplada e consumindo apenas JSON publicado.',
      toolbarTitle: 'Header, home, mega menu e footer',
    },
    header: {
      kicker: 'Experiência do Site · Template · Header',
      title: 'Template do header',
      description: 'Edite apenas os campos fixos do topo da loja, incluindo marca, busca, links utilitários e CTA rápido.',
      toolbarTitle: 'Header da loja',
    },
    home: {
      kicker: 'Experiência do Site · Template · Home',
      title: 'Template da home',
      description: 'Edite somente os blocos fixos da home, com hero, vitrines, serviços e faixas clicáveis.',
      toolbarTitle: 'Home da loja',
    },
    footer: {
      kicker: 'Experiência do Site · Template · Footer',
      title: 'Template do footer',
      description: 'Edite a área fixa de rodapé, com colunas, apps, newsletter, redes sociais e copy legal.',
      toolbarTitle: 'Footer da loja',
    },
  };
  const currentScope = scopeConfig[scope];
  const toolbarMetrics: Record<TemplateScope, StorefrontToolbarMetric[]> = {
    all: [
      { label: 'Marca', value: template.brandName },
      { label: 'Header', value: `${enabledUtilLinks} atalhos` },
      { label: 'Home', value: `${enabledServices} serviços` },
      { label: 'Footer', value: `${enabledFooterSections} colunas` },
    ],
    header: [
      { label: 'Marca', value: template.brandName },
      { label: 'Atalhos', value: String(enabledUtilLinks) },
      { label: 'CTA', value: template.header.quickLogin.enabled ? 'ativo' : 'inativo' },
      { label: 'Mega menu', value: template.header.modules.departmentsMenu ? 'ativo' : 'inativo' },
    ],
    home: [
      { label: 'Hero', value: template.home.modules.heroMessage ? 'ativo' : 'inativo' },
      { label: 'Serviços', value: String(enabledServices) },
      { label: 'Faixas', value: String(enabledStrips) },
      { label: 'Home personalizada', value: template.home.override.enabled ? 'ativa' : 'padrão' },
    ],
    footer: [
      { label: 'Colunas', value: String(enabledFooterSections) },
      { label: 'Apps', value: String(enabledFooterApps) },
      { label: 'Social', value: String(enabledFooterSocial) },
      { label: 'Newsletter', value: template.footer.modules.newsletter ? 'ativa' : 'inativa' },
    ],
  };
  const sidebarConfig: Record<TemplateScope, SidebarConfig> = {
    all: {
      title: 'Resumo do template',
      stats: [
        { label: 'Tema', value: template.theme.preset },
        { label: 'Header', value: `${enabledUtilLinks} atalhos` },
        { label: 'Home', value: `${enabledServices} serviços` },
        { label: 'Footer', value: `${enabledFooterSections} colunas` },
      ],
      bullets: [
        'Tema e mega menu seguem em áreas dedicadas do painel.',
        'Header concentra identidade, busca, links e CTA.',
        'Home concentra hero, vitrines, serviços e faixas.',
        'Footer concentra colunas, newsletter, apps e social.',
      ],
      secondaryTitle: 'Fluxo operacional',
      secondaryText: [
        'Esta visão geral existe para revisão rápida do que já foi publicado na loja.',
        'As alterações continuam sendo salvas no mesmo arquivo lido pela parte pública do site.',
      ],
    },
    header: {
      title: 'Resumo do header',
      stats: [
        { label: 'Marca', value: template.brandName },
        { label: 'Atalhos', value: String(enabledUtilLinks) },
        { label: 'Promo', value: template.header.modules.promoBar ? 'ativa' : 'inativa' },
        { label: 'CTA', value: template.header.quickLogin.enabled ? 'ativo' : 'inativo' },
      ],
      bullets: [
        'As cores do topo ficam na área de Tema.',
        'A árvore de departamentos fica na área de Mega Menu.',
        'Os rótulos do header simples continuam aqui porque pertencem ao mesmo bloco fixo.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Use esta página para copy, busca e navegação utilitária do topo.',
        'Se a necessidade for estrutural por categoria, a edição certa é em Mega Menu.',
      ],
    },
    home: {
      title: 'Resumo da home',
      stats: [
        { label: 'Hero', value: template.home.modules.heroMessage ? 'ativo' : 'inativo' },
        { label: 'Serviços', value: String(enabledServices) },
        { label: 'Faixas', value: String(enabledStrips) },
        { label: 'Home personalizada', value: template.home.override.enabled ? template.home.override.pageSlug : 'desligada' },
      ],
      bullets: [
        'As vitrines continuam sendo blocos fixos do template atual.',
        'As flags desta tela controlam presença de hero, vitrines, banner, serviços e faixas.',
        'Agora também é possível transformar a home em uma página publicada, sem trocar o restante da loja.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Esta rota foi isolada para reduzir ruído e concentrar só os blocos fixos da home.',
        'Use a home personalizada apenas quando a entrada principal da loja precisar virar uma landing page; o padrão continua sendo a home normal do e-commerce.',
      ],
    },
    footer: {
      title: 'Resumo do footer',
      stats: [
        { label: 'Colunas', value: String(enabledFooterSections) },
        { label: 'Apps', value: String(enabledFooterApps) },
        { label: 'Social', value: String(enabledFooterSocial) },
        { label: 'Newsletter', value: template.footer.modules.newsletter ? 'ativa' : 'inativa' },
      ],
      bullets: [
        'Footer agrupa colunas institucionais, apps, newsletter e social.',
        'Os toggles desta tela controlam o que o rodapé publica de forma imediata.',
        'O copy legal continua aqui por ser parte fixa do rodapé.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Esta rota é a operação do rodapé fixo da loja.',
        'Se você quiser mais granularidade depois, o próximo corte natural é separar colunas e canais de aquisição.',
      ],
    },
  };

  function updateTemplate(mutator: (draft: StorefrontTemplate) => void) {
    setTemplate((prev) => {
      const next = cloneStorefrontTemplate(prev);
      mutator(next);
      return next;
    });
  }

  async function fetchTemplate() {
    setLoading(true);
    setError(null);

    try {
      const [meReq, templateReq] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/site/template', { cache: 'no-store' }),
      ]);

      const mePayload = (await meReq.json().catch(() => null)) as MeResponse | null;
      const templatePayload = (await templateReq.json().catch(() => null)) as TemplateResponse | null;

      if (mePayload?.csrfToken) setCsrfToken(mePayload.csrfToken);

      if (!templateReq.ok || !templatePayload?.template) {
        setError(templatePayload?.error || 'Não foi possível carregar o template do storefront.');
        return;
      }

      setTemplate(templatePayload.template);
    } catch {
      setError('Erro de rede ao carregar o template do storefront.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTemplate();
  }, []);

  useEffect(() => {
    const uiState = safeJsonGet<TemplateUiState>(TEMPLATE_UI_STORAGE_KEY, { expanded: {} });
    setExpandedSections(uiState.expanded || {});
    setUiStateLoaded(true);
  }, []);

  function setAccordionExpanded(key: string, nextValue: boolean) {
    setExpandedSections((prev) => {
      const next = { ...prev, [key]: nextValue };
      if (uiStateLoaded) {
        safeJsonSet<TemplateUiState>(TEMPLATE_UI_STORAGE_KEY, { expanded: next });
      }
      return next;
    });
  }

  function isAccordionExpanded(key: string, fallback: boolean) {
    return expandedSections[key] ?? fallback;
  }

  function setHeaderModules(mutator: (draft: StorefrontHeaderModules) => void) {
    updateTemplate((draft) => {
      mutator(draft.header.modules);
    });
  }

  function setHomeModules(mutator: (draft: StorefrontHomeModules) => void) {
    updateTemplate((draft) => {
      mutator(draft.home.modules);
    });
  }

  function setFooterModules(mutator: (draft: StorefrontFooterModules) => void) {
    updateTemplate((draft) => {
      mutator(draft.footer.modules);
    });
  }

  function handleAccordionToggle(key: string) {
    return (event: SyntheticEvent<HTMLDetailsElement>) => {
      setAccordionExpanded(key, event.currentTarget.open);
    };
  }

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || saving) return;

    if (saveFeedbackTimeoutRef.current) {
      clearTimeout(saveFeedbackTimeoutRef.current);
      saveFeedbackTimeoutRef.current = null;
    }

    setSaving(true);
    setSaveState('saving');
    setError(null);
    setSuccess(null);

    try {
      const req = await fetch('/api/ecommpanel/site/template', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ template }),
      });

      const payload = (await req.json().catch(() => null)) as TemplateResponse | null;
      if (!req.ok || !payload?.template) {
        setError(payload?.error || 'Não foi possível salvar o template do storefront.');
        setSaveState('idle');
        return;
      }

      setTemplate(payload.template);
      setSaveState('saved');
      setSuccess(`Template publicado às ${formatStorefrontTemplateDate(payload.template.updatedAt)}.`);

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }

      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setSaveState('idle');
        setSuccess(null);
        saveFeedbackTimeoutRef.current = null;
      }, 4200);
    } catch {
      setError('Erro de rede ao salvar o template do storefront.');
      setSaveState('idle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="storefront-template-title">
      <article className={`panel-card panel-card-hero ${heroCompact ? 'panel-card-hero--compact' : ''}`}>
        <p className="panel-kicker">{currentScope.kicker}</p>
        <h1 id="storefront-template-title">{currentScope.title}</h1>
        <p className="panel-muted">
          {currentScope.description}
        </p>
      </article>

      <div className="panel-template-grid">
        <form className="panel-template-form" onSubmit={handleSave}>
          <StorefrontPublishToolbar
            kicker="Template publicado"
            title={currentScope.toolbarTitle}
            updatedAt={template.updatedAt}
            metrics={toolbarMetrics[scope]}
            status={saveState === 'saved' ? 'Publicado agora' : null}
            actions={
              <>
              <button type="button" className="panel-btn panel-btn-secondary" onClick={() => void fetchTemplate()} disabled={loading || saving}>
                Recarregar
              </button>
              <button type="submit" className="panel-btn panel-btn-primary" disabled={loading || saving}>
                {saving ? 'Publicando...' : saveState === 'saved' ? 'Publicado com sucesso' : 'Salvar e publicar template'}
              </button>
              </>
            }
          />

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <div className="panel-template-save-toast" role="status" aria-live="polite">{success}</div> : null}

          {showOverview ? (
          <article className="panel-card panel-template-callout">
            <div>
              <p className="panel-kicker">Tema</p>
              <strong>{themeOverrideCount} ajustes finos ativos</strong>
              <p className="panel-muted">
                O preset visual, a campanha e as cores de sobreposição agora ficam em uma área dedicada do menu principal.
              </p>
            </div>
            <Link href="/ecommpanel/admin/site/theme" className="panel-btn panel-btn-secondary">
              Abrir editor de tema
            </Link>
          </article>
          ) : null}

          {showHeaderCard ? (
          <details
            className="panel-card panel-template-card panel-template-card--accordion"
            open={headerCardExpanded}
            onToggle={handleAccordionToggle(headerCardKey)}
          >
            <summary className="panel-template-card__summary" aria-expanded={headerCardExpanded}>
              <div className="panel-template-card__summary-main">
                <div className="panel-template-card__header">
                  <div>
                    <p className="panel-kicker">Header</p>
                    <h2>Marca e navegação</h2>
                    <p className="panel-muted">Campos estruturais do topo da loja, busca, textos base e atalhos rápidos.</p>
                  </div>
                  <div className="panel-template-card__aside">
                    <div className="panel-template-card__meta">
                      <span className="panel-badge panel-badge-neutral">
                        mega menu: {template.header.modules.departmentsMenu ? 'ativo' : 'inativo'}
                      </span>
                      <span className="panel-badge panel-badge-success">
                        {template.header.utilLinks.filter((link) => link.enabled).length} atalhos ativos
                      </span>
                    </div>
                    <div className="panel-template-card__controls">
                      <TemplateFeatureToggle
                        text={template.header.modules.enabled ? 'Ativo' : 'Inativo'}
                        enabled={template.header.modules.enabled}
                        ariaLabel={template.header.modules.enabled ? 'Desativar header da loja' : 'Ativar header da loja'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.enabled = nextValue;
                        })}
                      />
                      <span className="panel-accordion-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </summary>

            <div className="panel-template-card__body">
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Entrada principal</p>
                    <h3 className="panel-template-subsection__title">Usar página publicada como home</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">
                      Use uma página já publicada quando a entrada principal da loja precisar funcionar como landing page ou campanha.
                    </p>
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text={template.home.override.enabled ? 'Home personalizada ativa' : 'Home personalizada desligada'}
                        compact
                        enabled={template.home.override.enabled}
                        ariaLabel={template.home.override.enabled ? 'Desativar home personalizada' : 'Ativar home personalizada'}
                        onToggle={(nextValue) => updateTemplate((draft) => {
                          draft.home.override.enabled = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-callout panel-template-callout--inline">
                  <div>
                    <strong>Página usada como entrada principal</strong>
                    <p className="panel-muted">
                      Quando esta opção estiver ativa, a loja passa a abrir pela página informada abaixo.
                    </p>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-home-override-slug">Slug da página publicada</label>
                    <input
                      id="template-home-override-slug"
                      className="panel-input"
                      value={template.home.override.pageSlug}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.override.pageSlug = event.target.value;
                      })}
                      placeholder="home-campanha"
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-home-override-header">Topo na home personalizada</label>
                    <select
                      id="template-home-override-header"
                      className="panel-input"
                      value={template.home.override.hideHeader ? 'hidden' : 'visible'}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.override.hideHeader = event.target.value === 'hidden';
                      })}
                    >
                      <option value="visible">Manter header</option>
                      <option value="hidden">Ocultar header</option>
                    </select>
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-home-override-footer">Rodapé na home personalizada</label>
                    <select
                      id="template-home-override-footer"
                      className="panel-input"
                      value={template.home.override.hideFooter ? 'hidden' : 'visible'}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.override.hideFooter = event.target.value === 'hidden';
                      })}
                    >
                      <option value="visible">Manter footer</option>
                      <option value="hidden">Ocultar footer</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Base</p>
                    <h3 className="panel-template-subsection__title">Identidade e copy</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Textos globais usados no header normal e no header simples. A navegação de departamentos foi movida para uma área dedicada.</p>
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Promo"
                        compact
                        enabled={template.header.modules.promoBar}
                        ariaLabel={template.header.modules.promoBar ? 'Desativar barra promocional do header' : 'Ativar barra promocional do header'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.promoBar = nextValue;
                        })}
                      />
                      <TemplateFeatureToggle
                        text="Meta"
                        compact
                        enabled={template.header.modules.navMeta}
                        ariaLabel={template.header.modules.navMeta ? 'Desativar texto meta da navegação' : 'Ativar texto meta da navegação'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.navMeta = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-brand-name">Nome da marca</label>
                    <input
                      id="template-brand-name"
                      className="panel-input"
                      value={template.brandName}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.brandName = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-header-promo">Texto promocional</label>
                    <input
                      id="template-header-promo"
                      className="panel-input"
                      value={template.header.promoText}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.promoText = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-header-search">Placeholder da busca</label>
                    <input
                      id="template-header-search"
                      className="panel-input"
                      value={template.header.searchPlaceholder}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.searchPlaceholder = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-header-meta">Texto da navegação meta</label>
                    <input
                      id="template-header-meta"
                      className="panel-input"
                      value={template.header.navMetaText}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.navMetaText = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-header-simple-home">Label do header simples: home</label>
                    <input
                      id="template-header-simple-home"
                      className="panel-input"
                      value={template.header.simpleHomeLabel}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.simpleHomeLabel = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-header-simple-cart">Label do header simples: carrinho</label>
                    <input
                      id="template-header-simple-cart"
                      className="panel-input"
                      value={template.header.simpleCartLabel}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.simpleCartLabel = event.target.value;
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Atalhos</p>
                    <h3 className="panel-template-subsection__title">Links utilitários e CTA</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Organize a navegação de apoio do topo sem abrir uma lista longa desestruturada.</p>
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Links"
                        compact
                        enabled={template.header.modules.utilLinks}
                        ariaLabel={template.header.modules.utilLinks ? 'Desativar links utilitários do header' : 'Ativar links utilitários do header'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.utilLinks = nextValue;
                        })}
                      />
                      <TemplateFeatureToggle
                        text="CTA"
                        compact
                        enabled={template.header.modules.quickLogin}
                        ariaLabel={template.header.modules.quickLogin ? 'Desativar CTA rápido do header' : 'Ativar CTA rápido do header'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.quickLogin = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.header.utilLinks.map((link, index) => (
                    <TemplateToggleRow
                      key={link.id}
                      label={link.label || `Link ${index + 1}`}
                      checked={link.enabled}
                      hint="Link utilitário"
                      onToggle={(checked) => updateTemplate((draft) => {
                        draft.header.utilLinks[index].enabled = checked;
                      })}
                      primary={
                        <input
                          className="panel-input"
                          value={link.label}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.header.utilLinks[index].label = event.target.value;
                          })}
                          placeholder="Label"
                        />
                      }
                      secondary={
                        <input
                          className="panel-input"
                          value={link.href}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.header.utilLinks[index].href = event.target.value;
                          })}
                          placeholder="/e-commerce/alguma-rota"
                        />
                      }
                    />
                  ))}

                  <TemplateToggleRow
                    label={template.header.quickLogin.label || 'CTA rápido'}
                    checked={template.header.quickLogin.enabled}
                    hint="Botão destacado do header"
                    onToggle={(checked) => updateTemplate((draft) => {
                      draft.header.quickLogin.enabled = checked;
                    })}
                    primary={
                      <input
                        className="panel-input"
                        value={template.header.quickLogin.label}
                        onChange={(event) => updateTemplate((draft) => {
                          draft.header.quickLogin.label = event.target.value;
                        })}
                        placeholder="Login"
                      />
                    }
                    secondary={
                      <input
                        className="panel-input"
                        value={template.header.quickLogin.href}
                        onChange={(event) => updateTemplate((draft) => {
                          draft.header.quickLogin.href = event.target.value;
                        })}
                        placeholder="/ecommpanel/login"
                      />
                    }
                  />
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Estrutura</p>
                    <h3 className="panel-template-subsection__title">Editor dedicado do mega menu</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Separado do template principal para evoluir depois com árvore de categorias externa, sem misturar isso com copy e tema.</p>
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Departamentos"
                        compact
                        enabled={template.header.modules.departmentsMenu}
                        ariaLabel={template.header.modules.departmentsMenu ? 'Desativar mega menu de departamentos' : 'Ativar mega menu de departamentos'}
                        onToggle={(nextValue) => setHeaderModules((draft) => {
                          draft.departmentsMenu = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-callout">
                  <div>
                    <strong>{template.header.departmentsMenu.filter((category) => category.enabled).length} departamentos ativos</strong>
                    <p className="panel-muted">
                      O botão, a hierarquia e os links do mega menu agora ficam em uma página dedicada do admin.
                    </p>
                  </div>
                  <Link href="/ecommpanel/admin/site/mega-menu" className="panel-btn panel-btn-secondary">
                    Abrir editor do mega menu
                  </Link>
                </div>
              </section>
            </div>
          </details>
          ) : null}

          {showHomeCard ? (
          <details
            className="panel-card panel-template-card panel-template-card--accordion"
            open={homeCardExpanded}
            onToggle={handleAccordionToggle(homeCardKey)}
          >
            <summary className="panel-template-card__summary" aria-expanded={homeCardExpanded}>
              <div className="panel-template-card__summary-main">
                <div className="panel-template-card__header">
                  <div>
                    <p className="panel-kicker">Home</p>
                    <h2>Mensagem, vitrines e destaques</h2>
                    <p className="panel-muted">Ajustes de copy e links principais das áreas estáticas da home.</p>
                  </div>
                  <div className="panel-template-card__aside">
                    <div className="panel-template-card__meta">
                      <span className="panel-badge panel-badge-success">
                        {template.home.services.filter((item) => item.enabled).length} serviços ativos
                      </span>
                      <span className="panel-badge panel-badge-neutral">
                        {template.home.strips.filter((item) => item.enabled).length} faixas visíveis
                      </span>
                    </div>
                    <div className="panel-template-card__controls">
                      <TemplateFeatureToggle
                        text={template.home.modules.enabled ? 'Ativo' : 'Inativo'}
                        enabled={template.home.modules.enabled}
                        ariaLabel={template.home.modules.enabled ? 'Desativar módulos da home' : 'Ativar módulos da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.enabled = nextValue;
                        })}
                      />
                      <span className="panel-accordion-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </summary>

            <div className="panel-template-card__body">
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Conteúdo</p>
                    <h3 className="panel-template-subsection__title">Mensagens principais</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Hero"
                        compact
                        enabled={template.home.modules.heroMessage}
                        ariaLabel={template.home.modules.heroMessage ? 'Desativar mensagem principal da home' : 'Ativar mensagem principal da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.heroMessage = nextValue;
                        })}
                      />
                      <TemplateFeatureToggle
                        text="Vitrine dia"
                        compact
                        enabled={template.home.modules.showcaseDaily}
                        ariaLabel={template.home.modules.showcaseDaily ? 'Desativar vitrine diária da home' : 'Ativar vitrine diária da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.showcaseDaily = nextValue;
                        })}
                      />
                      <TemplateFeatureToggle
                        text="Vitrine despensa"
                        compact
                        enabled={template.home.modules.showcaseGrocery}
                        ariaLabel={template.home.modules.showcaseGrocery ? 'Desativar vitrine de despensa da home' : 'Ativar vitrine de despensa da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.showcaseGrocery = nextValue;
                        })}
                      />
                      <TemplateFeatureToggle
                        text="Banner"
                        compact
                        enabled={template.home.modules.largeBanner}
                        ariaLabel={template.home.modules.largeBanner ? 'Desativar banner grande da home' : 'Ativar banner grande da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.largeBanner = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-home-hero">Mensagem do hero principal</label>
                    <input
                      id="template-home-hero"
                      className="panel-input"
                      value={template.home.heroMessage}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.heroMessage = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-home-daily">Título da vitrine diária</label>
                    <input
                      id="template-home-daily"
                      className="panel-input"
                      value={template.home.dailyShowcaseTitle}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.dailyShowcaseTitle = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-home-grocery">Título da vitrine de despensa</label>
                    <input
                      id="template-home-grocery"
                      className="panel-input"
                      value={template.home.groceryShowcaseTitle}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.groceryShowcaseTitle = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-home-banner">Texto do banner grande</label>
                    <input
                      id="template-home-banner"
                      className="panel-input"
                      value={template.home.largeBannerText}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.home.largeBannerText = event.target.value;
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Pílulas</p>
                    <h3 className="panel-template-subsection__title">Serviços em destaque</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">{template.home.services.filter((item) => item.enabled).length} itens ativos</p>
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Serviços"
                        compact
                        enabled={template.home.modules.services}
                        ariaLabel={template.home.modules.services ? 'Desativar barra de serviços da home' : 'Ativar barra de serviços da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.services = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.home.services.map((service: StorefrontServiceItem, index) => (
                    <TemplateToggleRow
                      key={service.id}
                      label={service.label || `Serviço ${index + 1}`}
                      checked={service.enabled}
                      hint="Item da barra de serviços"
                      onToggle={(checked) => updateTemplate((draft) => {
                        draft.home.services[index].enabled = checked;
                      })}
                      primary={
                        <input
                          className="panel-input"
                          value={service.icon}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.home.services[index].icon = event.target.value;
                          })}
                          placeholder="⏰"
                        />
                      }
                      secondary={
                        <input
                          className="panel-input"
                          value={service.label}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.home.services[index].label = event.target.value;
                          })}
                          placeholder="Agende dia e hora"
                        />
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Faixas</p>
                    <h3 className="panel-template-subsection__title">Destaques clicáveis</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Faixas"
                        compact
                        enabled={template.home.modules.strips}
                        ariaLabel={template.home.modules.strips ? 'Desativar faixas clicáveis da home' : 'Ativar faixas clicáveis da home'}
                        onToggle={(nextValue) => setHomeModules((draft) => {
                          draft.strips = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.home.strips.map((strip, index) => (
                    <TemplateToggleRow
                      key={strip.id}
                      label={strip.label || `Faixa ${index + 1}`}
                      checked={strip.enabled}
                      hint="Faixa promocional"
                      onToggle={(checked) => updateTemplate((draft) => {
                        draft.home.strips[index].enabled = checked;
                      })}
                      primary={
                        <input
                          className="panel-input"
                          value={strip.label}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.home.strips[index].label = event.target.value;
                          })}
                          placeholder="Faixa promocional"
                        />
                      }
                      secondary={
                        <input
                          className="panel-input"
                          value={strip.href}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.home.strips[index].href = event.target.value;
                          })}
                          placeholder="/e-commerce/ofertas"
                        />
                      }
                    />
                  ))}
                </div>
              </section>
            </div>
          </details>
          ) : null}

          {showFooterCard ? (
          <details
            className="panel-card panel-template-card panel-template-card--accordion"
            open={footerCardExpanded}
            onToggle={handleAccordionToggle(footerCardKey)}
          >
            <summary className="panel-template-card__summary" aria-expanded={footerCardExpanded}>
              <div className="panel-template-card__summary-main">
                <div className="panel-template-card__header">
                  <div>
                    <p className="panel-kicker">Footer</p>
                    <h2>Colunas, apps, newsletter e social</h2>
                    <p className="panel-muted">Rodapé editável com agrupamento visual mais enxuto e fácil de revisar.</p>
                  </div>
                  <div className="panel-template-card__aside">
                    <div className="panel-template-card__meta">
                      <span className="panel-badge panel-badge-success">
                        {template.footer.sections.filter((section) => section.enabled).length} colunas ativas
                      </span>
                      <span className="panel-badge panel-badge-neutral">
                        {template.footer.socialLinks.filter((link) => link.enabled).length} redes ativas
                      </span>
                    </div>
                    <div className="panel-template-card__controls">
                      <TemplateFeatureToggle
                        text={template.footer.modules.enabled ? 'Ativo' : 'Inativo'}
                        enabled={template.footer.modules.enabled}
                        ariaLabel={template.footer.modules.enabled ? 'Desativar footer da loja' : 'Ativar footer da loja'}
                        onToggle={(nextValue) => setFooterModules((draft) => {
                          draft.enabled = nextValue;
                        })}
                      />
                      <span className="panel-accordion-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </summary>

            <div className="panel-template-card__body">
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Colunas</p>
                    <h3 className="panel-template-subsection__title">Seções do rodapé</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Colunas"
                        compact
                        enabled={template.footer.modules.columns}
                        ariaLabel={template.footer.modules.columns ? 'Desativar colunas do footer' : 'Ativar colunas do footer'}
                        onToggle={(nextValue) => setFooterModules((draft) => {
                          draft.columns = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.footer.sections.map((section: StorefrontFooterSection, sectionIndex) => (
                    <details
                      key={section.id}
                      className="panel-layer-item panel-template-accordion"
                      open={isAccordionExpanded(`footer:${section.id}`, sectionIndex === 0)}
                      onToggle={handleAccordionToggle(`footer:${section.id}`)}
                    >
                      <summary aria-expanded={isAccordionExpanded(`footer:${section.id}`, sectionIndex === 0)}>
                        <div className="panel-template-accordion__summary">
                          <strong className="panel-template-accordion__title">{section.title}</strong>
                          <span className="panel-template-accordion__hint">
                            {countEnabledFooterLinks(section)} links ativos
                          </span>
                        </div>
                        <span className={`panel-badge ${section.enabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {section.enabled ? 'Ativa' : 'Oculta'}
                        </span>
                      </summary>

                      <div className="panel-template-accordion__body">
                        <TemplateToggleRow
                          label="Seção"
                          checked={section.enabled}
                          hint="Exibição da coluna"
                          onToggle={(checked) => updateTemplate((draft) => {
                            draft.footer.sections[sectionIndex].enabled = checked;
                          })}
                          primary={
                            <input
                              className="panel-input"
                              value={section.title}
                              onChange={(event) => updateTemplate((draft) => {
                                draft.footer.sections[sectionIndex].title = event.target.value;
                              })}
                              placeholder="Título da seção"
                            />
                          }
                        />

                        <div className="panel-template-list">
                          {section.links.map((link, linkIndex) => (
                            <TemplateToggleRow
                              key={link.id}
                              label={link.label || `Link ${linkIndex + 1}`}
                              checked={link.enabled}
                              hint="Link da coluna"
                              nested
                              onToggle={(checked) => updateTemplate((draft) => {
                                draft.footer.sections[sectionIndex].links[linkIndex].enabled = checked;
                              })}
                              primary={
                                <input
                                  className="panel-input"
                                  value={link.label}
                                  onChange={(event) => updateTemplate((draft) => {
                                    draft.footer.sections[sectionIndex].links[linkIndex].label = event.target.value;
                                  })}
                                  placeholder="Label"
                                />
                              }
                              secondary={
                                <input
                                  className="panel-input"
                                  value={link.href}
                                  onChange={(event) => updateTemplate((draft) => {
                                    draft.footer.sections[sectionIndex].links[linkIndex].href = event.target.value;
                                  })}
                                  placeholder="/e-commerce/alguma-rota"
                                />
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Meta</p>
                    <h3 className="panel-template-subsection__title">Apps, newsletter e texto legal</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Newsletter"
                        compact
                        enabled={template.footer.modules.newsletter}
                        ariaLabel={template.footer.modules.newsletter ? 'Desativar newsletter do footer' : 'Ativar newsletter do footer'}
                        onToggle={(nextValue) => setFooterModules((draft) => {
                          draft.newsletter = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-footer-app-title">Título dos apps</label>
                    <input
                      id="template-footer-app-title"
                      className="panel-input"
                      value={template.footer.appTitle}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.footer.appTitle = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-footer-news-title">Título da newsletter</label>
                    <input
                      id="template-footer-news-title"
                      className="panel-input"
                      value={template.footer.newsletterTitle}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.footer.newsletterTitle = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-footer-news-placeholder">Placeholder da newsletter</label>
                    <input
                      id="template-footer-news-placeholder"
                      className="panel-input"
                      value={template.footer.newsletterPlaceholder}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.footer.newsletterPlaceholder = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-footer-news-button">CTA da newsletter</label>
                    <input
                      id="template-footer-news-button"
                      className="panel-input"
                      value={template.footer.newsletterButtonLabel}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.footer.newsletterButtonLabel = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field panel-template-field-full">
                    <label htmlFor="template-footer-copy">Texto legal do rodapé</label>
                    <input
                      id="template-footer-copy"
                      className="panel-input"
                      value={template.footer.copyrightText}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.footer.copyrightText = event.target.value;
                      })}
                    />
                  </div>
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Apps</p>
                    <h3 className="panel-template-subsection__title">Links de instalação</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Apps"
                        compact
                        enabled={template.footer.modules.apps}
                        ariaLabel={template.footer.modules.apps ? 'Desativar links de aplicativos do footer' : 'Ativar links de aplicativos do footer'}
                        onToggle={(nextValue) => setFooterModules((draft) => {
                          draft.apps = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.footer.appLinks.map((link, index) => (
                    <TemplateToggleRow
                      key={link.id}
                      label={link.label || `App ${index + 1}`}
                      checked={link.enabled}
                      hint="Link de loja"
                      onToggle={(checked) => updateTemplate((draft) => {
                        draft.footer.appLinks[index].enabled = checked;
                      })}
                      primary={
                        <input
                          className="panel-input"
                          value={link.label}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.footer.appLinks[index].label = event.target.value;
                          })}
                          placeholder="Label"
                        />
                      }
                      secondary={
                        <input
                          className="panel-input"
                          value={link.href}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.footer.appLinks[index].href = event.target.value;
                          })}
                          placeholder="#"
                        />
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Social</p>
                    <h3 className="panel-template-subsection__title">Redes sociais</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <div className="panel-template-subsection__actions">
                      <TemplateFeatureToggle
                        text="Social"
                        compact
                        enabled={template.footer.modules.social}
                        ariaLabel={template.footer.modules.social ? 'Desativar links sociais do footer' : 'Ativar links sociais do footer'}
                        onToggle={(nextValue) => setFooterModules((draft) => {
                          draft.social = nextValue;
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.footer.socialLinks.map((link, index) => (
                    <TemplateToggleRow
                      key={link.id}
                      label={link.label || `Rede ${index + 1}`}
                      checked={link.enabled}
                      hint="Atalho social"
                      onToggle={(checked) => updateTemplate((draft) => {
                        draft.footer.socialLinks[index].enabled = checked;
                      })}
                      primary={
                        <input
                          className="panel-input"
                          value={link.label}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.footer.socialLinks[index].label = event.target.value;
                          })}
                          placeholder="IG"
                        />
                      }
                      secondary={
                        <input
                          className="panel-input"
                          value={link.href}
                          onChange={(event) => updateTemplate((draft) => {
                            draft.footer.socialLinks[index].href = event.target.value;
                          })}
                          placeholder="#"
                        />
                      }
                    />
                  ))}
                </div>
              </section>
            </div>
          </details>
          ) : null}
        </form>

        <aside className="panel-grid">
          <article className="panel-card panel-template-sidebar">
            <h2>{sidebarConfig[scope].title}</h2>
            <div className="panel-stats">
              {sidebarConfig[scope].stats.map((stat) => (
                <div key={stat.label} className="panel-stat">
                  <span className="panel-muted">{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <ul className="panel-layer-list">
              {sidebarConfig[scope].bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="panel-card">
            <h2>{sidebarConfig[scope].secondaryTitle}</h2>
            {sidebarConfig[scope].secondaryText.map((paragraph) => (
              <p key={paragraph} className="panel-muted">
                {paragraph}
              </p>
            ))}
          </article>
        </aside>
      </div>
    </section>
  );
}
