import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function BlogEditorAdminPage() {
  return (
    <BuilderModuleUnavailable
      title="Editor de blog desativado"
      description="Esta instância do Artmeta Panel não usa fluxo editorial de site. O editor de blog foi mantido apenas por compatibilidade histórica e não deve mais ser usado."
    />
  );
}
