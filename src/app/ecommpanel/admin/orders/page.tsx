import BuilderModuleUnavailable from '@/features/ecommpanel/components/BuilderModuleUnavailable';

export default async function EcommPanelOrdersPage() {
  return (
    <BuilderModuleUnavailable
      title="Pedidos não fazem parte do Artmeta Panel"
      description="A trilha de pedidos pertence ao produto comercial antigo. Para o jogo, a camada operacional deve ser modelada por entidades e integrações específicas."
    />
  );
}
