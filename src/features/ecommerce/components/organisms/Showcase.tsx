"use client";
import React from 'react';
import ProductCard from '../molecules/ProductCard';
import { useProducts } from '../../lib/useProducts';
import { isOn } from '../../config/featureFlags';
import type { FlagKey } from '../../config/featureFlags';
import Carousel from './Carousel';
import { shelfConfig } from '../../config/shelfConfig';
import { useOrderForm } from '../../state/OrderFormContext';
import { resolveSelectedShippingOption } from '../../lib/logisticsClient';

export default function Showcase({ title, flag }: { title: string; flag: FlagKey }) {
  const { orderForm } = useOrderForm();
  const selectedOption = resolveSelectedShippingOption(orderForm.shipping);
  const data = useProducts({
    postalCode: orderForm.shipping.selectedAddress?.postalCode,
    mode: selectedOption?.mode || orderForm.shipping.selectedMode || undefined,
  });
  if (!isOn(flag)) return null;
  let itemCount = 8;
  if (flag === 'ecom.showcaseDaily') {
    itemCount = 12;
  } else if (flag === 'ecom.showcaseGrocery') {
    itemCount = 6;
  }
  
  return (
    <Carousel title={title} config={shelfConfig[flag]}>
      {data.slice(0, itemCount).map((p, index) => (
        <ProductCard
          key={p.id}
          id={p.id}
          name={p.name}
          image={p.image}
          price={p.price}
          listPrice={p.listPrice}
          unit={p.unit}
          packSize={p.packSize}
          url={p.url}
          available={p.available}
          availabilityLabel={p.availabilityLabel}
          imagePriority={index < 2}
        />
      ))}
    </Carousel>
  );
}
