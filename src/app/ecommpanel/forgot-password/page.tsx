import PanelAuthFrame from '@/features/ecommpanel/components/PanelAuthFrame';
import ForgotPasswordForm from '@/features/ecommpanel/components/ForgotPasswordForm';

export default function EcommPanelForgotPasswordPage() {
  return (
    <PanelAuthFrame
      title="Recuperação de acesso"
      subtitle="Fluxo seguro para restaurar credenciais administrativas com token de uso único."
      highlights={[
        'Tokens com tempo de expiração curto.',
        'Rate limit para reduzir abuso.',
        'Trilha de auditoria para eventos de segurança.',
      ]}
    >
      <ForgotPasswordForm />
    </PanelAuthFrame>
  );
}
