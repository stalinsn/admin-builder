import {
  DEFAULT_ECOM_CAMPAIGN,
  DEFAULT_ECOM_THEME,
  ECOM_CAMPAIGNS,
  ECOM_THEMES,
  type EcomCampaignId,
  type EcomThemeId,
} from '@/features/ecommerce/config/styleguide';
import { sanitizeSingleLineText, sanitizeUrl } from '@/utils/inputSecurity';

export const STOREFRONT_TEMPLATE_SCHEMA_VERSION = 4;

const VALID_ECOM_THEMES = new Set<string>(ECOM_THEMES);
const VALID_ECOM_CAMPAIGNS = new Set<string>(ECOM_CAMPAIGNS);

export type StorefrontTemplateLink = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
};

export type StorefrontServiceItem = {
  id: string;
  icon: string;
  label: string;
  enabled: boolean;
};

export type StorefrontMenuSection = {
  id: string;
  title: string;
  links: StorefrontTemplateLink[];
};

export type StorefrontDepartmentCategory = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  sections: StorefrontMenuSection[];
};

export type StorefrontFooterSection = {
  id: string;
  title: string;
  enabled: boolean;
  links: StorefrontTemplateLink[];
};

export type StorefrontHeaderModules = {
  enabled: boolean;
  promoBar: boolean;
  utilLinks: boolean;
  quickLogin: boolean;
  departmentsMenu: boolean;
  navMeta: boolean;
};

export type StorefrontHomeModules = {
  enabled: boolean;
  heroMessage: boolean;
  showcaseDaily: boolean;
  services: boolean;
  showcaseGrocery: boolean;
  largeBanner: boolean;
  strips: boolean;
};

export type StorefrontHomeOverride = {
  enabled: boolean;
  pageSlug: string;
  hideHeader: boolean;
  hideFooter: boolean;
};

export type StorefrontFooterModules = {
  enabled: boolean;
  columns: boolean;
  apps: boolean;
  newsletter: boolean;
  social: boolean;
};

export type StorefrontThemeOverrides = {
  backgroundColor: string;
  surfaceColor: string;
  surfaceSoftColor: string;
  textColor: string;
  textMutedColor: string;
  borderColor: string;
  brandColor: string;
  brandHoverColor: string;
  headerBackgroundColor: string;
  headerUtilStartColor: string;
  headerUtilEndColor: string;
  headerPromoStartColor: string;
  headerPromoEndColor: string;
  headerPromoTextColor: string;
  footerStartColor: string;
  footerEndColor: string;
};

export type StorefrontTemplateTheme = {
  preset: EcomThemeId;
  campaign: EcomCampaignId;
  overrides: StorefrontThemeOverrides;
};

export type StorefrontTemplate = {
  schemaVersion: number;
  updatedAt: string;
  brandName: string;
  theme: StorefrontTemplateTheme;
  header: {
    modules: StorefrontHeaderModules;
    promoText: string;
    searchPlaceholder: string;
    utilLinks: StorefrontTemplateLink[];
    quickLogin: StorefrontTemplateLink;
    navMetaText: string;
    simpleHomeLabel: string;
    simpleCartLabel: string;
    departmentsButtonLabel: string;
    departmentsMenu: StorefrontDepartmentCategory[];
  };
  home: {
    modules: StorefrontHomeModules;
    override: StorefrontHomeOverride;
    heroMessage: string;
    dailyShowcaseTitle: string;
    groceryShowcaseTitle: string;
    services: StorefrontServiceItem[];
    largeBannerText: string;
    strips: StorefrontTemplateLink[];
  };
  footer: {
    modules: StorefrontFooterModules;
    sections: StorefrontFooterSection[];
    appTitle: string;
    appLinks: StorefrontTemplateLink[];
    newsletterTitle: string;
    newsletterPlaceholder: string;
    newsletterButtonLabel: string;
    socialLinks: StorefrontTemplateLink[];
    copyrightText: string;
  };
};

export type RuntimeStorefrontTemplateSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  template: StorefrontTemplate;
};

const DEFAULT_UPDATED_AT = '2026-03-17T00:00:00.000Z';

function createMenuLink(id: string, label: string, href: string): StorefrontTemplateLink {
  return { id, label, href, enabled: true };
}

export const DEFAULT_STOREFRONT_TEMPLATE: StorefrontTemplate = {
  schemaVersion: STOREFRONT_TEMPLATE_SCHEMA_VERSION,
  updatedAt: DEFAULT_UPDATED_AT,
  brandName: 'SuperMart',
  theme: {
    preset: DEFAULT_ECOM_THEME,
    campaign: DEFAULT_ECOM_CAMPAIGN,
    overrides: {
      backgroundColor: '',
      surfaceColor: '',
      surfaceSoftColor: '',
      textColor: '',
      textMutedColor: '',
      borderColor: '',
      brandColor: '',
      brandHoverColor: '',
      headerBackgroundColor: '',
      headerUtilStartColor: '',
      headerUtilEndColor: '',
      headerPromoStartColor: '',
      headerPromoEndColor: '',
      headerPromoTextColor: '',
      footerStartColor: '',
      footerEndColor: '',
    },
  },
  header: {
    modules: {
      enabled: true,
      promoBar: true,
      utilLinks: true,
      quickLogin: true,
      departmentsMenu: true,
      navMeta: true,
    },
    promoText: 'Prime • Frete grátis e ofertas exclusivas',
    searchPlaceholder: 'Pesquise aqui',
    utilLinks: [
      { id: 'club', label: 'Clube', href: '/e-commerce', enabled: true },
      { id: 'help', label: 'Ajuda', href: '/e-commerce', enabled: true },
      { id: 'login', label: 'Entrar', href: '/e-commerce/login', enabled: true },
    ],
    quickLogin: {
      id: 'quick-login',
      label: 'Entrar',
      href: '/e-commerce/login',
      enabled: true,
    },
    navMetaText: 'Atacado e Varejo',
    simpleHomeLabel: 'Home',
    simpleCartLabel: 'Carrinho',
    departmentsButtonLabel: 'Departamentos',
    departmentsMenu: [
      {
        id: 'dept-hortifruti',
        label: 'Hortifruti',
        href: '/e-commerce/plp?categoria=hortifruti',
        enabled: true,
        sections: [
          {
            id: 'hortifruti-categorias',
            title: 'Categorias',
            links: [
              createMenuLink('hort-frutas', 'Frutas frescas', '/e-commerce/plp?categoria=hortifruti&dept=Frutas'),
              createMenuLink('hort-legumes', 'Legumes e verduras', '/e-commerce/plp?categoria=hortifruti&dept=Legumes'),
              createMenuLink('hort-organicos', 'Orgânicos', '/e-commerce/plp?categoria=hortifruti&collection=Organicos'),
            ],
          },
          {
            id: 'hortifruti-destaques',
            title: 'Destaques',
            links: [
              createMenuLink('hort-ofertas', 'Ofertas do dia', '/e-commerce/plp?categoria=hortifruti&collection=Ofertas'),
              createMenuLink('hort-cebolas', 'Monte sua cesta', '/e-commerce/plp?categoria=hortifruti&q=cesta'),
              createMenuLink('hort-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=hortifruti'),
            ],
          },
        ],
      },
      {
        id: 'dept-padaria',
        label: 'Padaria',
        href: '/e-commerce/plp?categoria=padaria',
        enabled: true,
        sections: [
          {
            id: 'padaria-categorias',
            title: 'Categorias',
            links: [
              createMenuLink('pad-paes', 'Pães e baguetes', '/e-commerce/plp?categoria=padaria&dept=Pães'),
              createMenuLink('pad-bolos', 'Bolos e doces', '/e-commerce/plp?categoria=padaria&dept=Bolos'),
              createMenuLink('pad-cafeteria', 'Cafeteria', '/e-commerce/plp?categoria=padaria&q=cafe'),
            ],
          },
          {
            id: 'padaria-compre-junto',
            title: 'Compre junto',
            links: [
              createMenuLink('pad-cafe-manha', 'Kit café da manhã', '/e-commerce/plp?categoria=padaria&collection=Cafe%20da%20manha'),
              createMenuLink('pad-frios', 'Pães e frios', '/e-commerce/plp?categoria=padaria&q=frios'),
              createMenuLink('pad-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=padaria'),
            ],
          },
        ],
      },
      {
        id: 'dept-bebidas',
        label: 'Bebidas',
        href: '/e-commerce/plp?categoria=bebidas',
        enabled: true,
        sections: [
          {
            id: 'bebidas-categorias',
            title: 'Categorias',
            links: [
              createMenuLink('beb-agua', 'Água e isotônicos', '/e-commerce/plp?categoria=bebidas&dept=Água'),
              createMenuLink('beb-refrigerantes', 'Refrigerantes', '/e-commerce/plp?categoria=bebidas&dept=Refrigerantes'),
              createMenuLink('beb-energeticos', 'Energéticos', '/e-commerce/plp?categoria=bebidas&q=energ'),
            ],
          },
          {
            id: 'bebidas-destaques',
            title: 'Destaques',
            links: [
              createMenuLink('beb-vinhos', 'Vinhos e espumantes', '/e-commerce/plp?categoria=bebidas&q=vinho'),
              createMenuLink('beb-ofertas', 'Ofertas geladas', '/e-commerce/plp?categoria=bebidas&collection=Ofertas'),
              createMenuLink('beb-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=bebidas'),
            ],
          },
        ],
      },
      {
        id: 'dept-limpeza',
        label: 'Limpeza',
        href: '/e-commerce/plp?categoria=limpeza',
        enabled: true,
        sections: [
          {
            id: 'limpeza-casa',
            title: 'Casa',
            links: [
              createMenuLink('lim-lava-roupas', 'Lava roupas', '/e-commerce/plp?categoria=limpeza&q=lava%20roupas'),
              createMenuLink('lim-desinfetantes', 'Desinfetantes', '/e-commerce/plp?categoria=limpeza&dept=Desinfetantes'),
              createMenuLink('lim-multiuso', 'Multiuso', '/e-commerce/plp?categoria=limpeza&dept=Multiuso'),
            ],
          },
          {
            id: 'limpeza-organizacao',
            title: 'Organização',
            links: [
              createMenuLink('lim-utensilios', 'Utensílios', '/e-commerce/plp?categoria=limpeza&q=utensilio'),
              createMenuLink('lim-sacolas', 'Sacos e descartáveis', '/e-commerce/plp?categoria=limpeza&q=saco'),
              createMenuLink('lim-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=limpeza'),
            ],
          },
        ],
      },
      {
        id: 'dept-cuidados',
        label: 'Cuidados pessoais',
        href: '/e-commerce/plp?categoria=cuidados-pessoais',
        enabled: true,
        sections: [
          {
            id: 'cuidados-higiene',
            title: 'Higiene',
            links: [
              createMenuLink('cui-shampoo', 'Shampoo e condicionador', '/e-commerce/plp?categoria=cuidados-pessoais&q=shampoo'),
              createMenuLink('cui-sabonete', 'Sabonetes', '/e-commerce/plp?categoria=cuidados-pessoais&q=sabonete'),
              createMenuLink('cui-oral', 'Higiene bucal', '/e-commerce/plp?categoria=cuidados-pessoais&q=creme%20dental'),
            ],
          },
          {
            id: 'cuidados-beleza',
            title: 'Beleza',
            links: [
              createMenuLink('cui-skincare', 'Skincare', '/e-commerce/plp?categoria=cuidados-pessoais&q=skin'),
              createMenuLink('cui-masculino', 'Cuidados masculinos', '/e-commerce/plp?categoria=cuidados-pessoais&q=barba'),
              createMenuLink('cui-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=cuidados-pessoais'),
            ],
          },
        ],
      },
      {
        id: 'dept-pet',
        label: 'Pet shop',
        href: '/e-commerce/plp?categoria=pet-shop',
        enabled: true,
        sections: [
          {
            id: 'pet-alimentacao',
            title: 'Alimentação',
            links: [
              createMenuLink('pet-racoes', 'Rações', '/e-commerce/plp?categoria=pet-shop&q=racao'),
              createMenuLink('pet-petiscos', 'Petiscos', '/e-commerce/plp?categoria=pet-shop&q=petisco'),
              createMenuLink('pet-umidos', 'Sachês e úmidos', '/e-commerce/plp?categoria=pet-shop&q=sache'),
            ],
          },
          {
            id: 'pet-cuidados',
            title: 'Cuidados',
            links: [
              createMenuLink('pet-areia', 'Areia sanitária', '/e-commerce/plp?categoria=pet-shop&q=areia'),
              createMenuLink('pet-higiene', 'Higiene e banho', '/e-commerce/plp?categoria=pet-shop&q=pet%20higiene'),
              createMenuLink('pet-ver-tudo', 'Ver todos', '/e-commerce/plp?categoria=pet-shop'),
            ],
          },
        ],
      },
    ],
  },
  home: {
    modules: {
      enabled: true,
      heroMessage: true,
      showcaseDaily: true,
      services: true,
      showcaseGrocery: true,
      largeBanner: true,
      strips: true,
    },
    override: {
      enabled: false,
      pageSlug: 'home',
      hideHeader: false,
      hideFooter: false,
    },
    heroMessage: 'Economize no seu café da manhã! 40% OFF no 2º',
    dailyShowcaseTitle: 'Ofertas do dia',
    groceryShowcaseTitle: 'Para sua despensa',
    services: [
      { id: 'service-schedule', icon: '⏰', label: 'Agende dia e hora', enabled: true },
      { id: 'service-pickup', icon: '🏪', label: 'Retire na loja', enabled: true },
      { id: 'service-payment', icon: '💳', label: 'Cartão e PIX', enabled: true },
      { id: 'service-security', icon: '🛡', label: 'Compra segura', enabled: true },
    ],
    largeBannerText: 'Economize com combos — mobile-first banner',
    strips: [
      { id: 'strip-1', label: 'Faixa promocional 1', href: '/e-commerce', enabled: true },
      { id: 'strip-2', label: 'Faixa promocional 2', href: '/e-commerce', enabled: true },
      { id: 'strip-3', label: 'Faixa promocional 3', href: '/e-commerce', enabled: true },
    ],
  },
  footer: {
    modules: {
      enabled: true,
      columns: true,
      apps: true,
      newsletter: true,
      social: true,
    },
    sections: [
      {
        id: 'institutional',
        title: 'Institucional',
        enabled: true,
        links: [
          { id: 'who-we-are', label: 'Quem somos', href: '/e-commerce/quem-somos', enabled: true },
          { id: 'stores', label: 'Lojas e horários', href: '/e-commerce/lojas', enabled: true },
          { id: 'careers', label: 'Trabalhe conosco', href: '/e-commerce/carreiras', enabled: true },
        ],
      },
      {
        id: 'support',
        title: 'Atendimento',
        enabled: true,
        links: [
          { id: 'help-center', label: 'Central de ajuda', href: '/e-commerce/ajuda', enabled: true },
          { id: 'returns', label: 'Trocas e devoluções', href: '/e-commerce/trocas', enabled: true },
          { id: 'contact', label: 'Fale conosco', href: '/e-commerce/contato', enabled: true },
        ],
      },
      {
        id: 'policies',
        title: 'Políticas',
        enabled: true,
        links: [
          { id: 'privacy', label: 'Privacidade', href: '/e-commerce/privacidade', enabled: true },
          { id: 'terms', label: 'Termos de uso', href: '/e-commerce/termos', enabled: true },
          { id: 'cookies', label: 'Cookies', href: '/e-commerce/cookies', enabled: true },
        ],
      },
    ],
    appTitle: 'Baixe o app',
    appLinks: [
      { id: 'app-store', label: 'App Store', href: '#', enabled: true },
      { id: 'google-play', label: 'Google Play', href: '#', enabled: true },
    ],
    newsletterTitle: 'Receba novidades',
    newsletterPlaceholder: 'Seu e-mail',
    newsletterButtonLabel: 'Assinar',
    socialLinks: [
      { id: 'instagram', label: 'IG', href: '#', enabled: true },
      { id: 'facebook', label: 'FB', href: '#', enabled: true },
      { id: 'youtube', label: 'YT', href: '#', enabled: true },
    ],
    copyrightText: 'SuperMart • Preços e condições válidos para compras online.',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback: string): string {
  return sanitizeSingleLineText(typeof value === 'string' ? value : fallback, fallback);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeOptionalHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(trimmed)) return trimmed;
  return fallback;
}

