'use client';

import type { FormEvent, SyntheticEvent } from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ECOM_CAMPAIGNS, ECOM_THEMES } from '@/features/ecommerce/config/styleguide';
import {
  cloneStorefrontTemplate,
  createDefaultStorefrontTemplate,
  type StorefrontTemplate,
  type StorefrontThemeOverrides,
} from '@/features/site-runtime/storefrontTemplate';
import {
  countStorefrontThemeOverrides,
  getStorefrontThemeColorInputValue,
  resolveStorefrontTheme,
} from '@/features/site-runtime/storefrontTheme';
import {
  StorefrontPublishToolbar,
  formatStorefrontTemplateDate,
  type StorefrontToolbarMetric,
} from './storefrontTemplateUi';
import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';

type MeResponse = {
  csrfToken?: string;
};

type TemplateResponse = {
  template?: StorefrontTemplate;
  error?: string;
};

type ThemeUiState = {
  expanded: Record<string, boolean>;
};

type SaveState = 'idle' | 'saving' | 'saved';
type ThemeScope = 'all' | 'preset' | 'overrides';
type ThemeSidebarStat = {
  label: string;
  value: string;
};
type ThemeSidebarConfig = {
  title: string;
  stats: ThemeSidebarStat[];
  bullets: string[];
  secondaryTitle: string;
  secondaryText: string[];
};

const THEME_UI_STORAGE_KEY = withVersion('ecommpanel.storefront-theme.ui', 'v1');

