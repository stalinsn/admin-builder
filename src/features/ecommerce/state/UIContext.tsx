"use client";
import React, { createContext, useContext, useState, useMemo } from 'react';

type UIState = {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  isDeliveryModalOpen: boolean;
  openDeliveryModal: () => void;
  closeDeliveryModal: () => void;
  toast: { id: number; message: string; type?: 'info' | 'error' | 'success' } | null;
  showToast: (message: string, type?: 'info' | 'error' | 'success') => void;
};

const Ctx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setOpen] = useState(false);
  const [isDeliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [toast, setToast] = useState<UIState['toast']>(null);
  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3000);
  };
  const value = useMemo(() => ({
    isCartOpen,
    openCart: () => setOpen(true),
    closeCart: () => setOpen(false),
    toggleCart: () => setOpen((v) => !v),
    isDeliveryModalOpen,
    openDeliveryModal: () => setDeliveryModalOpen(true),
    closeDeliveryModal: () => setDeliveryModalOpen(false),
    toast,
    showToast,
  }), [isCartOpen, isDeliveryModalOpen, toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: toast.type === 'error' ? '#b00020' : toast.type === 'success' ? '#0a7d28' : '#333',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI deve ser usado dentro de <UIProvider>');
  return ctx;
}
