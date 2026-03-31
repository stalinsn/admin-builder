'use client';

import React, { useState } from 'react';

interface PasswordModalProps {
  onSubmit: (password: string) => void;
  attemptsLeft: number;
  close: () => void;
}

export default function PasswordModal({
  onSubmit,
  attemptsLeft,
  close,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
    setPassword('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>🔐 Acesso Restrito</h2>
        <p>Digite a senha para ativar a IA ({attemptsLeft} usos restantes).</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Senha..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="button-group">
            <button type="submit" className="btn">
              Confirmar
            </button>
            <button type="button" className="btn" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
