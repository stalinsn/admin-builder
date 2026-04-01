"use client";
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

function ScrollLock() {
  useEffect(() => {
    const body = document.body;
    const current = parseInt(body.dataset.scrollLocks || '0', 10) || 0;
    body.dataset.scrollLocks = String(current + 1);
    if (current === 0) {
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
    }
    return () => {
      const after = Math.max(0, (parseInt(body.dataset.scrollLocks || '1', 10) || 1) - 1);
      body.dataset.scrollLocks = String(after);
      if (after === 0) {
        body.style.overflow = '';
        body.style.touchAction = '';
      }
    };
  }, []);
  return null;
}

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ isOpen, onClose, children, className = '' }: ModalProps) {
  if (!isOpen) return null;

  const content = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Fechar modal"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return createPortal(<><ScrollLock />{content}</>, document.body);
  }
  return <><ScrollLock />{content}</>;
}
