import { redirect } from 'next/navigation';

import BlogPostsManager from '@/features/ecommpanel/components/BlogPostsManager';
import { canAccessBlogWorkspace } from '@/features/blog/server/permissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function BlogAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessBlogWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à operação editorial do blog.</p>
        </article>
      </section>
    );
  }

  return <BlogPostsManager />;
}