function cloneLink(link: StorefrontTemplateLink): StorefrontTemplateLink {
  return { ...link };
}

function cloneService(item: StorefrontServiceItem): StorefrontServiceItem {
  return { ...item };
}

function cloneMenuSection(section: StorefrontMenuSection): StorefrontMenuSection {
  return {
    ...section,
    links: section.links.map(cloneLink),
  };
}

function cloneDepartmentCategory(category: StorefrontDepartmentCategory): StorefrontDepartmentCategory {
  return {
    ...category,
    sections: category.sections.map(cloneMenuSection),
  };
}

function cloneFooterSection(section: StorefrontFooterSection): StorefrontFooterSection {
  return {
    ...section,
    links: section.links.map(cloneLink),
  };
}

function cloneThemeOverrides(overrides: StorefrontThemeOverrides): StorefrontThemeOverrides {
  return { ...overrides };
}

function cloneTheme(theme: StorefrontTemplateTheme): StorefrontTemplateTheme {
  return {
    ...theme,
    overrides: cloneThemeOverrides(theme.overrides),
  };
}

export function cloneStorefrontTemplate(template: StorefrontTemplate): StorefrontTemplate {
  return {
    ...template,
    theme: cloneTheme(template.theme),
    header: {
      ...template.header,
      modules: { ...template.header.modules },
      utilLinks: template.header.utilLinks.map(cloneLink),
      quickLogin: cloneLink(template.header.quickLogin),
      departmentsMenu: template.header.departmentsMenu.map(cloneDepartmentCategory),
    },
    home: {
      ...template.home,
      modules: { ...template.home.modules },
      override: { ...template.home.override },
      services: template.home.services.map(cloneService),
      strips: template.home.strips.map(cloneLink),
    },
    footer: {
      ...template.footer,
      modules: { ...template.footer.modules },
      sections: template.footer.sections.map(cloneFooterSection),
      appLinks: template.footer.appLinks.map(cloneLink),
      socialLinks: template.footer.socialLinks.map(cloneLink),
    },
  };
}

