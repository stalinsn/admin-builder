"use client";
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../atoms/Button';
import { useCart } from '../../state/CartContext';
import { useOrderForm } from '../../state/OrderFormContext';
import { useUI } from '../../state/UIContext';
import { useLogisticsStorefrontSettings } from '../../lib/useLogisticsStorefrontSettings';
import { PriceBlock } from './PriceBlock';
import { QuantitySelector } from './QuantitySelector';
import { DiscountBadge } from './DiscountBadge';

type Props = {
  id: string;
  name: string;
  image?: string;
  price: number;
  listPrice?: number;
  unit?: string;
  packSize?: number;
  url?: string;
  available?: boolean;
  availabilityLabel?: string;
  imagePriority?: boolean;
};

export default function ProductCard({
  id,
  name,
  image = '/file.svg',
  price,
  listPrice,
  unit,
  packSize,
  url,
  available = true,
  availabilityLabel,
  imagePriority = false,
}: Props) {
  const { add, inc, dec, state } = useCart();
  const { orderForm } = useOrderForm();
  const { openDeliveryModal } = useUI();
  const logisticsSettings = useLogisticsStorefrontSettings();
  const item = state.items[id];
  const hasItems = !!(item && item.qty > 0);
  const [mounted, setMounted] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const slug = url && url.includes('/p') ? url.split('/').filter(Boolean).slice(-2, -1)[0] : id;
  const href = `/e-commerce/${slug}/p`;
  const regionalizationReady = Boolean(orderForm.shipping.selectedMode && orderForm.shipping.selectedAddress?.postalCode);
  const selectionRequired = logisticsSettings.operation.deliverySelectionMode === 'required';

  function handleAdd() {
    if (selectionRequired && !regionalizationReady) {
      openDeliveryModal();
      return;
    }
    if (!available) return;
    add({ id, name, price, listPrice, image, unit, packSize });
  }
  
  return (
    <article className="product-card" aria-label={name} data-sku-id={id}>
      <Link href={href} className="product-card__img" aria-label={`Ver detalhes de ${name}`} prefetch={false}>
        {!imageLoaded && <span className="product-card__imgPlaceholder skeleton" aria-hidden="true" />}
        <Image 
          src={image} 
          alt={name} 
          width={320} 
          height={320} 
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 30vw, 320px"
          style={{ objectFit: 'contain', width: '100%', height: '100%' }} 
          loading={imagePriority ? 'eager' : 'lazy'}
          priority={imagePriority}
          onLoadingComplete={() => setImageLoaded(true)}
        />
        <DiscountBadge price={price} listPrice={listPrice} />
      </Link>
      <div className="product-card__info">
  <h3 className="product-card__title"><Link href={href} prefetch={false}>{name}</Link></h3>
        <PriceBlock price={price} listPrice={listPrice} unit={unit} />
  {packSize && <div className="product-card__pack">Pacote c/ {packSize}</div>}
      </div>
      <div className="product-card__cta">
        {!(mounted && hasItems) ? (
          <Button data-track-id="product-add" onClick={handleAdd} disabled={available === false}>
            {!available ? availabilityLabel || 'Esgotado' : selectionRequired && !regionalizationReady ? 'Definir entrega' : 'Adicionar'}
          </Button>
        ) : (
          <QuantitySelector value={item.qty} onDec={() => dec(id)} onInc={() => inc(id)} trackIdBase="product-card-qty" />
        )}
        {!available && availabilityLabel ? <small className="product-card__availability">{availabilityLabel}</small> : null}
      </div>
    </article>
  );
}
