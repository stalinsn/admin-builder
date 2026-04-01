import type { ReactNode } from 'react';

type PanelAuthFrameProps = {
  title: string;
  subtitle: string;
  highlights?: string[];
  children: ReactNode;
};

export default function PanelAuthFrame({ title, subtitle, highlights, children }: PanelAuthFrameProps) {
  return (
    <div className="panel-shell panel-shell--auth">
      <div className="panel-auth-layout">
        <aside className="panel-auth-aside" aria-label="Resumo de segurança">
          <span className="panel-auth-kicker">Artmeta Panel</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>

          {highlights && highlights.length > 0 ? (
            <ul className="panel-auth-highlights">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </aside>

        {children}
      </div>
    </div>
  );
}
