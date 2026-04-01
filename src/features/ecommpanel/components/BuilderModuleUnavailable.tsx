'use client';

import Link from 'next/link';

type BuilderModuleUnavailableProps = {
  title: string;
  description: string;
};

export default function BuilderModuleUnavailable({ title, description }: BuilderModuleUnavailableProps) {
  return (
    <section className="panel-grid">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Artmeta Panel</p>
        <h1>{title}</h1>
        <p className="panel-muted">{description}</p>
        <div className="panel-form-actions">
          <Link href="/ecommpanel/admin" className="panel-button">
            Voltar ao dashboard
          </Link>
          <Link href="/ecommpanel/admin/data" className="panel-button panel-button-secondary">
            Abrir dados e banco
          </Link>
        </div>
      </article>
    </section>
  );
}
