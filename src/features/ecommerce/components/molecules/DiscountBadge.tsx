"use client";
import React from 'react';

export function DiscountBadge({ price, listPrice }: { price?: number; listPrice?: number }) {
  if (!listPrice || !price || listPrice <= price) return null;
  const pct = Math.round((1 - price / listPrice) * 100);
  return <span className="badge-off">-{pct}%</span>;
}
