import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function CatalogAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Catálogo comercial fora do escopo"
      description="O Artmeta Panel desta instância não opera catálogo de loja. Para o projeto do jogo, concentre a modelagem no Data Studio, em mídia e nas integrações por entidade."
    />
  );
}
