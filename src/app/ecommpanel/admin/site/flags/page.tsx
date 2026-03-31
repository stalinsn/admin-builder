import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

const REGISTRY_ITEMS = [
  {
    key: 'template.header.modules.*',
    title: 'Header contextual',
    description: 'Promo bar, meta, links utilitários, CTA rápido e presença do mega menu agora vivem dentro da rota de Header.',
    href: '/ecommpanel/admin/site/template/header',
    cta: 'Abrir header',
  },
  {
    key: 'template.home.modules.*',
    title: 'Home contextual',
    description: 'Hero, vitrines, banner, serviços e faixas são operados diretamente na rota de Home, sem depender de uma área genérica de flags.',
    href: '/ecommpanel/admin/site/template/home',
    cta: 'Abrir home',
  },
  {
    key: 'template.footer.modules.*',
    title: 'Footer contextual',
    description: 'Newsletter, apps, social e colunas ficam no próprio fluxo do rodapé.',
    href: '/ecommpanel/admin/site/template/footer',
    cta: 'Abrir footer',
  },
  {
    key: 'template.theme / mega-menu',
    title: 'Tema e mega menu',
    description: 'O que antes poderia virar flag genérica agora foi tratado como módulo operacional dedicado, com tela própria e contexto suficiente.',
    href: '/ecommpanel/admin/site/theme',
    cta: 'Abrir tema',
  },
] as const;

export default async function SiteFlagsAdminPage() {
  const user = await getPanelUserFromCookies();
  if (!user) redirect('/ecommpanel/login');

  return (
    <section className="panel-grid">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Experiência do Site · Registro técnico</p>
        <h1>Flags operacionais foram absorvidas pelas telas de edição</h1>
        <p className="panel-muted">
          Esta rota deixou de ser área principal do painel. Os toggles úteis agora aparecem no próprio contexto de Header, Home, Footer, Tema e Mega Menu.
        </p>
      </article>

      <article className="panel-card">
        <h2>Como o painel passa a operar</h2>
        <div className="panel-layer-list">
          {REGISTRY_ITEMS.map((item) => (
            <div key={item.key} className="panel-template-callout panel-template-callout--inline">
              <div>
                <strong>{item.title}</strong>
                <p className="panel-muted">{item.description}</p>
                <small className="panel-muted">{item.key}</small>
              </div>
              <Link href={item.href} className="panel-btn panel-btn-secondary">
                {item.cta}
              </Link>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