function ThemeColorField({
  id,
  label,
  hint,
  value,
  fallback,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="panel-field panel-theme-field">
      <label htmlFor={id}>{label}</label>
      {hint ? <small className="panel-muted">{hint}</small> : null}
      <div className="panel-theme-field__controls">
        <span className="panel-theme-field__swatch" style={{ background: value || fallback }} aria-hidden="true" />
        <input
          id={`${id}-picker`}
          className="panel-input panel-color-input panel-theme-field__picker"
          type="color"
          value={getStorefrontThemeColorInputValue(value, fallback)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label}: seletor de cor`}
        />
        <input
          id={id}
          className="panel-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fallback}
        />
        <button type="button" className="panel-btn panel-btn-secondary" onClick={onClear} disabled={!value}>
          Limpar
        </button>
      </div>
    </div>
  );
}

export default function StorefrontThemeManager({ scope = 'all' }: { scope?: ThemeScope }) {
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
  const resolvedTheme = resolveStorefrontTheme(template.theme);
  const themeOverrideCount = countStorefrontThemeOverrides(template.theme.overrides);
  const showPresetSection = scope === 'all' || scope === 'preset';
  const showOverridesSection = scope === 'all' || scope === 'overrides';
  const heroCompact = scope !== 'all';
  const themeCardKey = scope === 'all' ? 'card:theme' : `card:theme:${scope}`;
  const themeCardExpanded = isAccordionExpanded(themeCardKey, true);
  const scopeConfig: Record<ThemeScope, { kicker: string; title: string; description: string; toolbarTitle: string }> = {
    all: {
      kicker: 'Experiência do Site · Tema',
      title: 'Paleta, tema base e ajustes finos',
      description: 'Aqui você controla as cores e o contexto visual da loja sem precisar mexer direto no CSS.',
      toolbarTitle: 'Tema base, campanha e ajustes finos',
    },
    preset: {
      kicker: 'Experiência do Site · Tema · Preset',
      title: 'Tema base e campanha',
      description: 'Escolha a base visual da loja antes de fazer ajustes pontuais de cor.',
      toolbarTitle: 'Preset e campanha',
    },
    overrides: {
      kicker: 'Experiência do Site · Tema · Ajustes finos',
      title: 'Ajustes finos de cor',
      description: 'Edite apenas as cores pontuais que precisam fugir do tema base.',
      toolbarTitle: 'Ajustes finos de cor',
    },
  };
  const currentScope = scopeConfig[scope];
  const toolbarMetrics: StorefrontToolbarMetric[] = [
    { label: 'Preset', value: template.theme.preset },
    { label: 'Campanha', value: template.theme.campaign },
    { label: 'Ajustes finos', value: String(themeOverrideCount) },
    { label: 'Marca', value: template.brandName },
  ];
  const sidebarConfig: Record<ThemeScope, ThemeSidebarConfig> = {
    all: {
      title: 'Resumo do tema',
      stats: [
        { label: 'Preset', value: template.theme.preset },
        { label: 'Campanha', value: template.theme.campaign },
        { label: 'Ajustes finos', value: String(themeOverrideCount) },
        { label: 'Marca', value: template.brandName },
      ],
      bullets: [
        'Preset e campanha continuam operando como base visual.',
        'Campo vazio significa usar as cores do tema base.',
        'A loja aplica essas mudanças sem precisar alterar o CSS original.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Esta página controla apenas cor e contexto visual. Estrutura, links e módulos continuam nas áreas de Template e Mega Menu.',
        'O objetivo aqui é publicar tema sem misturar operação visual com edição estrutural da loja.',
      ],
    },
    preset: {
      title: 'Resumo do preset',
      stats: [
        { label: 'Preset', value: template.theme.preset },
        { label: 'Campanha', value: template.theme.campaign },
        { label: 'Marca', value: template.brandName },
        { label: 'Ajustes finos', value: String(themeOverrideCount) },
      ],
      bullets: [
        'Preset e campanha definem a base visual da loja.',
        'Os ajustes finos continuam existindo, mas esta rota foca só na base.',
        'Boa para testar direções visuais sem entrar token por token.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Use esta rota quando a mudança for de direção visual macro.',
        'Se a necessidade for refinar uma cor específica, a rota correta é Ajustes finos.',
      ],
    },
    overrides: {
      title: 'Resumo dos ajustes finos',
      stats: [
        { label: 'Ajustes finos', value: String(themeOverrideCount) },
        { label: 'Marca', value: template.brandName },
        { label: 'Preset', value: template.theme.preset },
        { label: 'Campanha', value: template.theme.campaign },
      ],
      bullets: [
        'Cada campo preenchido sobrepõe a base visual atual.',
        'Campo vazio sempre volta para a herança do preset/campanha.',
        'Boa para ajustes finos de marca, header, superfícies e footer.',
      ],
      secondaryTitle: 'Ao editar',
      secondaryText: [
        'Use esta rota para refinamento visual fino, sem trocar o preset global.',
        'Os resultados continuam sendo publicados na mesma configuração usada pela loja.',
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

  function setThemeOverrides(mutator: (draft: StorefrontThemeOverrides) => void) {
    updateTemplate((draft) => {
      mutator(draft.theme.overrides);
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
        setError(templatePayload?.error || 'Não foi possível carregar o tema publicado.');
        return;
      }

      setTemplate(templatePayload.template);
    } catch {
      setError('Erro de rede ao carregar o tema.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTemplate();
  }, []);

  useEffect(() => {
    const uiState = safeJsonGet<ThemeUiState>(THEME_UI_STORAGE_KEY, { expanded: {} });
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
        safeJsonSet<ThemeUiState>(THEME_UI_STORAGE_KEY, { expanded: next });
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
        setError(payload?.error || 'Não foi possível salvar o tema.');
        setSaveState('idle');
        return;
      }

      setTemplate(payload.template);
      setSaveState('saved');
      setSuccess(`Tema publicado às ${formatStorefrontTemplateDate(payload.template.updatedAt)}.`);

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }

      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setSaveState('idle');
        setSuccess(null);
        saveFeedbackTimeoutRef.current = null;
      }, 4200);
    } catch {
      setError('Erro de rede ao salvar o tema.');
      setSaveState('idle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="storefront-theme-title">
      <article className={`panel-card panel-card-hero ${heroCompact ? 'panel-card-hero--compact' : ''}`}>
        <p className="panel-kicker">{currentScope.kicker}</p>
        <h1 id="storefront-theme-title">{currentScope.title}</h1>
        <p className="panel-muted">{currentScope.description}</p>
      </article>

      <div className="panel-template-grid">
        <form className="panel-template-form" onSubmit={handleSave}>
          <StorefrontPublishToolbar
            kicker="Tema publicado"
            title={currentScope.toolbarTitle}
            updatedAt={template.updatedAt}
            metrics={toolbarMetrics}
            status={saveState === 'saved' ? 'Publicado agora' : null}
            actions={
              <>
              {scope !== 'all' ? (
                <Link href="/ecommpanel/admin/site/theme" className="panel-btn panel-btn-secondary">
                  Visão geral do tema
                </Link>
              ) : (
                <Link href="/ecommpanel/admin/site/template" className="panel-btn panel-btn-secondary">
                  Voltar ao template
                </Link>
              )}
              <button type="button" className="panel-btn panel-btn-secondary" onClick={() => void fetchTemplate()} disabled={loading || saving}>
                Recarregar
              </button>
              <button type="submit" className="panel-btn panel-btn-primary" disabled={loading || saving}>
                {saving ? 'Publicando...' : saveState === 'saved' ? 'Publicado com sucesso' : 'Salvar e publicar tema'}
              </button>
              </>
            }
          />

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <div className="panel-template-save-toast" role="status" aria-live="polite">{success}</div> : null}

          <details
            className="panel-card panel-template-card panel-template-card--accordion"
            open={themeCardExpanded}
            onToggle={handleAccordionToggle(themeCardKey)}
          >
            <summary className="panel-template-card__summary" aria-expanded={themeCardExpanded}>
              <div className="panel-template-card__summary-main">
                <div className="panel-template-card__header">
                  <div>
                    <p className="panel-kicker">Tema</p>
                    <h2>{scope === 'preset' ? 'Tema base e campanha' : scope === 'overrides' ? 'Ajustes finos de cor' : 'Paleta e contexto visual'}</h2>
                    <p className="panel-muted">
                      {scope === 'preset'
                        ? 'Esta rota separa a escolha do tema base e da campanha antes dos ajustes finos.'
                        : scope === 'overrides'
                          ? 'Esta rota concentra apenas as cores ajustadas manualmente sobre o tema base.'
                          : 'Esta página controla as cores publicadas pelo painel sem alterar o CSS original da loja.'}
                    </p>
                  </div>
                  <div className="panel-template-card__aside">
                    <div className="panel-template-card__meta">
                      <span className="panel-badge panel-badge-neutral">preset: {template.theme.preset}</span>
                      <span className="panel-badge panel-badge-neutral">campanha: {template.theme.campaign}</span>
                      <span className="panel-badge panel-badge-success">{themeOverrideCount} ajustes finos ativos</span>
                    </div>
                    <div className="panel-template-card__controls">
                      <span className="panel-accordion-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            </summary>

            <div className="panel-template-card__body">
              {showPresetSection ? (
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Preset</p>
                    <h3 className="panel-template-subsection__title">Tema base e campanha</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Preset e campanha definem a base visual. Os ajustes finos só entram quando algum campo é preenchido.</p>
                  </div>
                </div>

                <div className="panel-template-section-grid">
                  <div className="panel-field">
                    <label htmlFor="template-theme-preset">Preset visual</label>
                    <select
                      id="template-theme-preset"
                      className="panel-select"
                      value={template.theme.preset}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.theme.preset = event.target.value as StorefrontTemplate['theme']['preset'];
                      })}
                    >
                      {ECOM_THEMES.map((themeId) => (
                        <option key={themeId} value={themeId}>
                          {themeId}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="panel-field">
                    <label htmlFor="template-theme-campaign">Campanha visual</label>
                    <select
                      id="template-theme-campaign"
                      className="panel-select"
                      value={template.theme.campaign}
                      onChange={(event) => updateTemplate((draft) => {
                        draft.theme.campaign = event.target.value as StorefrontTemplate['theme']['campaign'];
                      })}
                    >
                      {ECOM_CAMPAIGNS.map((campaignId) => (
                        <option key={campaignId} value={campaignId}>
                          {campaignId}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="panel-field panel-template-field-full">
                    <label>Prévia operacional</label>
                    <div className="panel-theme-preview" style={resolvedTheme.variables}>
                      <div className="panel-theme-preview__surface">
                        <span className="panel-theme-preview__eyebrow">Storefront</span>
                        <strong>{template.brandName}</strong>
                        <small>{themeOverrideCount > 0 ? `${themeOverrideCount} tokens sobrepostos` : 'Usando apenas os presets publicados'}</small>
                      </div>
                      <div className="panel-theme-preview__actions">
                        <span className="panel-theme-preview__chip">Header</span>
                        <span className="panel-theme-preview__chip panel-theme-preview__chip--accent">CTA</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              ) : null}

              {showOverridesSection ? (
              <section className="panel-template-subsection">
                <div className="panel-template-subsection__header">
                  <div>
                    <p className="panel-template-subsection__eyebrow">Overrides</p>
                    <h3 className="panel-template-subsection__title">Tokens essenciais</h3>
                  </div>
                  <div className="panel-template-subsection__aside">
                    <p className="panel-template-subsection__meta">Campo vazio significa “usar o preset/campanha atual”.</p>
                  </div>
                </div>

                <div className="panel-theme-grid">
                  <ThemeColorField id="template-theme-bg" label="Fundo da página" value={template.theme.overrides.backgroundColor} fallback="#f4f6f8" onChange={(value) => setThemeOverrides((draft) => { draft.backgroundColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.backgroundColor = ''; })} />
                  <ThemeColorField id="template-theme-surface" label="Superfície principal" value={template.theme.overrides.surfaceColor} fallback="#ffffff" onChange={(value) => setThemeOverrides((draft) => { draft.surfaceColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.surfaceColor = ''; })} />
                  <ThemeColorField id="template-theme-surface-soft" label="Superfície suave" value={template.theme.overrides.surfaceSoftColor} fallback="#f6f8fa" onChange={(value) => setThemeOverrides((draft) => { draft.surfaceSoftColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.surfaceSoftColor = ''; })} />
                  <ThemeColorField id="template-theme-border" label="Borda base" value={template.theme.overrides.borderColor} fallback="#d9e1e8" onChange={(value) => setThemeOverrides((draft) => { draft.borderColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.borderColor = ''; })} />
                  <ThemeColorField id="template-theme-text" label="Texto principal" value={template.theme.overrides.textColor} fallback="#101828" onChange={(value) => setThemeOverrides((draft) => { draft.textColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.textColor = ''; })} />
                  <ThemeColorField id="template-theme-text-muted" label="Texto auxiliar" value={template.theme.overrides.textMutedColor} fallback="#667085" onChange={(value) => setThemeOverrides((draft) => { draft.textMutedColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.textMutedColor = ''; })} />
                  <ThemeColorField id="template-theme-brand" label="Cor da marca" hint="Controla CTAs e destaques principais." value={template.theme.overrides.brandColor} fallback="#0d7a5f" onChange={(value) => setThemeOverrides((draft) => { draft.brandColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.brandColor = ''; })} />
                  <ThemeColorField id="template-theme-brand-hover" label="Hover da marca" value={template.theme.overrides.brandHoverColor} fallback="#0a654f" onChange={(value) => setThemeOverrides((draft) => { draft.brandHoverColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.brandHoverColor = ''; })} />
                  <ThemeColorField id="template-theme-header-bg" label="Fundo do header" value={template.theme.overrides.headerBackgroundColor} fallback="#ffffff" onChange={(value) => setThemeOverrides((draft) => { draft.headerBackgroundColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerBackgroundColor = ''; })} />
                  <ThemeColorField id="template-theme-header-util-start" label="Header util · início" value={template.theme.overrides.headerUtilStartColor} fallback="#ecf3f8" onChange={(value) => setThemeOverrides((draft) => { draft.headerUtilStartColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerUtilStartColor = ''; })} />
                  <ThemeColorField id="template-theme-header-util-end" label="Header util · fim" value={template.theme.overrides.headerUtilEndColor} fallback="#f5f8fb" onChange={(value) => setThemeOverrides((draft) => { draft.headerUtilEndColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerUtilEndColor = ''; })} />
                  <ThemeColorField id="template-theme-promo-start" label="Promo topo · início" value={template.theme.overrides.headerPromoStartColor} fallback="#0f8f6f" onChange={(value) => setThemeOverrides((draft) => { draft.headerPromoStartColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerPromoStartColor = ''; })} />
                  <ThemeColorField id="template-theme-promo-end" label="Promo topo · fim" value={template.theme.overrides.headerPromoEndColor} fallback="#35a385" onChange={(value) => setThemeOverrides((draft) => { draft.headerPromoEndColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerPromoEndColor = ''; })} />
                  <ThemeColorField id="template-theme-promo-text" label="Promo topo · texto" value={template.theme.overrides.headerPromoTextColor} fallback="#f7fffc" onChange={(value) => setThemeOverrides((draft) => { draft.headerPromoTextColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.headerPromoTextColor = ''; })} />
                  <ThemeColorField id="template-theme-footer-start" label="Footer · início" value={template.theme.overrides.footerStartColor} fallback="#f7fafc" onChange={(value) => setThemeOverrides((draft) => { draft.footerStartColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.footerStartColor = ''; })} />
                  <ThemeColorField id="template-theme-footer-end" label="Footer · fim" value={template.theme.overrides.footerEndColor} fallback="#f0f5fa" onChange={(value) => setThemeOverrides((draft) => { draft.footerEndColor = value; })} onClear={() => setThemeOverrides((draft) => { draft.footerEndColor = ''; })} />
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
