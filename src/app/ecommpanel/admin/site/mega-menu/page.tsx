import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteMegaMenuAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Mega menu indisponível"
      description="Navegação de storefront não faz parte do escopo do Artmeta Panel do jogo."
    />
  );
}
