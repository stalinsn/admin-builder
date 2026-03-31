import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Keep bundles lean in production (source maps can be hosted separately if needed)
  productionBrowserSourceMaps: false,
  
  // Use a custom build directory to avoid Windows file lock issues on .next
  distDir: '.next-build',
  
  // Otimizações de build
  eslint: {
    // Desabilita ESLint durante build em produção (rode localmente antes)
    ignoreDuringBuilds: isProd,
  },
  
  typescript: {
    // ATENÇÃO: Só use isso se tiver certeza que não há erros de tipo
    // Em produção, considera rodar tsc --noEmit localmente antes
    ignoreBuildErrors: false, // Mantenha false para segurança
  },
  
  // Otimizações de compilação
  compiler: {
    // Remove console.log em produção
    removeConsole: isProd ? { exclude: ['error', 'warn'] } : false,
  },
  
  // Compressão e otimização
  compress: true,
  
  // Otimizar imagens
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      // Add more allowed hosts when enabling VTEX live images if needed
      // { protocol: 'https', hostname: 'your-account.vtexassets.com' },
    ],
  },
  
  // Headers de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Previne MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Previne clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // XSS Protection
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Controla Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Desabilita APIs desnecessárias
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS (apenas com HTTPS - descomente em produção)
          // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
