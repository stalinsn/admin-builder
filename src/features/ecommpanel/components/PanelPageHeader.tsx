import type { ReactNode } from 'react';

type PanelPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  titleId?: string;
};

export default function PanelPageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  titleId,
}: PanelPageHeaderProps) {
  return (
    <article className="panel-card panel-page-header">
      <div className="panel-page-header__main">
        <div className="panel-page-header__copy">
          {eyebrow ? <p className="panel-page-header__eyebrow">{eyebrow}</p> : null}
          <h1 id={titleId}>{title}</h1>
          {description ? <p className="panel-muted">{description}</p> : null}
        </div>
        {actions ? <div className="panel-page-header__actions">{actions}</div> : null}
      </div>
      {meta ? <div className="panel-page-header__meta">{meta}</div> : null}
    </article>
  );
}
