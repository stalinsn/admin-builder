'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PanelPermission, PanelRole, PanelRoleId, PanelUser } from '@/features/ecommpanel/types/auth';
import PanelModal from '@/features/ecommpanel/components/PanelModal';

type UsersApiResponse = {
  users?: PanelUser[];
  roles?: PanelRole[];
  permissions?: PanelPermission[];
  error?: string;
};

type MeApiResponse = {
  csrfToken?: string;
};

type UserForm = {
  name: string;
  email: string;
  active: boolean;
  roleIds: string[];
  permissionsAllow: string[];
  permissionsDeny: string[];
  temporaryPassword: string;
};

type PermissionMeta = {
  label: string;
  description: string;
  group: 'base' | 'dados' | 'conteudo' | 'comercio' | 'admin';
};

type PermissionGroupMeta = {
  title: string;
  description: string;
};

const INITIAL_FORM: UserForm = {
  name: '',
  email: '',
  active: true,
  roleIds: ['viewer'],
  permissionsAllow: [],
  permissionsDeny: [],
  temporaryPassword: '',
};

const ROLE_UI: Partial<Record<PanelRoleId, { label: string; description: string }>> = {
  main_admin: {
    label: 'Main Admin',
    description: 'Controle total do painel, incluindo conexão do banco, bootstrap, usuários e permissões críticas.',
  },
  admin: {
    label: 'Administrador',
    description: 'Opera quase todo o painel, mas sem poderes críticos de superusuário e sem conexão/ bootstrap do banco.',
  },
  store_owner: {
    label: 'Dono da Loja',
    description: 'Cuida da operação da loja sem administrar usuários, permissões ou configuração estrutural de dados.',
  },
  demo_operator: {
    label: 'Acesso Demo',
    description: 'Perfil de demonstração com sessão curta e alterações temporárias isoladas da operação oficial.',
  },
  site_editor: {
    label: 'Editor do Site',
    description: 'Mantém layout, conteúdo e módulos editoriais da loja.',
  },
  content_author: {
    label: 'Autora Editorial',
    description: 'Cria rascunhos e ajusta conteúdo do blog.',
  },
  content_editor: {
    label: 'Editor de Conteúdo',
    description: 'Revisa e melhora conteúdo editorial em nome da operação.',
  },
  content_publisher: {
    label: 'Publicador do Site',
    description: 'Libera publicações do blog e coordena a entrada do conteúdo na loja.',
  },
  comment_moderator: {
    label: 'Moderador de Comentários',
    description: 'Cuida das interações do blog sem acessar o restante da operação editorial.',
  },
  catalog_manager: {
    label: 'Gestor de Catálogo',
    description: 'Mantém produto, conteúdo comercial e preços.',
  },
  logistics_manager: {
    label: 'Gestor de Logística',
    description: 'Opera entrega, logística e pedidos.',
  },
  settings_manager: {
    label: 'Gestor de Configurações',
    description: 'Mantém configurações gerais da loja e integrações operacionais.',
  },
  data_manager: {
    label: 'Gestor de Dados',
    description: 'Modela entidades e mantém imports, sem alterar conexão ou bootstrap do banco.',
  },
  data_editor: {
    label: 'Operador de Dados',
    description: 'Importa e ajusta registros, sem criar novas entidades.',
  },
  data_viewer: {
    label: 'Leitora de Dados',
    description: 'Consulta a estrutura e o estado da base sem alterar nada.',
  },
  viewer: {
    label: 'Leitura',
    description: 'Perfil de visibilidade básica para acompanhar o painel sem operação ativa.',
  },
};

const PERMISSION_GROUPS: Record<PermissionMeta['group'], PermissionGroupMeta> = {
  base: {
    title: 'Base e leitura',
    description: 'Acessos básicos para entrar, visualizar painel e acompanhar áreas principais.',
  },
  dados: {
    title: 'Dados e banco',
    description: 'Conexão, bootstrap, entidades e registros do Data Studio.',
  },
  conteudo: {
    title: 'Site e conteúdo',
    description: 'Layout, páginas, blog e demais partes editoriais da loja.',
  },
  comercio: {
    title: 'Catálogo e operação comercial',
    description: 'Produto, preço, logística, pedidos e configuração da loja.',
  },
  admin: {
    title: 'Administração e segurança',
    description: 'Usuários, papéis, auditoria e poderes críticos do painel.',
  },
};

