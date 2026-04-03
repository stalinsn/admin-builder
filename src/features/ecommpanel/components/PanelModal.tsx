'use client';

import { useEffect, type ReactNode } from 'react';

type PanelModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export default function PanelModal({
  open,
  title,
  description,
  size = 'lg',
  children,
  footer,
  onClose,
}: PanelModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="panel-modal-title">
      <button type="button" className="panel-modal__backdrop" aria-label="Fechar modal" onClick={onClose} />

      <div className={`panel-modal__content panel-modal__content--${size}`}>
        <header className="panel-modal__header">
          <div className="panel-modal__copy">
            <span className="panel-kicker">Artmeta Panel</span>
            <h2 id="panel-modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>

          <button type="button" className="panel-modal__close" aria-label="Fechar modal" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="panel-modal__body">{children}</div>

        {footer ? <footer className="panel-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
