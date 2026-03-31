import '@/styles/ecommpanel/index.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'EcommPanel',
  description: 'Painel administrativo mock para gerenciamento do e-commerce.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function EcommPanelLayout({ children }: { children: React.ReactNode }) {
  return <main className="panel-root">{children}</main>;
}
