import { redirect } from 'next/navigation';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

const LIBRARY = [
  { name: 'Hero', description: 'Título principal com subtítulo.' },
  { name: 'Rich Text', description: 'Conteúdo textual com formatação simples.' },
  { name: 'CTA', description: 'Botão com link para fluxo comercial.' },
] as const;

export default async function SiteBlocksAdminPage() {
  const user = await getPanelUserFromCookies();
  if (!user) redirect('/ecommpanel/login');

  return (
    <section className="panel-grid">
      <article className="panel-card panel-card-hero">
        <p className="panel-kicker">Experiência do Site</p>
        <h1>Biblioteca de Blocos</h1>
        <p className="panel-muted">Blocos pré-definidos usados no construtor de páginas dinâmicas.</p>
      </article>

      <article className="panel-card">
        <div className="panel-grid" style={{ gap: '.6rem' }}>
          {LIBRARY.map((item) => (
            <div className="panel-form-section" key={item.name}>
              <strong>{item.name}</strong>
              <p className="panel-muted" style={{ marginTop: '.35rem' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
