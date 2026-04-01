"use client";
import React from 'react';
import { formatBRL } from '../../utils/currency';

export function PriceBlock({ price, listPrice, unit }: { price: number; listPrice?: number; unit?: string }) {
  const hasDiscount = !!(listPrice && listPrice > price);
  return (
    <div className="product-card__prices">
      {hasDiscount && <span className="product-card__list">{formatBRL(listPrice!)}</span>}
      <span className="product-card__price">{formatBRL(price)}</span>
      {unit && <span className="product-card__unit">/ {unit}</span>}
    </div>
  );
}
