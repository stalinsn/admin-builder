import '@/styles/ecommpanel/index.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'Artmeta Panel',
  description: 'Painel administrativo para orquestração de dados, autenticação, mídia e integrações.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function EcommPanelLayout({ children }: { children: React.ReactNode }) {
  return <main className="panel-root">{children}</main>;
}