function normalizeLinks(
  input: unknown,
  fallback: StorefrontTemplateLink[],
  prefix: string,
): StorefrontTemplateLink[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallback.map(cloneLink);
  }

  return input.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || {
      id: `${prefix}-${index + 1}`,
      label: `Link ${index + 1}`,
      href: '#',
      enabled: true,
    };

    return {
      id: normalizeString(source.id, fallbackItem.id),
      label: normalizeString(source.label, fallbackItem.label),
      href: sanitizeUrl(typeof source.href === 'string' ? source.href : fallbackItem.href, {
        fallback: fallbackItem.href,
        allowRelative: true,
        allowAnchor: true,
      }),
      enabled: normalizeBoolean(source.enabled, fallbackItem.enabled),
    };
  });
}

function normalizeServices(input: unknown, fallback: StorefrontServiceItem[]): StorefrontServiceItem[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallback.map(cloneService);
  }

  return input.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || {
      id: `service-${index + 1}`,
      icon: '•',
      label: `Serviço ${index + 1}`,
      enabled: true,
    };

    return {
      id: normalizeString(source.id, fallbackItem.id),
      icon: normalizeString(source.icon, fallbackItem.icon),
      label: normalizeString(source.label, fallbackItem.label),
      enabled: normalizeBoolean(source.enabled, fallbackItem.enabled),
    };
  });
}

