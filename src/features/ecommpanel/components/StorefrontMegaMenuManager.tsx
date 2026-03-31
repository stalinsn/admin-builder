'use client';

import type { FormEvent, SyntheticEvent } from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  cloneStorefrontTemplate,
  createDefaultStorefrontTemplate,
  type StorefrontDepartmentCategory,
  type StorefrontTemplate,
  type StorefrontTemplateLink,
} from '@/features/site-runtime/storefrontTemplate';
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

type MegaMenuUiState = {
  expanded: Record<string, boolean>;
};

type SaveState = 'idle' | 'saving' | 'saved';
type MegaMenuScope = 'all' | 'base' | 'tree';
type MegaMenuSidebarStat = {
  label: string;
  value: string;
};
type MegaMenuSidebarConfig = {
  title: string;
  stats: MegaMenuSidebarStat[];
  bullets: string[];
  secondaryTitle: string;
  secondaryText: string[];
};

const MEGA_MENU_UI_STORAGE_KEY = withVersion('ecommpanel.storefront-mega-menu.ui', 'v1');

function countEnabledLinks(links: StorefrontTemplateLink[]): number {
  return links.filter((link) => link.enabled).length;
}

function countEnabledDepartmentLinks(category: StorefrontDepartmentCategory): number {
  return category.sections.reduce((total, section) => total + countEnabledLinks(section.links), 0);
}

