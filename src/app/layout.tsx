export const metadata = { title: 'EcommPanel' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
