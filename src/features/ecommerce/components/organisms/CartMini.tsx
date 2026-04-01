"use client";
import React from 'react';
import { useCart } from '../../state/CartContext';
import { isOn } from '../../config/featureFlags';
import { Button } from '../atoms/Button';

export default function CartMini() {
  const { state, inc, dec, remove, subtotal, totalItems, clear } = useCart();
  if (!isOn('ecom.cart')) return null;
  const items = Object.values(state.items);
  if (items.length === 0) return null;
  return (
    <aside className="container ecom-section" aria-label="Resumo do carrinho">
      <div className="product-card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Carrinho ({totalItems})</strong>
          <button onClick={clear} aria-label="Esvaziar">Limpar</button>
        </div>
        <ul style={{ display: 'grid', gap: 8 }}>
          {items.map((it) => (
            <li key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <small>R$ {it.price.toFixed(2)}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button variant="ghost" onClick={() => dec(it.id)}>-</Button>
                <span>{it.qty}</span>
                <Button variant="ghost" onClick={() => inc(it.id)}>+</Button>
                <Button variant="ghost" onClick={() => remove(it.id)}>Remover</Button>
              </div>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
      </div>
    </aside>
  );
}
