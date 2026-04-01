'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';

type PanelAdminNavProps = {
  canManageUsers: boolean;
  canReadAnalytics: boolean;
  canReadDataStudio: boolean;
  canReadCatalog: boolean;
  canReadOrders: boolean;
  canReadPanelSettings: boolean;
  canReadIntegrations: boolean;
};

type NavItem = {
  id: string;
  href?: string;
  label: string;
  description: string;
  children?: NavItem[];
};

type NavUiState = {
  expanded: Record<string, boolean>;
};

const PANEL_NAV_STORAGE_KEY = withVersion('ecommpanel.admin-nav.ui', 'v1');

function countLeafEntries(item: NavItem): number {
  if (!item.children?.length) return 1;
  return item.children.reduce((sum, child) => sum + countLeafEntries(child), 0);
}

function filterNavItems(items: NavItem[], query: string): NavItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.flatMap((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase();
    const matchesSelf = haystack.includes(normalizedQuery);
    const filteredChildren = item.children?.length ? filterNavItems(item.children, normalizedQuery) : [];

    if (matchesSelf) {
      return [
        {
          ...item,
          children: item.children?.length ? item.children : undefined,
        },
      ];
    }

    if (filteredChildren.length) {
      return [
        {
          ...item,
          children: filteredChildren,
        },
      ];
    }

    return [];
  });
}

