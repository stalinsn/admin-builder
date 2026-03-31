export type AppEntry = {
  slug: string;
  title: string;
  path: string;
  description: string;
  image?: string; // path under /public
  previewImage?: string; // optional richer preview under /public (e.g., /previews/<slug>.jpg)
  accent?: string; // css color for highlights
  comingSoon?: boolean;
  features?: string[];
};

export const apps: AppEntry[] = [
  {
    slug: 'cv',
    title: 'Currículo',
    path: '/cv',
    description: 'Currículo interativo, multilíngue e acessível. Tradução com IA sob demanda, exportação para PDF com layout refinado e alternância de tema.',
  image: '/file.svg',
  previewImage: '/previews/cv.jpg',
    accent: '#22c55e',
    features: [
      'Tradução com cache e modo fallback',
      'Exportação PDF pronta para impressão',
      'Tema claro/escuro',
      'Seções colapsáveis (Resumo, Skills, etc.)',
    ],
  },
  {
    slug: 'motd',
    title: 'MOTD',
    path: '/motd',
    description: 'Mensagem do dia com animações, atalhos de teclado e gestão de favoritas. Perfeito para dar um gás na rotina com frases motivacionais e reflexões.',
  image: '/globe.svg',
  previewImage: '/previews/motd.jpg',
    accent: '#3b82f6',
    features: [
      'Atalhos: Espaço, F, C, S',
      'Favoritar e histórico recente',
      'Copiar e compartilhar',
      'Transições suaves (fade-in/out)',
    ],
  },
  {
    slug: 'ecommerce',
    title: 'E-commerce',
    path: '/e-commerce',
    description: 'Loja demo com PLP, PDP, carrinho e fluxo de checkout. Foco em composição de componentes, estados, loading e experiência fluida.',
  image: '/window.svg',
  previewImage: '/previews/ecommerce.jpg',
    accent: '#ef4444',
    features: [
      'PLP com loading e paginação',
      'PDP com variações',
      'Carrinho e resumo de pedido',
      'Checkout com confirmação',
    ],
  },
  {
    slug: 'ecommpanel',
    title: 'EcommPanel',
    path: '/ecommpanel/login',
    description:
      'Painel administrativo mock para operação do e-commerce com autenticação, RBAC, gestão de usuários e base de segurança em camadas.',
    image: '/window.svg',
    previewImage: '/previews/ecommpanel.jpg',
    accent: '#0b7a5a',
    features: [
      'Login seguro com sessão e CSRF',
      'Perfis e permissões granulares',
      'Gestão de usuários administrativa',
      'Base pronta para integração REST',
    ],
  },
];

export default apps;
