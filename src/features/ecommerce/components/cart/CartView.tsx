"use client";
import React from 'react';
import { useOrderForm } from '../../state/OrderFormContext';
import { CartItems } from './CartItems';
import { CartSummary } from './CartSummary';
import { isOn } from '../../config/featureFlags';

export function CartView() {
  const { orderForm } = useOrderForm();
  const hasItems = orderForm.items.length > 0;
  const showTitle = isOn('ecom.cartPage.title');
  const showItems = isOn('ecom.cartPage.items');
  const showSummary = isOn('ecom.cartPage.summary');
  const showEmpty = isOn('ecom.cartPage.empty');
  return (
    <section className="container cart-page">
      {showTitle ? <h1 className="cart-title">Seu carrinho</h1> : null}
      {hasItems ? (
        <div className="cart-layout">
          {showItems ? <CartItems /> : null}
          {showSummary ? <CartSummary /> : null}
        </div>
      ) : (
        showEmpty ? <div className="cart-empty">Seu carrinho está vazio.</div> : null
      )}
    </section>
  );
}
