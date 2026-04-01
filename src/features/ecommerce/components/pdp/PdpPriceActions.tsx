"use client";
import React from 'react';
import { useCart } from '../../state/CartContext';
import { useOrderForm } from '../../state/OrderFormContext';
import { useUI } from '../../state/UIContext';
import { useLogisticsStorefrontSettings } from '../../lib/useLogisticsStorefrontSettings';

export function PdpPriceActions({
  id,
  name,
  image,
  price,
  listPrice,
  unit,
  packSize,
  available = true,
  availabilityLabel,
}: {
  id: string;
  name: string;
  image?: string;
  price: number;
  listPrice?: number;
  unit?: string;
  packSize?: number;
  available?: boolean;
  availabilityLabel?: string;
}) {
  const { add, inc, dec, state } = useCart();
  const { orderForm } = useOrderForm();
  const { openDeliveryModal } = useUI();
  const logisticsSettings = useLogisticsStorefrontSettings();
  const item = state.items[id];
  const hasItems = item && item.qty > 0;
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
    <div className="pdp__actions">
      {!hasItems ? (
        <button 
          className="add-to-cart-btn" 
          onClick={handleAdd}
          disabled={(selectionRequired ? regionalizationReady : true) && !available}
        >
          {selectionRequired && !regionalizationReady
            ? 'DEFINIR ENTREGA OU RETIRADA'
            : !available
              ? availabilityLabel || 'INDISPONÍVEL'
              : 'ADICIONAR AO CARRINHO'}
        </button>
      ) : (
        <div className="qty-controls">
          <button className="qty-btn" onClick={() => dec(id)}>−</button>
          <span className="qty-display">{item.qty}</span>
          <button className="qty-btn" onClick={() => inc(id)}>+</button>
        </div>
      )}
    </div>
  );
}