function normalizeFooterSections(input: unknown, fallback: StorefrontFooterSection[]): StorefrontFooterSection[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallback.map(cloneFooterSection);
  }

  return input.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || {
      id: `footer-section-${index + 1}`,
      title: `Seção ${index + 1}`,
      enabled: true,
      links: [],
    };

    return {
      id: normalizeString(source.id, fallbackItem.id),
      title: normalizeString(source.title, fallbackItem.title),
      enabled: normalizeBoolean(source.enabled, fallbackItem.enabled),
      links: normalizeLinks(source.links, fallbackItem.links, `${fallbackItem.id}-link`),
    };
  });
}

function normalizeMenuSections(input: unknown, fallback: StorefrontMenuSection[], prefix: string): StorefrontMenuSection[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallback.map(cloneMenuSection);
  }

  return input.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || {
      id: `${prefix}-section-${index + 1}`,
      title: `Seção ${index + 1}`,
      links: [],
    };

    return {
      id: normalizeString(source.id, fallbackItem.id),
      title: normalizeString(source.title, fallbackItem.title),
      links: normalizeLinks(source.links, fallbackItem.links, `${fallbackItem.id}-link`),
    };
  });
}

function normalizeDepartments(input: unknown, fallback: StorefrontDepartmentCategory[]): StorefrontDepartmentCategory[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallback.map(cloneDepartmentCategory);
  }

  return input.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || {
      id: `department-${index + 1}`,
      label: `Departamento ${index + 1}`,
      href: '/e-commerce',
      enabled: true,
      sections: [],
    };

    return {
      id: normalizeString(source.id, fallbackItem.id),
      label: normalizeString(source.label, fallbackItem.label),
      href: sanitizeUrl(typeof source.href === 'string' ? source.href : fallbackItem.href, {
        fallback: fallbackItem.href,
        allowRelative: true,
        allowAnchor: true,
      }),
      enabled: normalizeBoolean(source.enabled, fallbackItem.enabled),
      sections: normalizeMenuSections(source.sections, fallbackItem.sections, fallbackItem.id),
    };
  });
}

