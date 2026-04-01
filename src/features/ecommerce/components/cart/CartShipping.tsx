"use client";
import React from 'react';

import { useOrderForm } from '../../state/OrderFormContext';
import { lookupCep } from '../../lib/cepService';
import { formatBRL } from '../../utils/currency';
import { resolveSelectedShippingOption, simulateLogisticsClient } from '../../lib/logisticsClient';

function maskCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export function CartShipping() {
  const { orderForm, setShipping } = useOrderForm();
  const [cep, setCep] = React.useState(orderForm.shipping.selectedAddress?.postalCode || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = orderForm.shipping.selectedAddress;
  const selectedOption = resolveSelectedShippingOption(orderForm.shipping);
  const shippingValue = orderForm.totalizers.find((t) => t.id === 'Shipping')?.value || 0;

  const onCalc = async () => {
    setError(null);
    setLoading(true);
    try {
      const addr = await lookupCep(cep);
      const result = await simulateLogisticsClient({
        postalCode: cep,
        address: addr
          ? {
              street: addr.street,
              neighborhood: addr.neighborhood,
              city: addr.city,
              state: addr.state,
              postalCode: addr.cep,
              country: addr.country,
            }
          : { postalCode: cep },
        items: orderForm.items.map((item) => ({ id: item.id, quantity: item.quantity })),
      });

      if (!result.options.length) {
        setError('Nenhuma opção logística disponível para o CEP informado.');
        return;
      }

      const deliveryOptions = result.options.filter((option) => option.mode === 'delivery');
      const pickupOptions = result.options
        .filter((option) => option.mode === 'pickup')
        .map((option) => ({ ...option, address: option.pickupAddress || null }));
      const selectedId = result.recommendedOptionId || deliveryOptions[0]?.id || pickupOptions[0]?.id || null;
      const selectedMode = selectedId?.startsWith('pickup') ? 'pickup' : 'delivery';

      setShipping({
        address: addr
          ? {
              street: addr.street,
              neighborhood: addr.neighborhood,
              city: addr.city,
              state: addr.state,
              postalCode: addr.cep,
              country: addr.country,
            }
          : { postalCode: cep },
        deliveryOptions,
        pickupOptions,
        selectedOptionId: selectedId,
        selectedMode,
      });
    } catch {
      setError('Não foi possível calcular o frete agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cart-shipping">
      <h3>Calcular frete</h3>
      <div className="shipping-form">
        <label htmlFor="shipping-cep">CEP</label>
        <input
          id="shipping-cep"
          placeholder="CEP (00000-000)"
          value={maskCep(cep)}
          onChange={(e) => setCep(maskCep(e.target.value))}
          maxLength={9}
          inputMode="numeric"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'shipping-error' : undefined}
        />
        <button data-track-id="cart-calc-shipping" onClick={onCalc} disabled={loading}>
          {loading ? 'Calculando…' : 'Calcular'}
        </button>
      </div>
      {error ? <div className="shipping-error" id="shipping-error" role="alert">{error}</div> : null}
      {selected ? (
        <div className="shipping-address">
          <div>
            <strong>Entrega em:</strong> {selected.street ? `${selected.street}, ` : ''}{selected.neighborhood ? `${selected.neighborhood}, ` : ''}{selected.city} - {selected.state} • CEP {selected.postalCode}
          </div>
          {selectedOption ? (
            <div className="shipping-price">
              <strong>{selectedOption.mode === 'pickup' ? 'Retirada:' : 'Frete:'}</strong> {formatBRL(shippingValue)} — {selectedOption.name}
              {selectedOption.estimate ? ` • ${selectedOption.estimate}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
