"use client";
import React from 'react';
import Image from 'next/image';
import { formatBRL } from '../../utils/currency';
import { useOrderForm } from '../../state/OrderFormContext';
import { useCart } from '../../state/CartContext';

export function CartItems() {
  const { orderForm } = useOrderForm();
  const { inc, dec, remove } = useCart();

  return (
    <div className="cart-items">
      <ul>
        {orderForm.items.map((it) => (
          <li key={it.id} className="cart-item">
            <div className="cart-item__media">
              <Image src={it.image || '/file.svg'} alt={it.name} width={64} height={64} />
            </div>
            <div className="cart-item__info">
              <div className="cart-item__name">{it.name}</div>
              <div className="cart-item__meta">
                {it.unit && <span className="meta-pill">/ {it.unit}</span>}
                {it.packSize && <span className="meta-pill">Pacote c/ {it.packSize}</span>}
              </div>
              <div className="cart-item__qty">
                <button data-track-id="cart-item-dec" aria-label={`Diminuir quantidade de ${it.name}`} onClick={() => dec(it.id)}>-</button>
                <span>{it.quantity}</span>
                <button data-track-id="cart-item-inc" aria-label={`Aumentar quantidade de ${it.name}`} onClick={() => inc(it.id)}>+</button>
                <button className="cart-item__remove" data-track-id="cart-item-remove" onClick={() => remove(it.id)}>Remover</button>
              </div>
            </div>
            <div className="cart-item__price">
              {it.listPrice && it.listPrice > it.price && (
                <span className="price-original">{formatBRL(it.listPrice)}</span>
              )}
              <span className="price-current">{formatBRL(it.price * it.quantity)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
