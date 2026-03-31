import React, { useState } from 'react';
import ModalBase from './ConfirmTranslateModal/ModalBase';
import '@/styles/components/confirm-translate-modal.css';

interface ConfirmTranslateModalProps {
  open: boolean;
  languageLabel: string;
  onConfirm: (token: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export default function ConfirmTranslateModal({
  open,
  languageLabel,
  onConfirm,
  onCancel,
  error,
}: ConfirmTranslateModalProps) {
  const [token, setToken] = useState('');
  const [internalError, setInternalError] = useState('');
  React.useEffect(() => {
    setInternalError(error || '');
  }, [error]);
  return (
    <ModalBase open={open}>
      <h2 className="text-lg font-semibold mb-4">
        Confirmação de Tradução
      </h2>
      <p className="mb-6">
        Deseja traduzir para o idioma selecionado?
        <br />
        <strong>{languageLabel}</strong>
      </p>
      <input
        className="token-input confirm-modal-input"
        type="text"
        placeholder="Insira seu token de autorização"
        value={token}
        onChange={e => { setToken(e.target.value); setInternalError(''); }}
      />
      {(internalError) && <div className="confirm-modal-error">{internalError}</div>}
      <div className="flex gap-4 justify-end">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!token.trim()) {
              setInternalError('Informe o token para liberar a tradução IA!');
              return;
            }
            onConfirm(token.trim());
          }}
        >
          Sim
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Não
        </button>
      </div>
    </ModalBase>
  );
}
