import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteBlocksAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Construtor de site indisponível"
      description="Biblioteca de blocos, páginas dinâmicas e composição de storefront não fazem parte do escopo atual do Artmeta Panel."
    />
  );
}
