import PanelAuthFrame from '@/features/ecommpanel/components/PanelAuthFrame';
import LoginForm from '@/features/ecommpanel/components/LoginForm';

export default function EcommPanelLoginPage() {
  return (
    <PanelAuthFrame
      title="Acesso seguro ao Artmeta Panel"
      subtitle="Entre no painel administrativo para operar dados, integrações, autenticação e mídia da sua plataforma."
    >
      <LoginForm />
    </PanelAuthFrame>
  );
}
