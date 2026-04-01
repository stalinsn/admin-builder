import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function BlogAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Blog editorial fora do escopo deste produto"
      description="O Artmeta Panel desta instância foi reduzido para dados, contas, autenticação, mídia e integrações. A trilha editorial do blog não faz parte do produto do jogo."
    />
  );
}
