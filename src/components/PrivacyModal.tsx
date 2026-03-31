import React from 'react';
import { labels } from '@/data/labels';
import ModalBase from './PrivacyModal/ModalBase';
import '@/styles/components/privacy-modal.css';

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
  lang: keyof typeof labels.privacyModalTitle;
}

export default function PrivacyModal({ open, onClose, lang }: PrivacyModalProps) {
  const langKey = lang;
  return (
    <ModalBase open={open} className="privacy-modal-card">
      <h2 className="privacy-modal-title">{labels.privacyModalTitle?.[langKey] || 'Política de Privacidade'}</h2>
      <p className="privacy-modal-paragraph">
        <b>{labels.privacyModalTransparency?.[langKey] || 'Transparência é coisa séria (mas pode ser leve):'}</b>
      </p>
      <ul className="privacy-modal-list">
        <li>
          {labels.privacyModalList1Main?.[langKey]}{' '}
          <span className="privacy-modal-list-italic">
            {labels.privacyModalList1Hash?.[langKey]}
          </span>
        </li>
        <li>{labels.privacyModalList2?.[langKey]}</li>
        <li>{labels.privacyModalList3?.[langKey]}</li>
        <li>{labels.privacyModalList4?.[langKey]}</li>
        <li>{labels.privacyModalList5?.[langKey]}</li>
        <li>{labels.privacyModalList6?.[langKey]}</li>
      </ul>
      <p className="privacy-modal-summary">
        <b>Resumo:</b> {labels.privacyModalSummary?.[langKey] || 'O currículo é meu, mas sua privacidade é sua mesmo. Só queremos garantir que todo mundo possa brincar com IA sem sustos (e sem falir o dono do site 😅).'}
      </p>
      <div className="privacy-modal-footer">
        <button
          className="btn btn-primary privacy-modal-btn"
          onClick={onClose}
        >
          {labels.privacyModalClose?.[langKey] || 'Fechar'}
        </button>
      </div>
    </ModalBase>
  );
}
