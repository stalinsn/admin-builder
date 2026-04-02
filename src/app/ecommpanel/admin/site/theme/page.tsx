import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteThemeAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Tema visual fora do escopo"
      description="A camada de tema do antigo storefront foi removida do fluxo do Artmeta Panel para manter o produto focado em dados, contas e integrações."
    />
  );
}
