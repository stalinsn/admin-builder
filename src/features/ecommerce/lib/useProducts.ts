"use client";

import React from 'react';

import type { UIProduct } from '../types/product';
import { queryPLPUnified } from './plpDataSource';

export function useProducts(regionalization?: { postalCode?: string; mode?: 'delivery' | 'pickup' }) {
  const [products, setProducts] = React.useState<UIProduct[]>([]);

  React.useEffect(() => {
    let alive = true;
    queryPLPUnified({
      page: 1,
      pageSize: 24,
      sort: 'relevance',
      regionalization,
    })
      .then((result) => {
        if (alive) setProducts(result.products || []);
      })
      .catch(() => {
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, [regionalization?.postalCode, regionalization?.mode]);

  return products;
}
