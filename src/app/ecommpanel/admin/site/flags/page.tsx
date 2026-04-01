import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteFlagsAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Flags de site fora do produto"
      description="Esta instância do Artmeta Panel não expõe storefront, tema ou mega menu. A área foi mantida apenas para não quebrar links históricos."
    />
  );
}