function normalizeHeaderModules(input: unknown, fallback: StorefrontHeaderModules): StorefrontHeaderModules {
  const source = isRecord(input) ? input : {};

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    promoBar: normalizeBoolean(source.promoBar, fallback.promoBar),
    utilLinks: normalizeBoolean(source.utilLinks, fallback.utilLinks),
    quickLogin: normalizeBoolean(source.quickLogin, fallback.quickLogin),
    departmentsMenu: normalizeBoolean(source.departmentsMenu, fallback.departmentsMenu),
    navMeta: normalizeBoolean(source.navMeta, fallback.navMeta),
  };
}

function normalizeHomeModules(input: unknown, fallback: StorefrontHomeModules): StorefrontHomeModules {
  const source = isRecord(input) ? input : {};

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    heroMessage: normalizeBoolean(source.heroMessage, fallback.heroMessage),
    showcaseDaily: normalizeBoolean(source.showcaseDaily, fallback.showcaseDaily),
    services: normalizeBoolean(source.services, fallback.services),
    showcaseGrocery: normalizeBoolean(source.showcaseGrocery, fallback.showcaseGrocery),
    largeBanner: normalizeBoolean(source.largeBanner, fallback.largeBanner),
    strips: normalizeBoolean(source.strips, fallback.strips),
  };
}