const PERMISSION_META: Record<PanelPermission, PermissionMeta> = {
  'dashboard.read': {
    label: 'Ver dashboard',
    description: 'Permite abrir o resumo principal do painel.',
    group: 'base',
  },
  'analytics.read': {
    label: 'Ver analytics',
    description: 'Permite consultar sessões, compras, buscas e indicadores.',
    group: 'base',
  },
  'analytics.manage': {
    label: 'Configurar analytics',
    description: 'Permite alterar coleta interna, GTM e integrações de medição.',
    group: 'base',
  },
  'data.admin.manage': {
    label: 'Controle total de dados',
    description: 'Libera todo o módulo de dados, incluindo conexão, bootstrap, entidades e registros.',
    group: 'dados',
  },
  'data.read': {
    label: 'Ver dados e banco',
    description: 'Permite consultar conexão, bootstrap, entidades e pacote base.',
    group: 'dados',
  },
  'data.connection.manage': {
    label: 'Gerenciar conexão',
    description: 'Permite cadastrar, remover e testar perfis de conexão do banco.',
    group: 'dados',
  },
  'data.bootstrap.manage': {
    label: 'Gerenciar bootstrap',
    description: 'Permite marcar se a base e o admin inicial já foram provisionados.',
    group: 'dados',
  },
  'data.entities.manage': {
    label: 'Gerenciar entidades',
    description: 'Permite criar e alterar entidades e campos do Data Studio.',
    group: 'dados',
  },
  'data.records.manage': {
    label: 'Gerenciar registros',
    description: 'Permite importar e ajustar cargas de dados em JSON.',
    group: 'dados',
  },
  'site.layout.manage': {
    label: 'Gerenciar layout',
    description: 'Permite alterar tema, template e estrutura visual da loja.',
    group: 'conteudo',
  },
  'site.content.manage': {
    label: 'Gerenciar páginas',
    description: 'Permite criar rotas e editar páginas do builder.',
    group: 'conteudo',
  },
  'blog.posts.manage': {
    label: 'Gerenciar blog',
    description: 'Libera a operação geral do módulo de blog.',
    group: 'conteudo',
  },
  'blog.posts.create': {
    label: 'Criar posts',
    description: 'Permite abrir novos rascunhos no blog.',
    group: 'conteudo',
  },
  'blog.posts.edit': {
    label: 'Editar posts',
    description: 'Permite revisar e ajustar posts existentes.',
    group: 'conteudo',
  },
  'blog.posts.publish': {
    label: 'Publicar posts',
    description: 'Permite liberar posts do blog para a loja.',
    group: 'conteudo',
  },
  'blog.comments.moderate': {
    label: 'Moderar comentários',
    description: 'Permite aprovar, rejeitar e revisar comentários do blog.',
    group: 'conteudo',
  },
  'blog.authors.manage': {
    label: 'Gerenciar autores',
    description: 'Permite atribuir responsáveis editoriais e governança do blog.',
    group: 'conteudo',
  },
  'featureFlags.manage': {
    label: 'Gerenciar flags',
    description: 'Permite ligar e desligar comportamentos controlados por flags.',
    group: 'conteudo',
  },
  'catalog.products.manage': {
    label: 'Gerenciar produtos',
    description: 'Permite operar a base de produtos do catálogo.',
    group: 'comercio',
  },
  'catalog.content.manage': {
    label: 'Gerenciar conteúdo comercial',
    description: 'Permite editar descrições, atributos e conteúdo comercial de catálogo.',
    group: 'comercio',
  },
  'catalog.pricing.manage': {
    label: 'Gerenciar preços',
    description: 'Permite alterar preço e estratégia de precificação.',
    group: 'comercio',
  },
  'logistics.manage': {
    label: 'Gerenciar logística',
    description: 'Permite operar regras de entrega e logística.',
    group: 'comercio',
  },
  'orders.manage': {
    label: 'Gerenciar pedidos',
    description: 'Permite acompanhar e operar pedidos.',
    group: 'comercio',
  },
  'customers.manage': {
    label: 'Gerenciar clientes',
    description: 'Permite criar, editar e revisar contas de clientes e seus endereços.',
    group: 'comercio',
  },
  'customers.lgpd.read': {
    label: 'Ver fila LGPD',
    description: 'Permite consultar a fila de solicitações de privacidade e exportações.',
    group: 'admin',
  },
  'customers.lgpd.request': {
    label: 'Abrir solicitações LGPD',
    description: 'Permite registrar pedidos de exportação e exclusão em nome do cliente.',
    group: 'admin',
  },
  'customers.lgpd.approve': {
    label: 'Aprovar solicitações LGPD',
    description: 'Permite aprovar ou rejeitar tratamentos de privacidade antes da execução final.',
    group: 'admin',
  },
  'customers.lgpd.execute': {
    label: 'Executar anonimização',
    description: 'Permite concluir a anonimização da conta após aprovação interna.',
    group: 'admin',
  },
  'privacy.retention.manage': {
    label: 'Gerenciar retenção de dados',
    description: 'Permite definir política de retenção, ação e base legal por categoria de dado.',
    group: 'admin',
  },
  'store.settings.manage': {
    label: 'Gerenciar configurações da loja',
    description: 'Permite alterar parâmetros gerais da operação da loja.',
    group: 'comercio',
  },
  'store.minimumPurchase.manage': {
    label: 'Gerenciar pedido mínimo',
    description: 'Permite configurar valor mínimo de compra.',
    group: 'comercio',
  },
  'integrations.manage': {
    label: 'Gerenciar integrações',
    description: 'Permite alterar integrações operacionais e chaves de ambiente.',
    group: 'comercio',
  },
  'api.keys.manage': {
    label: 'Gerenciar chaves de API',
    description: 'Permite administrar chaves de integração e acesso técnico.',
    group: 'admin',
  },
  'users.manage': {
    label: 'Gerenciar usuários',
    description: 'Permite criar e acompanhar usuários do painel.',
    group: 'admin',
  },
  'roles.manage': {
    label: 'Gerenciar perfis',
    description: 'Permite alterar papéis e perfis de acesso.',
    group: 'admin',
  },
  'permissions.grant': {
    label: 'Conceder permissões',
    description: 'Permite liberar ou bloquear permissões extras por usuário.',
    group: 'admin',
  },
  'audit.read': {
    label: 'Ver auditoria',
    description: 'Permite consultar ações registradas no painel.',
    group: 'admin',
  },
  'security.superuser': {
    label: 'Superusuário',
    description: 'Permissão crítica para governança máxima e operações sensíveis.',
    group: 'admin',
  },
};