export default function PanelAdminNav({
  canManageUsers,
  canReadAnalytics,
  canReadDataStudio,
  canReadCatalog,
  canReadOrders,
  canReadPanelSettings,
  canReadIntegrations,
}: PanelAdminNavProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [uiStateLoaded, setUiStateLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const accessLinks: NavItem[] = [
    {
      id: 'dashboard',
      href: '/ecommpanel/admin',
      label: 'Dashboard',
      description: 'Resumo do orquestrador, base ativa, governança e trilha operacional.',
    },
  ];

  const operationsLinks: NavItem[] = [
    ...(canReadAnalytics
      ? [
          {
            id: 'analytics',
            href: '/ecommpanel/admin/analytics',
            label: 'Analytics',
            description: 'Sessões internas, uso de recursos, eventos e leitura operacional do sistema.',
          },
        ]
      : []),
    ...(canReadOrders
      ? [
          {
            id: 'customers',
            href: '/ecommpanel/admin/customers',
            label: 'Contas',
            description: 'Fonte principal de contas do sistema, nativas ou baseadas em entidade modelada.',
          },
          {
            id: 'customers-lgpd',
            href: '/ecommpanel/admin/customers/lgpd',
            label: 'LGPD e dados',
            description: 'Exportação, revisão, retenção e anonimização controlada das contas.',
          },
        ]
      : []),
  ];

  const platformLinks: NavItem[] = [
    ...(canReadDataStudio
      ? [
          {
            id: 'data-studio',
            label: 'Dados e banco',
            description: 'Conexões, bootstrap, entidades, imports e pacote base do sistema.',
            children: [
              {
                id: 'data-studio-overview',
                href: '/ecommpanel/admin/data',
                label: 'Visão geral',
                description: 'Conexão, bootstrap e modelagem da base operacional.',
              },
              {
                id: 'data-studio-dictionary',
                href: '/ecommpanel/admin/data/dictionary',
                label: 'Dicionário interno',
                description: 'Tabelas, campos, tipos e finalidade funcional da base.',
              },
            ],
          },
        ]
      : []),
    ...(canReadCatalog
      ? [
          {
            id: 'catalog-media',
            href: '/ecommpanel/admin/catalog/media',
            label: 'Mídia',
            description: 'Biblioteca operacional de imagens, uploads e reutilização de assets.',
          },
        ]
      : []),
    ...(canReadPanelSettings
      ? [
          {
            id: 'panel-auth-settings',
            href: '/ecommpanel/admin/settings/auth',
            label: 'Auth e e-mail',
            description: 'Caixa responsável, SMTP e políticas de autenticação do sistema.',
          },
          {
            id: 'panel-media-settings',
            href: '/ecommpanel/admin/settings/media',
            label: 'Mídia e imagens',
            description: 'Upload, compressão, variantes e tamanhos padrão do site.',
          },
        ]
      : []),
    ...(canManageUsers
      ? [{ id: 'users', href: '/ecommpanel/admin/users', label: 'Usuários', description: 'Pessoas, acessos, permissões e perfis do painel.' }]
      : []),
    ...(canReadIntegrations
      ? [
          {
            id: 'panel-integrations',
            href: '/ecommpanel/admin/integrations',
            label: 'APIs e integrações',
            description: 'Clientes de API, escopos, segredos, logs e referência autenticada.',
          },
        ]
      : []),
  ];

  const filteredAccessLinks = useMemo(() => filterNavItems(accessLinks, searchQuery), [accessLinks, searchQuery]);
  const filteredOperationsLinks = useMemo(() => filterNavItems(operationsLinks, searchQuery), [operationsLinks, searchQuery]);
  const filteredPlatformLinks = useMemo(() => filterNavItems(platformLinks, searchQuery), [platformLinks, searchQuery]);

  useEffect(() => {
    const uiState = safeJsonGet<NavUiState>(PANEL_NAV_STORAGE_KEY, { expanded: {} });
    setExpandedGroups(uiState.expanded || {});
    setUiStateLoaded(true);
  }, []);

  function setGroupExpanded(key: string, nextValue: boolean) {
    setExpandedGroups((prev) => {
      const next = { ...prev, [key]: nextValue };
      if (uiStateLoaded) {
        safeJsonSet<NavUiState>(PANEL_NAV_STORAGE_KEY, { expanded: next });
      }
      return next;
    });
  }

  function isPathActive(href: string): boolean {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
    const normalizedHref = href.replace(/\/+$/, '') || '/';
    return normalizedPath === normalizedHref;
  }

  function isItemActive(item: NavItem): boolean {
    if (item.href && isPathActive(item.href)) return true;
    return item.children?.some(isItemActive) ?? false;
  }

  function renderNavItem(item: NavItem, nested = false) {
    const active = isItemActive(item);

    if (!item.children?.length) {
      return (
        <Link
          key={item.id}
          href={item.href || '#'}
          className={`panel-nav-link ${nested ? 'panel-nav-link--nested' : ''} ${active ? 'is-active' : ''}`}
          aria-current={active ? 'page' : undefined}
        >
          <span className="panel-nav-link-label">{item.label}</span>
          <span className="panel-nav-link-description">{item.description}</span>
        </Link>
      );
    }

    const storageKey = `item:${item.id}`;
    const isOpen = searchQuery ? true : (expandedGroups[storageKey] ?? active);

    return (
      <details
        key={item.id}
        className={`panel-nav-branch ${nested ? 'panel-nav-branch--nested' : ''}`}
        open={isOpen}
        onToggle={(event) => setGroupExpanded(storageKey, event.currentTarget.open)}
      >
        <summary className={`panel-nav-link panel-nav-link--branch ${active ? 'is-active' : ''}`} aria-expanded={isOpen}>
          <span className="panel-nav-link-copy">
            <span className="panel-nav-link-label">{item.label}</span>
            <span className="panel-nav-link-description">{item.description}</span>
          </span>
          <span className="panel-nav-link-meta">
            <small className="panel-nav-count">{countLeafEntries(item)}</small>
            <span className="panel-accordion-chevron" aria-hidden="true" />
          </span>
        </summary>

        <div className="panel-nav-children">
          {item.children.map((child) => renderNavItem(child, true))}
        </div>
      </details>
    );
  }

  function renderLinks(title: string, links: NavItem[], key: string) {
    if (!links.length) return null;
    const isOpen = searchQuery ? true : (expandedGroups[key] ?? links.some(isItemActive));
    const totalEntries = links.reduce((sum, item) => sum + countLeafEntries(item), 0);

    return (
      <details
        className="panel-nav-group panel-nav-group--accordion"
        open={isOpen}
        onToggle={(event) => setGroupExpanded(key, event.currentTarget.open)}
      >
        <summary className="panel-nav-summary" aria-expanded={isOpen}>
          <span className="panel-nav-title">{title}</span>
          <span className="panel-nav-summary__meta">
            <small className="panel-nav-count">{totalEntries}</small>
            <span className="panel-accordion-chevron" aria-hidden="true" />
          </span>
        </summary>

        <div className="panel-nav-links">
          {links.map((item) => renderNavItem(item))}
        </div>
      </details>
    );
  }

  return (
    <nav className="panel-nav" aria-label="Menu administrativo">
      <div className="panel-nav-header">
        <div className="panel-nav-header__copy">
          <span className="panel-nav-header__eyebrow">Navegação</span>
          <strong>Admin Builder</strong>
          <small>Foque em dados, usuários, mídia, autenticação e integrações do sistema.</small>
        </div>
        <div className="panel-nav-searchbox">
          <input
            type="search"
            className="panel-search panel-nav-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar módulo, tela ou função"
            aria-label="Buscar módulo no menu principal"
          />
          {searchQuery ? (
            <button type="button" className="panel-link-button panel-nav-searchbox__clear" onClick={() => setSearchQuery('')}>
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      {renderLinks('Visão', filteredAccessLinks, 'group:access')}
      {renderLinks('Usuários e governança', filteredOperationsLinks, 'group:operations')}
      {renderLinks('Plataforma', filteredPlatformLinks, 'group:platform')}
    </nav>
  );
}