function normalizeHomeOverride(input: unknown, fallback: StorefrontHomeOverride): StorefrontHomeOverride {
  const source = isRecord(input) ? input : {};
  const pageSlug = typeof source.pageSlug === 'string' ? source.pageSlug.trim().replace(/^\/+/, '') : fallback.pageSlug;

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    pageSlug,
    hideHeader: normalizeBoolean(source.hideHeader, fallback.hideHeader),
    hideFooter: normalizeBoolean(source.hideFooter, fallback.hideFooter),
  };
}

function normalizeFooterModules(input: unknown, fallback: StorefrontFooterModules): StorefrontFooterModules {
  const source = isRecord(input) ? input : {};

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    columns: normalizeBoolean(source.columns, fallback.columns),
    apps: normalizeBoolean(source.apps, fallback.apps),
    newsletter: normalizeBoolean(source.newsletter, fallback.newsletter),
    social: normalizeBoolean(source.social, fallback.social),
  };
}

function normalizeThemePreset(value: unknown, fallback: EcomThemeId): EcomThemeId {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_ECOM_THEMES.has(candidate) ? (candidate as EcomThemeId) : fallback;
}

function normalizeThemeCampaign(value: unknown, fallback: EcomCampaignId): EcomCampaignId {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_ECOM_CAMPAIGNS.has(candidate) ? (candidate as EcomCampaignId) : fallback;
}

function normalizeThemeOverrides(input: unknown, fallback: StorefrontThemeOverrides): StorefrontThemeOverrides {
  const source = isRecord(input) ? input : {};

  return {
    backgroundColor: normalizeOptionalHexColor(source.backgroundColor, fallback.backgroundColor),
    surfaceColor: normalizeOptionalHexColor(source.surfaceColor, fallback.surfaceColor),
    surfaceSoftColor: normalizeOptionalHexColor(source.surfaceSoftColor, fallback.surfaceSoftColor),
    textColor: normalizeOptionalHexColor(source.textColor, fallback.textColor),
    textMutedColor: normalizeOptionalHexColor(source.textMutedColor, fallback.textMutedColor),
    borderColor: normalizeOptionalHexColor(source.borderColor, fallback.borderColor),
    brandColor: normalizeOptionalHexColor(source.brandColor, fallback.brandColor),
    brandHoverColor: normalizeOptionalHexColor(source.brandHoverColor, fallback.brandHoverColor),
    headerBackgroundColor: normalizeOptionalHexColor(source.headerBackgroundColor, fallback.headerBackgroundColor),
    headerUtilStartColor: normalizeOptionalHexColor(source.headerUtilStartColor, fallback.headerUtilStartColor),
    headerUtilEndColor: normalizeOptionalHexColor(source.headerUtilEndColor, fallback.headerUtilEndColor),
    headerPromoStartColor: normalizeOptionalHexColor(source.headerPromoStartColor, fallback.headerPromoStartColor),
    headerPromoEndColor: normalizeOptionalHexColor(source.headerPromoEndColor, fallback.headerPromoEndColor),
    headerPromoTextColor: normalizeOptionalHexColor(source.headerPromoTextColor, fallback.headerPromoTextColor),
    footerStartColor: normalizeOptionalHexColor(source.footerStartColor, fallback.footerStartColor),
    footerEndColor: normalizeOptionalHexColor(source.footerEndColor, fallback.footerEndColor),
  };
}

