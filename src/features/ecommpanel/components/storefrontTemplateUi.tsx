import type { ReactNode } from 'react';

type ToggleRowProps = {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  primary: ReactNode;
  secondary?: ReactNode;
  hint?: string;
  nested?: boolean;
};

type StaticRowProps = {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  hint?: string;
  subtle?: boolean;
};

export type StorefrontToolbarMetric = {
  label: string;
  value: string;
};

function TemplateToggle({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="panel-template-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="panel-template-toggle__copy">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export function formatStorefrontTemplateDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function TemplateToggleRow({ label, checked, onToggle, primary, secondary, hint, nested = false }: ToggleRowProps) {
  return (
    <div className={`panel-template-item ${nested ? 'panel-template-item--nested' : ''}`}>
      <div className="panel-template-item__lead">
        <TemplateToggle checked={checked} label={label} hint={hint} onChange={onToggle} />
      </div>
      <div className={`panel-template-item__body ${secondary ? '' : 'panel-template-item__body--single'}`}>
        {primary}
        {secondary ?? null}
      </div>
    </div>
  );
}

export function TemplateStaticRow({ label, primary, secondary, hint, subtle = false }: StaticRowProps) {
  return (
    <div className={`panel-template-item ${subtle ? 'panel-template-item--soft' : ''}`}>
      <div className="panel-template-item__lead">
        <span className={`panel-template-chip ${subtle ? 'panel-template-chip--muted' : ''}`}>{label}</span>
        {hint ? <small className="panel-template-item__hint">{hint}</small> : null}
      </div>
      <div className={`panel-template-item__body ${secondary ? '' : 'panel-template-item__body--single'}`}>
        {primary}
        {secondary ?? null}
      </div>
    </div>
  );
}

export function TemplateFeatureToggle({
  text,
  enabled,
  compact = false,
  ariaLabel,
  onToggle,
}: {
  text: string;
  enabled: boolean;
  compact?: boolean;
  ariaLabel: string;
  onToggle: (nextValue: boolean) => void;
}) {
  const actionText = enabled ? 'Desativar' : 'Ativar';

  return (
    <button
      type="button"
      className={`panel-template-flag-toggle ${enabled ? 'is-on' : 'is-off'} ${compact ? 'panel-template-flag-toggle--compact' : ''}`}
      aria-pressed={enabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(!enabled);
      }}
    >
      <span className="panel-template-flag-toggle__indicator" aria-hidden="true" />
      <span className="panel-template-flag-toggle__label">
        <span className="panel-template-flag-toggle__text panel-template-flag-toggle__text--default">{text}</span>
        <span className="panel-template-flag-toggle__text panel-template-flag-toggle__text--action">{actionText}</span>
      </span>
    </button>
  );
}

export function StorefrontPublishToolbar({
  kicker,
  title,
  updatedAt,
  metrics,
  status,
  actions,
}: {
  kicker: string;
  title: string;
  updatedAt: string;
  metrics: StorefrontToolbarMetric[];
  status?: string | null;
  actions: ReactNode;
}) {
  return (
    <div className={`panel-card panel-template-toolbar ${status ? 'panel-template-toolbar--saved' : ''}`}>
      <div className="panel-template-toolbar__title">
        <p className="panel-kicker">{kicker}</p>
        <strong>{title}</strong>
        <span className="panel-template-toolbar__updated">
          <span>Última atualização</span>
          <time dateTime={updatedAt}>{formatStorefrontTemplateDate(updatedAt)}</time>
        </span>
      </div>

      <div className="panel-template-toolbar__meta">
        {metrics.map((metric) => (
          <span key={metric.label} className="panel-template-kpi">
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
          </span>
        ))}
      </div>

      <div className="panel-template-toolbar__actions">
        {status ? <span className="panel-template-toolbar__status">{status}</span> : null}
        {actions}
      </div>
    </div>
  );
}
