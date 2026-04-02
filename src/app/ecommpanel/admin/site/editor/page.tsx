import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function SiteEditorAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Editor de site desativado"
      description="A edição de páginas do storefront foi removida do fluxo principal deste produto. Use o Data Studio para estruturar a aplicação do jogo."
    />
  );
}
