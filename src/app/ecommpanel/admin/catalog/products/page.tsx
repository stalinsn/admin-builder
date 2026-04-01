import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function CatalogProductsAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Cadastro de produtos indisponível"
      description="Este fluxo é legado do contexto de e-commerce e não deve mais ser usado no Artmeta Panel do jogo."
    />
  );
}