function toggleString(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function getRolePresentation(role: PanelRole) {
  const ui = ROLE_UI[role.id];
  return {
    label: ui?.label || role.name,
    description: ui?.description || role.description,
  };
}

function getPermissionPresentation(permission: PanelPermission): PermissionMeta {
  return PERMISSION_META[permission];
}

function roleCoversOtherRole(candidate: PanelRole, target: PanelRole): boolean {
  const candidatePermissions = new Set(candidate.permissions);
  return target.permissions.every((permission) => candidatePermissions.has(permission));
}

export default function AdminUsersManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [roles, setRoles] = useState<PanelRole[]>([]);
  const [permissions, setPermissions] = useState<PanelPermission[]>([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [form, setForm] = useState<UserForm>(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.roleIds.some((role) => role.toLowerCase().includes(term))
      );
    });
  }, [search, users]);

  const activeUsers = useMemo(() => users.filter((user) => user.active).length, [users]);
  const hasAdvancedOverrides = form.permissionsAllow.length > 0 || form.permissionsDeny.length > 0;
  const editingUser = useMemo(() => users.find((user) => user.id === editingUserId) || null, [editingUserId, users]);

  const rolesById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const roleCoverageInsights = useMemo(() => {
    const selectedRoles = form.roleIds
      .map((roleId) => rolesById.get(roleId as PanelRoleId))
      .filter((role): role is PanelRole => Boolean(role));

    return selectedRoles
      .map((role) => {
        const coveredBy = selectedRoles.filter((candidate) => candidate.id !== role.id && roleCoversOtherRole(candidate, role));
        return { role, coveredBy };
      })
      .filter((entry) => entry.coveredBy.length > 0);
  }, [form.roleIds, rolesById]);

  const groupedPermissions = useMemo(() => {
    return (Object.keys(PERMISSION_GROUPS) as Array<PermissionMeta['group']>).map((groupKey) => ({
      key: groupKey,
      meta: PERMISSION_GROUPS[groupKey],
      permissions: permissions.filter((permission) => getPermissionPresentation(permission).group === groupKey),
    }));
  }, [permissions]);

  const selectedRolesSummary = useMemo(() => {
    return form.roleIds
      .map((roleId) => rolesById.get(roleId as PanelRoleId))
      .filter((role): role is PanelRole => Boolean(role))
      .map((role) => getRolePresentation(role).label);
  }, [form.roleIds, rolesById]);
  const canGrantPermissions = permissions.includes('permissions.grant');
  const actingOnUser = useMemo(() => users.find((user) => user.id === actionUserId) || null, [actionUserId, users]);

  const resetEditor = useCallback(() => {
    setForm(INITIAL_FORM);
    setEditingUserId(null);
    setAdvancedOpen(false);
  }, []);

  const startEditing = useCallback((user: PanelUser) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      active: user.active,
      roleIds: [...user.roleIds],
      permissionsAllow: [...user.permissionsAllow],
      permissionsDeny: [...user.permissionsDeny],
      temporaryPassword: '',
    });
    setAdvancedOpen(user.permissionsAllow.length > 0 || user.permissionsDeny.length > 0);
    setError(null);
    setSuccess(null);
    setIsEditorOpen(true);
  }, []);

  const startCreating = useCallback(() => {
    resetEditor();
    setError(null);
    setSuccess(null);
    setIsEditorOpen(true);
  }, [resetEditor]);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setAdvancedOpen(false);
    setError(null);
    setSuccess(null);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [meRequest, usersRequest] = await Promise.all([
        fetch('/api/ecommpanel/auth/me', { cache: 'no-store' }),
        fetch('/api/ecommpanel/admin/users', { cache: 'no-store' }),
      ]);

      const mePayload = (await meRequest.json().catch(() => null)) as MeApiResponse | null;
      if (mePayload?.csrfToken) {
        setCsrfToken(mePayload.csrfToken);
      }

      const usersPayload = (await usersRequest.json().catch(() => null)) as UsersApiResponse | null;
      if (!usersRequest.ok) {
        setError(usersPayload?.error || 'Não foi possível carregar usuários.');
        return;
      }

      setUsers(usersPayload?.users || []);
      setRoles(usersPayload?.roles || []);
      setPermissions(usersPayload?.permissions || []);
    } catch {
      setError('Erro de rede ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !canGrantPermissions) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const request = await fetch('/api/ecommpanel/admin/users', {
        method: editingUserId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          userId: editingUserId || undefined,
          ...form,
          active: form.active,
          roleIds: form.roleIds,
          permissionsAllow: form.permissionsAllow,
          permissionsDeny: form.permissionsDeny,
          temporaryPassword: form.temporaryPassword.trim() || undefined,
        }),
      });

      const payload = (await request.json().catch(() => null)) as {
        error?: string;
        user?: PanelUser;
        temporaryPassword?: string;
      } | null;

      if (!request.ok) {
        setError(payload?.error || (editingUserId ? 'Falha ao atualizar usuário.' : 'Falha ao criar usuário.'));
        return;
      }

      if (editingUserId) {
        const passwordMessage = payload?.temporaryPassword ? ` Nova senha temporária: ${payload.temporaryPassword}.` : '';
        setSuccess(`Usuário atualizado com sucesso.${passwordMessage}`);
      } else {
        setSuccess(`Usuário criado com sucesso. Senha temporária: ${payload?.temporaryPassword || '(gerada)'}.`);
      }
      resetEditor();
      await loadData();
      setIsEditorOpen(false);
    } catch {
      setError(editingUserId ? 'Erro de rede ao atualizar usuário.' : 'Erro de rede ao criar usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUserActive(user: PanelUser) {
    if (!canGrantPermissions || actionUserId) return;

    const nextActive = !user.active;
    const confirmed = window.confirm(
      nextActive
        ? `Deseja liberar novamente o acesso de ${user.name}?`
        : `Deseja bloquear o acesso de ${user.name}? O usuário deixará de entrar no painel até ser reativado.`,
    );
    if (!confirmed) return;

    setActionUserId(user.id);
    setError(null);
    setSuccess(null);

    try {
      const request = await fetch('/api/ecommpanel/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          userId: user.id,
          name: user.name,
          email: user.email,
          active: nextActive,
          roleIds: user.roleIds,
          permissionsAllow: user.permissionsAllow,
          permissionsDeny: user.permissionsDeny,
        }),
      });

      const payload = (await request.json().catch(() => null)) as { error?: string } | null;
      if (!request.ok) {
        setError(payload?.error || 'Não foi possível atualizar o status do usuário.');
        return;
      }

      setSuccess(nextActive ? 'Usuário reativado com sucesso.' : 'Usuário bloqueado com sucesso.');
      if (editingUserId === user.id) {
        setForm((prev) => ({ ...prev, active: nextActive }));
      }
      await loadData();
    } catch {
      setError('Erro de rede ao atualizar o status do usuário.');
    } finally {
      setActionUserId(null);
    }
  }

  async function removeUser(user: PanelUser) {
    if (!canGrantPermissions || actionUserId) return;

    const confirmed = window.confirm(
      `Deseja excluir ${user.name}? Essa ação remove o acesso administrativo e limpa sessões/tokens associados.`,
    );
    if (!confirmed) return;

    setActionUserId(user.id);
    setError(null);
    setSuccess(null);

    try {
      const request = await fetch('/api/ecommpanel/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const payload = (await request.json().catch(() => null)) as { error?: string } | null;
      if (!request.ok) {
        setError(payload?.error || 'Não foi possível excluir o usuário.');
        return;
      }

      if (editingUserId === user.id) {
        resetEditor();
      }
      setSuccess('Usuário excluído com sucesso.');
      await loadData();
    } catch {
      setError('Erro de rede ao excluir o usuário.');
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <section className="panel-users panel-grid panel-users--rework" aria-labelledby="panel-users-title">
      <div className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Controle de Acesso</p>
        <h1 id="panel-users-title">Gestão de usuários e permissões</h1>
        <p className="panel-muted">
          Perfis devem resolver a maior parte da operação. Exceções continuam disponíveis, mas em uma trilha mais controlada e legível.
        </p>
      </div>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Usuários cadastrados</span>
          <strong>{users.length}</strong>
          <span>Total no ambiente atual</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Usuários ativos</span>
          <strong>{activeUsers}</strong>
          <span>{users.length ? `${Math.round((activeUsers / users.length) * 100)}% da base` : 'Sem usuários'}</span>
        </article>

        <article className="panel-stat">
          <span className="panel-muted">Visíveis no filtro</span>
          <strong>{filteredUsers.length}</strong>
          <span>Busca por nome, e-mail ou perfil</span>
        </article>
      </div>

      <div className="panel-workspace panel-workspace--users">
        <div className="panel-card panel-workspace__main panel-users-list-card">
          <div className="panel-toolbar">
            <div className="panel-toolbar__top">
              <div className="panel-toolbar__copy">
                <h2>Usuários existentes</h2>
                <p className="panel-muted">Busque rapidamente, revise perfis aplicados e entre na edição individual quando necessário.</p>
              </div>
              <div className="panel-toolbar__filters">
                <input
                  className="panel-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, e-mail ou perfil"
                  aria-label="Buscar usuários"
                />
                {canGrantPermissions ? (
                  <button type="button" className="panel-btn panel-btn-primary panel-btn-sm" onClick={startCreating}>
                    + Novo usuário
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? <p className="panel-muted">Carregando usuários...</p> : null}

          {!loading && filteredUsers.length === 0 ? <p className="panel-table-empty">Nenhum usuário encontrado para o filtro atual.</p> : null}

          {!loading && filteredUsers.length > 0 ? (
            <div className="panel-table-wrap panel-users-table-wrap">
              <table className="panel-table panel-users-table" aria-label="Tabela de usuários">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfis</th>
                    <th>Ajustes extras</th>
                    <th>Bloqueios</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const busy = actionUserId === user.id;
                    return (
                      <tr key={user.id} className={editingUserId === user.id ? 'panel-users-row-active' : undefined}>
                        <td>
                          <div className="panel-users-identity">
                            <strong>{user.name}</strong>
                            <span className="panel-muted">{user.email}</span>
                          </div>
                        </td>
                        <td>
                          <div className="panel-users-chip-stack">
                            {user.roleIds.map((roleId) => {
                              const role = rolesById.get(roleId as PanelRoleId);
                              const label = role ? getRolePresentation(role).label : roleId;
                              const description = role ? getRolePresentation(role).description : roleId;

                              return (
                                <span className="panel-badge" key={`${user.id}-${roleId}`} title={description}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          <div className="panel-users-chip-stack">
                            {user.permissionsAllow.length ? (
                              user.permissionsAllow.map((permission) => {
                                const permissionMeta = getPermissionPresentation(permission);
                                return (
                                  <span className="panel-badge" key={`${user.id}-allow-${permission}`} title={permissionMeta.description}>
                                    {permissionMeta.label}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="panel-muted">Nenhum</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="panel-users-chip-stack">
                            {user.permissionsDeny.length ? (
                              user.permissionsDeny.map((permission) => {
                                const permissionMeta = getPermissionPresentation(permission);
                                return (
                                  <span className="panel-badge panel-badge-neutral" key={`${user.id}-deny-${permission}`} title={permissionMeta.description}>
                                    {permissionMeta.label}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="panel-muted">Nenhum</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`panel-badge ${user.active ? 'panel-badge-success' : 'panel-badge-neutral'}`}>{user.active ? 'Ativo' : 'Bloqueado'}</span>
                        </td>
                        <td className="panel-users-actions-cell">
                          <div className="panel-users-actions-stack">
                            <button
                              type="button"
                              className={`panel-btn panel-btn-sm panel-table-action ${editingUserId === user.id ? 'panel-btn-primary is-primary' : 'panel-btn-secondary'}`}
                              onClick={() => startEditing(user)}
                              disabled={busy}
                            >
                              {editingUserId === user.id ? 'Editando' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              className="panel-btn panel-btn-sm panel-btn-secondary"
                              onClick={() => toggleUserActive(user)}
                              disabled={busy || !canGrantPermissions}
                            >
                              {busy && actingOnUser?.id === user.id ? 'Salvando...' : user.active ? 'Bloquear' : 'Reativar'}
                            </button>
                            <button
                              type="button"
                              className="panel-btn panel-btn-sm panel-btn-danger"
                              onClick={() => removeUser(user)}
                              disabled={busy || !canGrantPermissions}
                            >
                              {busy && actingOnUser?.id === user.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

      </div>

      <PanelModal
        open={isEditorOpen}
        onClose={closeEditor}
        title={editingUser ? 'Editar usuário' : 'Novo usuário'}
        description={
          editingUser
            ? `Ajuste papéis, exceções e bloqueios de ${editingUser.name}.`
            : 'Crie um novo perfil administrativo e defina os acessos centrais desta conta.'
        }
        size="xl"
        footer={
          <div className="panel-actions">
            <button className="panel-btn panel-btn-primary" type="submit" form="panel-user-editor-form" disabled={submitting || !canGrantPermissions}>
              {submitting ? (editingUser ? 'Salvando...' : 'Criando...') : editingUser ? 'Salvar alterações' : 'Criar usuário'}
            </button>
            <button type="button" className="panel-btn panel-btn-secondary" onClick={closeEditor} disabled={submitting}>
              Cancelar
            </button>
          </div>
        }
      >
        <div className="panel-users-modal-grid">
          <section className="panel-users-modal-intro">
            <div className="panel-users-modal-intro__pill">
              {editingUser ? 'Conta em edição' : 'Criação guiada'}
            </div>
            <strong>{selectedRolesSummary.length ? selectedRolesSummary.join(' · ') : 'Escolha os perfis base'}</strong>
            <p className="panel-users-helper">
              Comece pelos perfis. Só use ajustes avançados quando precisar liberar ou bloquear uma exceção fora do papel principal.
            </p>
            {!canGrantPermissions ? (
              <p className="panel-feedback panel-feedback-success">
                Seu perfil pode consultar usuários e perfis, mas não pode criar nem alterar acessos permanentes.
              </p>
            ) : null}
          </section>

          <div className="panel-card panel-users-form-card panel-users-editor-card">
          <div className="panel-card-header panel-card-header--users-editor">
            <div className="panel-card-header__copy">
              <p className="panel-kicker">Editor de acesso</p>
              <h2>{editingUser ? 'Editar usuário' : 'Novo usuário'}</h2>
              {editingUser ? (
                <p className="panel-users-helper">
                  Ajuste perfis e exceções de <strong>{editingUser.name}</strong>. Se a senha ficar vazia, a atual será mantida.
                </p>
              ) : (
                <p className="panel-users-helper">
                  Primeiro escolha os perfis. Só depois use os ajustes avançados se precisar liberar ou bloquear uma exceção.
                </p>
              )}
            </div>
            <div className="panel-users-editor-card__meta">
              <span className="panel-badge panel-badge-neutral">
                {editingUser ? 'Conta em edição' : 'Criação guiada'}
              </span>
              <small>{selectedRolesSummary.length ? selectedRolesSummary.join(' · ') : 'Escolha os perfis base'}</small>
              {editingUser ? (
                <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={resetEditor}>
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </div>

          <form className="panel-form" id="panel-user-editor-form" onSubmit={onSubmit}>
            <div className="panel-field">
              <label htmlFor="panel-user-name">Nome</label>
              <input
                id="panel-user-name"
                className="panel-input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={!canGrantPermissions}
                required
              />
            </div>

            <div className="panel-field">
              <label htmlFor="panel-user-email">E-mail</label>
              <input
                id="panel-user-email"
                className="panel-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                disabled={!canGrantPermissions}
                required
              />
            </div>

            <label className="panel-checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                disabled={!canGrantPermissions}
              />
              <span>{editingUser ? 'Permitir login e uso normal deste usuário' : 'Criar usuário já ativo'}</span>
            </label>

            <div className="panel-field">
              <label htmlFor="panel-user-temp-pass">Senha temporária (opcional)</label>
              <input
                id="panel-user-temp-pass"
                className="panel-input"
                type="text"
                value={form.temporaryPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
                disabled={!canGrantPermissions}
                placeholder={editingUser ? 'Se vazio, mantém a senha atual' : 'Se vazio, será gerada automaticamente'}
              />
            </div>

            <section className="panel-form-section" aria-labelledby="panel-role-section">
              <div className="panel-inline-between">
                <div>
                  <h3 id="panel-role-section">Perfis de acesso</h3>
                  <p className="panel-users-section-copy">
                    Combine perfis quando precisar. Na maioria dos casos, isso já define tudo sem usar ajustes extras.
                  </p>
                </div>
                <span className="panel-badge panel-badge-neutral">
                  {selectedRolesSummary.length ? `${selectedRolesSummary.length} perfil${selectedRolesSummary.length > 1 ? 's' : ''}` : 'Sem perfil'}
                </span>
              </div>

              <div className="panel-role-list" role="group" aria-label="Perfis de acesso">
                {roles.map((role) => {
                  const ui = getRolePresentation(role);
                  const checked = form.roleIds.includes(role.id);
                  const coverage = roleCoverageInsights.find((entry) => entry.role.id === role.id);
                  return (
                    <label className={`panel-role-item ${checked ? 'is-selected' : ''}`} key={role.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setForm((prev) => ({ ...prev, roleIds: toggleString(prev.roleIds, role.id) }))}
                        disabled={!canGrantPermissions}
                      />
                      <span className="panel-role-item__body">
                        <strong>{ui.label}</strong>
                        <small>{ui.description}</small>
                        {coverage ? (
                          <span className="panel-role-item__note">
                            Este perfil não acrescenta acesso porque já está coberto por{' '}
                            {coverage.coveredBy.map((item) => getRolePresentation(item).label).join(', ')}.
                          </span>
                        ) : checked && form.roleIds.length > 1 ? (
                          <span className="panel-role-item__note panel-role-item__note--ok">
                            Este perfil está contribuindo com acesso complementar na combinação atual.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              {roleCoverageInsights.length ? (
                <div className="panel-users-role-warning" role="status">
                  <strong>Existem perfis redundantes na seleção atual.</strong>
                  <p>
                    Isso não impede o uso, mas alguns perfis não mudam o acesso final do usuário. Os avisos abaixo consideram
                    apenas permissões, não responsabilidade operacional.
                  </p>
                  <ul className="panel-users-role-warning-list">
                    {roleCoverageInsights.map((entry) => (
                      <li key={entry.role.id}>
                        <strong>{getRolePresentation(entry.role).label}</strong> já está coberto por{' '}
                        {entry.coveredBy.map((item) => getRolePresentation(item).label).join(', ')}.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : form.roleIds.length > 1 ? (
                <div className="panel-users-role-warning panel-users-role-warning--ok" role="status">
                  <strong>Os perfis selecionados se complementam.</strong>
                  <p>A combinação atual adiciona acessos distintos sem redundância direta entre os perfis escolhidos.</p>
                </div>
              ) : null}
            </section>

            <details
              className="panel-form-section panel-advanced-section"
              open={advancedOpen || hasAdvancedOverrides}
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            >
              <summary className="panel-advanced-summary">
                <span>
                  <strong>Ajustes avançados de permissão</strong>
                  <small>Use só para exceções. Perfis continuam sendo a forma principal de acesso.</small>
                </span>
                <span className="panel-badge panel-badge-neutral">
                  {form.permissionsAllow.length} extra / {form.permissionsDeny.length} bloqueio
                </span>
              </summary>

              <div className="panel-users-legend">
                <div className="panel-users-legend-card">
                  <strong>Liberar extra</strong>
                  <small>Adiciona uma permissão fora do perfil selecionado.</small>
                </div>
                <div className="panel-users-legend-card">
                  <strong>Bloquear</strong>
                  <small>Remove uma permissão mesmo que algum perfil conceda.</small>
                </div>
              </div>

              <div className="panel-permission-groups">
                {groupedPermissions.map(({ key, meta, permissions: permissionsInGroup }) => (
                  <section className="panel-permission-group" key={key} aria-labelledby={`permission-group-${key}`}>
                    <div className="panel-permission-group__header">
                      <strong id={`permission-group-${key}`}>{meta.title}</strong>
                      <small>{meta.description}</small>
                    </div>

                    <div className="panel-permission-grid" role="group" aria-label={meta.title}>
                      {permissionsInGroup.map((permission) => {
                        const permissionMeta = getPermissionPresentation(permission);
                        const allowChecked = form.permissionsAllow.includes(permission);
                        const denyChecked = form.permissionsDeny.includes(permission);

                        return (
                          <div className="panel-permission-card" key={permission}>
                            <div className="panel-permission-card__copy">
                              <strong>{permissionMeta.label}</strong>
                              <small>{permissionMeta.description}</small>
                              <code className="panel-permission-key">{permission}</code>
                            </div>

                            <div className="panel-permission-card__controls">
                              <label className={`panel-permission-toggle ${allowChecked ? 'is-active' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={allowChecked}
                                  disabled={!canGrantPermissions}
                                  onChange={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      permissionsAllow: toggleString(prev.permissionsAllow, permission),
                                      permissionsDeny: prev.permissionsDeny.filter((item) => item !== permission),
                                    }))
                                  }
                                />
                                <span>Liberar extra</span>
                              </label>

                              <label className={`panel-permission-toggle ${denyChecked ? 'is-active is-danger' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={denyChecked}
                                  disabled={!canGrantPermissions}
                                  onChange={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      permissionsDeny: toggleString(prev.permissionsDeny, permission),
                                      permissionsAllow: prev.permissionsAllow.filter((item) => item !== permission),
                                    }))
                                  }
                                />
                                <span>Bloquear</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          </form>

          {error ? (
            <p className="panel-feedback panel-feedback-error" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="panel-feedback panel-feedback-success" role="status">
              {success}
            </p>
          ) : null}
          </div>
        </div>
      </PanelModal>
    </section>
  );
}
