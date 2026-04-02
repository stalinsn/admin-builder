import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteTemplateAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Template de storefront desativado"
      description="A composição visual de loja/site não faz parte desta instalação do Artmeta Panel."
    />
  );
}
