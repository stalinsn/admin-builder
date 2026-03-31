import React from "react";
import ModalBase from "./FallbackModal/ModalBase";
import '@/styles/components/fallback-modal.css';

interface FallbackModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

const FallbackModal: React.FC<FallbackModalProps> = ({ open, onAccept, onCancel }) => {
  return (
    <ModalBase open={open}>
      <h2 className="fallback-modal-title">Tradução com IA indisponível</h2>
      <p className="fallback-modal-text">A tradução automática com IA está indisponível no momento.<br />Deseja usar a tradução padrão (mock)?</p>
      <div className="fallback-modal-actions">
        <button onClick={onCancel} className="fallback-modal-btn">Não</button>
        <button onClick={onAccept} className="fallback-modal-btn fallback-modal-btn-primary">Sim</button>
      </div>
    </ModalBase>
  );
};

export default FallbackModal;