function normalizeTheme(input: unknown, fallback: StorefrontTemplateTheme): StorefrontTemplateTheme {
  const source = isRecord(input) ? input : {};

  return {
    preset: normalizeThemePreset(source.preset, fallback.preset),
    campaign: normalizeThemeCampaign(source.campaign, fallback.campaign),
    overrides: normalizeThemeOverrides(source.overrides, fallback.overrides),
  };
}

export function createDefaultStorefrontTemplate(): StorefrontTemplate {
  return cloneStorefrontTemplate(DEFAULT_STOREFRONT_TEMPLATE);
}

export function normalizeStorefrontTemplate(input: unknown): StorefrontTemplate {
  const fallback = DEFAULT_STOREFRONT_TEMPLATE;
  const source = isRecord(input) ? input : {};
  const header = isRecord(source.header) ? source.header : {};
  const home = isRecord(source.home) ? source.home : {};
  const footer = isRecord(source.footer) ? source.footer : {};

  return {
    schemaVersion: STOREFRONT_TEMPLATE_SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt),
    brandName: normalizeString(source.brandName, fallback.brandName),
    theme: normalizeTheme(source.theme, fallback.theme),
    header: {
      modules: normalizeHeaderModules(header.modules, fallback.header.modules),
      promoText: normalizeString(header.promoText, fallback.header.promoText),
      searchPlaceholder: normalizeString(header.searchPlaceholder, fallback.header.searchPlaceholder),
      utilLinks: normalizeLinks(header.utilLinks, fallback.header.utilLinks, 'header-link'),
      quickLogin: normalizeLinks(header.quickLogin ? [header.quickLogin] : [], [fallback.header.quickLogin], 'quick-login')[0],
      navMetaText: normalizeString(header.navMetaText, fallback.header.navMetaText),
      simpleHomeLabel: normalizeString(header.simpleHomeLabel, fallback.header.simpleHomeLabel),
      simpleCartLabel: normalizeString(header.simpleCartLabel, fallback.header.simpleCartLabel),
      departmentsButtonLabel: normalizeString(header.departmentsButtonLabel, fallback.header.departmentsButtonLabel),
      departmentsMenu: normalizeDepartments(header.departmentsMenu, fallback.header.departmentsMenu),
    },
    home: {
      modules: normalizeHomeModules(home.modules, fallback.home.modules),
      override: normalizeHomeOverride(home.override, fallback.home.override),
      heroMessage: normalizeString(home.heroMessage, fallback.home.heroMessage),
      dailyShowcaseTitle: normalizeString(home.dailyShowcaseTitle, fallback.home.dailyShowcaseTitle),
      groceryShowcaseTitle: normalizeString(home.groceryShowcaseTitle, fallback.home.groceryShowcaseTitle),
      services: normalizeServices(home.services, fallback.home.services),
      largeBannerText: normalizeString(home.largeBannerText, fallback.home.largeBannerText),
      strips: normalizeLinks(home.strips, fallback.home.strips, 'home-strip'),
    },
    footer: {
      modules: normalizeFooterModules(footer.modules, fallback.footer.modules),
      sections: normalizeFooterSections(footer.sections, fallback.footer.sections),
      appTitle: normalizeString(footer.appTitle, fallback.footer.appTitle),
      appLinks: normalizeLinks(footer.appLinks, fallback.footer.appLinks, 'footer-app'),
      newsletterTitle: normalizeString(footer.newsletterTitle, fallback.footer.newsletterTitle),
      newsletterPlaceholder: normalizeString(footer.newsletterPlaceholder, fallback.footer.newsletterPlaceholder),
      newsletterButtonLabel: normalizeString(footer.newsletterButtonLabel, fallback.footer.newsletterButtonLabel),
      socialLinks: normalizeLinks(footer.socialLinks, fallback.footer.socialLinks, 'footer-social'),
      copyrightText: normalizeString(footer.copyrightText, fallback.footer.copyrightText),
    },
  };
}
