import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteRoutesAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Rotas do site não estão ativas"
      description="O Artmeta Panel desta instância não publica páginas de storefront. As rotas de site foram retiradas do fluxo principal."
    />
  );
}
