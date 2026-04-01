"use client";
import React from 'react';
import { Button } from '../atoms/Button';

export function QuantitySelector({
  value,
  onDec,
  onInc,
  trackIdBase = 'qty',
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  trackIdBase?: string;
}) {
  return (
    <div className="qty-selector">
      <Button variant="ghost" data-track-id={`${trackIdBase}-dec`} aria-label="Diminuir" onClick={onDec}>-</Button>
      <span className="qty-selector__value">{value}</span>
      <Button variant="ghost" data-track-id={`${trackIdBase}-inc`} aria-label="Aumentar" onClick={onInc}>+</Button>
    </div>
  );
}
