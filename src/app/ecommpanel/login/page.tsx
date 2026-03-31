import PanelAuthFrame from '@/features/ecommpanel/components/PanelAuthFrame';
import LoginForm from '@/features/ecommpanel/components/LoginForm';

export default function EcommPanelLoginPage() {
  return (
    <PanelAuthFrame
      title="Operação segura da sua loja"
      subtitle="Acesse o painel administrativo para operar sua loja com segurança."
    >
      <LoginForm />
    </PanelAuthFrame>
  );
}