export default function StorefrontMegaMenuManager({ scope = 'all' }: { scope?: MegaMenuScope }) {
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
  const enabledDepartments = template.header.departmentsMenu.filter((category) => category.enabled).length;
  const totalSections = template.header.departmentsMenu.reduce((total, category) => total + category.sections.length, 0);
  const publishedLinks = template.header.departmentsMenu.reduce((total, category) => total + countEnabledDepartmentLinks(category), 0);
  const showBaseSection = scope === 'all' || scope === 'base';
  const showTreeSection = scope === 'all' || scope === 'tree';
  const heroCompact = scope !== 'all';
  const megaMenuCardKey = scope === 'all' ? 'card:mega-menu' : `card:mega-menu:${scope}`;
  const megaMenuCardExpanded = isAccordionExpanded(megaMenuCardKey, true);
  const scopeConfig: Record<MegaMenuScope, { kicker: string; title: string; description: string; toolbarTitle: string }> = {
    all: {
      kicker: 'Experiência do Site · Mega Menu',
      title: 'Departamentos e navegação estrutural',
      description: 'Esta área concentra a hierarquia do menu de departamentos para permitir evolução futura com árvore externa de categorias, sem acoplar isso ao restante do template.',
      toolbarTitle: 'Botão de departamentos, grupos e colunas',
    },
    base: {
      kicker: 'Experiência do Site · Mega Menu · Base',
      title: 'Base estrutural do mega menu',
      description: 'Edite apenas o gatilho, o estado operacional e o contexto fixo do dropdown de departamentos.',
      toolbarTitle: 'Base do mega menu',
    },
    tree: {
      kicker: 'Experiência do Site · Mega Menu · Árvore',
      title: 'Árvore de departamentos e seções',
      description: 'Edite somente a hierarquia publicada, já preparada para futura troca por uma fonte externa de categorias.',
      toolbarTitle: 'Árvore do mega menu',
    },
  };
  const currentScope = scopeConfig[scope];
  const toolbarMetrics: Record<MegaMenuScope, StorefrontToolbarMetric[]> = {
    all: [
      { label: 'Estado', value: template.header.modules.departmentsMenu ? 'ativo' : 'inativo' },
      { label: 'Botão', value: template.header.departmentsButtonLabel },
      { label: 'Departamentos', value: `${enabledDepartments}/${template.header.departmentsMenu.length}` },
      { label: 'Links', value: String(publishedLinks) },
    ],
    base: [
      { label: 'Estado', value: template.header.modules.departmentsMenu ? 'ativo' : 'inativo' },
      { label: 'Botão', value: template.header.departmentsButtonLabel },
      { label: 'Departamentos', value: String(enabledDepartments) },
      { label: 'Links', value: String(publishedLinks) },
    ],
    tree: [
      { label: 'Departamentos', value: `${enabledDepartments}/${template.header.departmentsMenu.length}` },
      { label: 'Seções', value: String(totalSections) },
      { label: 'Links', value: String(publishedLinks) },
      { label: 'Estado', value: template.header.modules.departmentsMenu ? 'ativo' : 'inativo' },
    ],
  };
  const sidebarConfig: Record<MegaMenuScope, MegaMenuSidebarConfig> = {
    all: {
      title: 'Resumo do mega menu',
      stats: [
        { label: 'Botão do menu', value: template.header.departmentsButtonLabel },
        { label: 'Departamentos ativos', value: String(enabledDepartments) },
        { label: 'Seções totais', value: String(totalSections) },
        { label: 'Links publicados', value: String(publishedLinks) },
      ],
      bullets: [
        'Estrutura isolada do restante do template.',
        'Mesmo fluxo de publicação usado nas outras partes fixas da loja.',
        'Preparado para futura troca por árvore externa de categorias.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Esta rota existe para operação estrutural do menu desktop/mobile sem poluir a edição de header.',
        'O próximo passo natural daqui é permitir adicionar e remover departamentos, ou ligar esta tela a um catálogo externo sem quebrar a loja.',
      ],
    },
    base: {
      title: 'Resumo da base',
      stats: [
        { label: 'Estado', value: template.header.modules.departmentsMenu ? 'ativo' : 'inativo' },
        { label: 'Botão', value: template.header.departmentsButtonLabel },
        { label: 'Departamentos', value: String(enabledDepartments) },
        { label: 'Links', value: String(publishedLinks) },
      ],
      bullets: [
        'Esta rota concentra só o gatilho e o contexto fixo do mega menu.',
        'A árvore de categorias continua separada para não misturar copy com estrutura.',
        'Boa para ajustes rápidos no header sem abrir a hierarquia completa.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Use esta rota quando a mudança for apenas no botão ou no estado de publicação do mega menu.',
        'Se a necessidade for mexer em departamentos, seções ou links, a rota correta é Árvore.',
      ],
    },
    tree: {
      title: 'Resumo da árvore',
      stats: [
        { label: 'Departamentos ativos', value: String(enabledDepartments) },
        { label: 'Seções totais', value: String(totalSections) },
        { label: 'Links publicados', value: String(publishedLinks) },
        { label: 'Botão', value: template.header.departmentsButtonLabel },
      ],
      bullets: [
        'A estrutura publicada continua em JSON, já organizada para uma futura API.',
        'Cada departamento expande para suas seções e links no dropdown da loja.',
        'Boa para revisão estrutural sem ruído do restante do template.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Esta rota existe para concentrar a árvore inteira do mega menu em uma tela dedicada.',
        'Quando o catálogo remoto entrar, esta será a área natural para alternar entre fonte local e integração externa.',
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
        setError(templatePayload?.error || 'Não foi possível carregar o mega menu publicado.');
        return;
      }

      setTemplate(templatePayload.template);
    } catch {
      setError('Erro de rede ao carregar o mega menu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTemplate();
  }, []);

  useEffect(() => {
    const uiState = safeJsonGet<MegaMenuUiState>(MEGA_MENU_UI_STORAGE_KEY, { expanded: {} });
    setExpandedSections(uiState.expanded || {});
    setUiStateLoaded(true);
  }, []);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }
    };
  }, []);

  function setAccordionExpanded(key: string, nextValue: boolean) {
    setExpandedSections((prev) => {
      const next = { ...prev, [key]: nextValue };
      if (uiStateLoaded) {
        safeJsonSet<MegaMenuUiState>(MEGA_MENU_UI_STORAGE_KEY, { expanded: next });
      }
      return next;
    });
  }

  function isAccordionExpanded(key: string, fallback: boolean) {
    return expandedSections[key] ?? fallback;
  }

  function handleAccordionToggle(key: string) {
    return (event: SyntheticEvent<HTMLDetailsElement>) => {
      setAccordionExpanded(key, event.currentTarget.open);
    };
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setError('Token CSRF ausente. Recarregue a página.');
      return;
    }

    setSaving(true);
    setSaveState('saving');
    setError(null);

    try {
      const req = await fetch('/api/ecommpanel/site/template', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ template }),
      });

      const payload = (await req.json().catch(() => null)) as TemplateResponse | null;

      if (!req.ok || !payload?.template) {
        setError(payload?.error || 'Não foi possível salvar o mega menu.');
        setSaveState('idle');
        return;
      }

      setTemplate(payload.template);
      setSaveState('saved');
      setSuccess(`Mega menu publicado às ${formatStorefrontTemplateDate(payload.template.updatedAt)}.`);

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }

      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setSaveState('idle');
        setSuccess(null);
        saveFeedbackTimeoutRef.current = null;
      }, 4200);
    } catch {
      setError('Erro de rede ao salvar o mega menu.');
      setSaveState('idle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="storefront-mega-menu-title">
      <article className={`panel-card panel-card-hero ${heroCompact ? 'panel-card-hero--compact' : ''}`}>
        <p className="panel-kicker">{currentScope.kicker}</p>
        <h1 id="storefront-mega-menu-title">{currentScope.title}</h1>
        <p className="panel-muted">{currentScope.description}</p>
      </article>

      <div className="panel-template-grid">
        <form className="panel-template-form" onSubmit={handleSave}>
          <StorefrontPublishToolbar
            kicker="Mega menu publicado"
            title={currentScope.toolbarTitle}
            updatedAt={template.updatedAt}
            metrics={toolbarMetrics[scope]}
            status={saveState === 'saved' ? 'Publicado agora' : null}
            actions={
              <>
              {scope !== 'all' ? (
                <Link href="/ecommpanel/admin/site/mega-menu" className="panel-btn panel-btn-secondary">
                  Visão geral do mega menu
                </Link>
              ) : (
                <Link href="/ecommpanel/admin/site/template/header" className="panel-btn panel-btn-secondary">
                  Abrir header
                </Link>
              )}
              <button type="button" className="panel-btn panel-btn-secondary" onClick={() => void fetchTemplate()} disabled={loading || saving}>
                Recarregar
              </button>
              <button type="submit" className="panel-btn panel-btn-primary" disabled={loading || saving}>
                {saving ? 'Publicando...' : saveState === 'saved' ? 'Publicado com sucesso' : 'Salvar e publicar mega menu'}
              </button>
              </>
            }
          />

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <div className="panel-template-save-toast" role="status" aria-live="polite">{success}</div> : null}

          <details
            className="panel-card panel-template-card panel-template-card--accordion"
            open={megaMenuCardExpanded}
            onToggle={handleAccordionToggle(megaMenuCardKey)}
          >
            <summary className="panel-template-card__summary" aria-expanded={megaMenuCardExpanded}>
              <div className="panel-template-card__summary-main">
                <div className="panel-template-card__header">
                  <div>
                    <p className="panel-kicker">Mega Menu</p>
                    <h2>{scope === 'base' ? 'Botão e contexto estrutural' : scope === 'tree' ? 'Departamentos, colunas e links' : 'Departamentos, colunas e links'}</h2>
                    <p className="panel-muted">
                      {scope === 'base'
                        ? 'Ajustes rápidos do gatilho do mega menu sem abrir a hierarquia completa.'
                        : scope === 'tree'
                          ? 'Cada departamento vira uma entrada do dropdown desktop e do accordion mobile.'
                          : 'Cada departamento vira uma entrada do dropdown desktop e do accordion mobile.'}
                    </p>
                  </div>
                  <div className="panel-template-card__aside">
                    <div className="panel-template-card__meta">
                      <span className="panel-badge panel-badge-neutral">
                        {template.header.departmentsMenu.length} departamentos configurados
                      </span>
                      <span className="panel-badge panel-badge-success">
                        {enabledDepartments} publicados
                      </span>
                    </div>
                    <div className="panel-template-card__controls">
                      <TemplateFeatureToggle
                        text={template.header.modules.departmentsMenu ? 'Ativo' : 'Inativo'}
                        enabled={template.header.modules.departmentsMenu}
                        ariaLabel={template.header.modules.departmentsMenu ? 'Desativar mega menu de departamentos' : 'Ativar mega menu de departamentos'}
                        onToggle={(nextValue) => updateTemplate((draft) => {
                          draft.header.modules.departmentsMenu = nextValue;
                        })}
                      />
                      <span className="panel-accordion-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </summary>

            <div className="panel-template-card__body">
              {showBaseSection ? (
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Base</p>
                    <h3 className="panel-template-subsection__title">Botão e contexto</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Aqui fica a configuração estrutural do gatilho do menu. A árvore em si permanece abaixo, por departamento.</p>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-header-departments-label">Label do botão de departamentos</label>
                    <input
                      id="template-header-departments-label"
                      className="panel-input"
                      value={template.header.departmentsButtonLabel}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.header.departmentsButtonLabel = event.target.value;
                      })}
                    />
                  </div>

                  <div className="panel-field">
                    <label>Status publicado</label>
                    <div className="panel-template-callout panel-template-callout--inline">
                      <strong>{template.header.modules.departmentsMenu ? 'Menu habilitado' : 'Menu oculto'}</strong>
                      <small className="panel-muted">Quando desativado, a loja continua funcionando sem o menu suspenso de departamentos.</small>
                    </div>
                  </div>
                </div>
              </section>
              ) : null}

              {showTreeSection ? (
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Árvore</p>
                    <h3 className="panel-template-subsection__title">Departamentos e seções</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Por enquanto o JSON continua local, mas esta página já separa a estrutura pensando numa futura alimentação por API.</p>
                  </div>
                </div>

                <div className="panel-template-list">
                  {template.header.departmentsMenu.map((category, categoryIndex) => (
                    <details
                      key={category.id}
                      className="panel-layer-item panel-template-accordion"
                      open={isAccordionExpanded(`department:${category.id}`, categoryIndex < 2)}
                      onToggle={handleAccordionToggle(`department:${category.id}`)}
                    >
                      <summary aria-expanded={isAccordionExpanded(`department:${category.id}`, categoryIndex < 2)}>
                        <div className="panel-template-accordion__summary">
                          <strong className="panel-template-accordion__title">{category.label}</strong>
                          <span className="panel-template-accordion__hint">
                            {countEnabledDepartmentLinks(category)} links ativos · {category.sections.length} seções
                          </span>
                        </div>
                        <span className={`panel-badge ${category.enabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                          {category.enabled ? 'Ativo' : 'Oculto'}
                        </span>
                      </summary>

                      <div className="panel-template-accordion__body">
                        <TemplateToggleRow
                          label="Departamento"
                          checked={category.enabled}
                          hint="Exibição no menu"
                          onToggle={(checked) => updateTemplate((draft) => {
                            draft.header.departmentsMenu[categoryIndex].enabled = checked;
                          })}
                          primary={
                            <input
                              className="panel-input"
                              value={category.label}
                              onChange={(event) => updateTemplate((draft) => {
                                draft.header.departmentsMenu[categoryIndex].label = event.target.value;
                              })}
                              placeholder="Departamento"
                            />
                          }
                          secondary={
                            <input
                              className="panel-input"
                              value={category.href}
                              onChange={(event) => updateTemplate((draft) => {
                                draft.header.departmentsMenu[categoryIndex].href = event.target.value;
                              })}
                              placeholder="/e-commerce/plp?categoria=departamento"
                            />
                          }
                        />

                        {category.sections.map((section, sectionIndex) => (
                          <div key={section.id} className="panel-form-section panel-template-nested-card">
                            <div className="panel-template-nested-card__header">
                              <span className="panel-template-chip panel-template-chip--muted">Seção {sectionIndex + 1}</span>
                              <span className="panel-muted">{countEnabledLinks(section.links)} links ativos</span>
                            </div>

                            <TemplateStaticRow
                              label="Título"
                              hint="Rótulo da coluna"
                              subtle
                              primary={
                                <input
                                  className="panel-input"
                                  value={section.title}
                                  onChange={(event) => updateTemplate((draft) => {
                                    draft.header.departmentsMenu[categoryIndex].sections[sectionIndex].title = event.target.value;
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
                                  hint="Item do mega menu"
                                  nested
                                  onToggle={(checked) => updateTemplate((draft) => {
                                    draft.header.departmentsMenu[categoryIndex].sections[sectionIndex].links[linkIndex].enabled = checked;
                                  })}
                                  primary={
                                    <input
                                      className="panel-input"
                                      value={link.label}
                                      onChange={(event) => updateTemplate((draft) => {
                                        draft.header.departmentsMenu[categoryIndex].sections[sectionIndex].links[linkIndex].label = event.target.value;
                                      })}
                                      placeholder="Label"
                                    />
                                  }
                                  secondary={
                                    <input
                                      className="panel-input"
                                      value={link.href}
                                      onChange={(event) => updateTemplate((draft) => {
                                        draft.header.departmentsMenu[categoryIndex].sections[sectionIndex].links[linkIndex].href = event.target.value;
                                      })}
                                      placeholder="/e-commerce/alguma-rota"
                                    />
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
              ) : null}
            </div>
          </details>
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
