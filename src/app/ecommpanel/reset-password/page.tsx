import { Suspense } from 'react';
import PanelAuthFrame from '@/features/ecommpanel/components/PanelAuthFrame';
import ResetPasswordForm from '@/features/ecommpanel/components/ResetPasswordForm';

export default function EcommPanelResetPasswordPage() {
  return (
    <PanelAuthFrame
      title="Redefinição de senha"
      subtitle="Defina uma nova senha forte para retomar o controle da área administrativa."
      highlights={[
        'Política de senha forte (12+ caracteres).',
        'Encerramento de sessões antigas após reset.',
        'Proteção contra tentativa massiva de tokens.',
      ]}
    >
      <Suspense fallback={<section className="panel-auth">Carregando recuperação de senha...</section>}>
        <ResetPasswordForm />
      </Suspense>
    </PanelAuthFrame>
  );
}
