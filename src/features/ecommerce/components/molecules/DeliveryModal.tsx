"use client";
import React, { useMemo, useState } from 'react';

import { Button } from '../atoms/Button';
import { useOrderForm } from '../../state/OrderFormContext';
import { useUI } from '../../state/UIContext';
import { lookupCep } from '../../lib/cepService';
import { simulateLogisticsClient } from '../../lib/logisticsClient';

type DeliveryOption = 'delivery' | 'pickup';

type DeliveryModalProps = {
  onClose: () => void;
};

function maskCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export function DeliveryModal({ onClose }: DeliveryModalProps) {
  const [step, setStep] = useState<'options' | 'cep' | 'stores'>('options');
  const [selectedOption, setSelectedOption] = useState<DeliveryOption>('delivery');
  const [cep, setCep] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupOptions, setPickupOptions] = useState<Array<{ id: string; name: string; estimate?: string; address?: string; instructions?: string }>>([]);
  const { orderForm, setShipping } = useOrderForm();
  const { showToast } = useUI();

  const itemPayload = useMemo(
    () => orderForm.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    [orderForm.items],
  );

  const handleOptionSelect = (option: DeliveryOption) => {
    setSelectedOption(option);
    setError(null);
    setStep(option === 'delivery' ? 'cep' : 'stores');
  };

  const handleCepSubmit = async () => {
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
        mode: 'delivery',
        items: itemPayload,
      });
      const deliveryOptions = result.options.filter((option) => option.mode === 'delivery');
      const pickupResults = result.options.filter((option) => option.mode === 'pickup');

      if (!deliveryOptions.length && !pickupResults.length) {
        const msg = 'Nenhuma cobertura logística disponível para o CEP informado.';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      if (deliveryOptions.length) {
        const selectedId = result.recommendedOptionId || deliveryOptions[0]?.id || null;
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
          pickupOptions: pickupResults.map((option) => ({ ...option, address: option.pickupAddress || null })),
          selectedOptionId: selectedId,
          selectedMode: 'delivery',
        });
        showToast('Cobertura confirmada e melhor entrega selecionada.', 'success');
        onClose();
        return;
      }

      setPickupOptions(
        pickupResults.map((option) => ({
          id: option.id,
          name: option.name,
          estimate: option.estimate,
          address: option.pickupAddress
            ? `${option.pickupAddress.street || ''} ${option.pickupAddress.number || ''} ${option.pickupAddress.city || ''} - ${option.pickupAddress.state || ''}`.trim()
            : undefined,
          instructions: option.pickupInstructions,
        })),
      );
      setStep('stores');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPickupOptions = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await simulateLogisticsClient({
        mode: 'pickup',
        items: itemPayload,
      });
      const options = result.options.filter((option) => option.mode === 'pickup');
      if (!options.length) {
        const msg = 'Nenhum ponto de retirada disponível para os itens atuais.';
        setError(msg);
        showToast(msg, 'error');
        return;
      }
      setPickupOptions(
        options.map((option) => ({
          id: option.id,
          name: option.name,
          estimate: option.estimate,
          address: option.pickupAddress
            ? `${option.pickupAddress.street || ''} ${option.pickupAddress.number || ''} ${option.pickupAddress.city || ''} - ${option.pickupAddress.state || ''}`.trim()
            : undefined,
          instructions: option.pickupInstructions,
        })),
      );
      setStep('stores');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreConfirm = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const result = await simulateLogisticsClient({
        mode: 'pickup',
        items: itemPayload,
      });
      const options = result.options.filter((option) => option.mode === 'pickup');
      const selected = options.find((option) => option.id === selectedStore);
      if (!selected) {
        setError('O ponto de retirada escolhido não está mais disponível.');
        return;
      }

      setShipping({
        address: selected.pickupAddress || null,
        deliveryOptions: [],
        pickupOptions: options.map((option) => ({ ...option, address: option.pickupAddress || null })),
        selectedOptionId: selected.id,
        selectedMode: 'pickup',
      });
      showToast('Retirada em loja ativada.', 'success');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (step === 'options') {
    return (
      <div className="delivery-modal">
        <h2 className="delivery-modal__title">Como deseja receber suas compras?</h2>
        <div className="delivery-modal__options">
          <button className={`delivery-option ${selectedOption === 'delivery' ? 'delivery-option--selected' : ''}`} onClick={() => handleOptionSelect('delivery')}>
            <span className="delivery-option__icon">🚚</span>
            <span>Entrega em casa</span>
          </button>
          <button className={`delivery-option ${selectedOption === 'pickup' ? 'delivery-option--selected' : ''}`} onClick={() => void handleLoadPickupOptions()}>
            <span className="delivery-option__icon">🏪</span>
            <span>Retire em loja</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'cep') {
    return (
      <div className="delivery-modal">
        <h2 className="delivery-modal__title">Como deseja receber suas compras?</h2>
        <div className="delivery-modal__options">
          <button className="delivery-option delivery-option--selected" onClick={() => setStep('options')}>
            <span className="delivery-option__icon">🚚</span>
            <span>Entrega em casa</span>
          </button>
          <button className="delivery-option" onClick={() => void handleLoadPickupOptions()}>
            <span className="delivery-option__icon">🏪</span>
            <span>Retire em loja</span>
          </button>
        </div>

        <div className="delivery-modal__cep">
          <h3>Confira cobertura, prazo e origem de atendimento</h3>
          <p>Digite o CEP para que a loja calcule a melhor entrega considerando estoque e SLA por origem.</p>

          <div className="cep-input-group">
            <input
              type="text"
              aria-label="Digite o CEP"
              placeholder="Digite seu CEP"
              value={maskCep(cep)}
              onChange={(e) => setCep(maskCep(e.target.value))}
              className="cep-input"
              maxLength={9}
            />
            <Button data-track-id="delivery-modal-check-cep" onClick={handleCepSubmit} disabled={loading}>
              {loading ? 'Verificando…' : 'Verificar'}
            </Button>
          </div>
          {error ? <div style={{ color: '#b00020', marginTop: 8 }} role="alert">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-modal">
      <h2 className="delivery-modal__title">Selecione o ponto de retirada</h2>
      <div className="delivery-modal__stores">
        <div className="stores-list">
          {pickupOptions.map((store) => (
            <label key={store.id} className="store-option">
              <input type="radio" name="selectedStore" value={store.id} checked={selectedStore === store.id} onChange={(e) => setSelectedStore(e.target.value)} />
              <div className="store-info">
                <h4>{store.name}</h4>
                {store.address ? <p>{store.address}</p> : null}
                {store.estimate ? <p>{store.estimate}</p> : null}
                {store.instructions ? <p>{store.instructions}</p> : null}
              </div>
            </label>
          ))}
        </div>

        <Button data-track-id="delivery-modal-confirm-store" onClick={handleStoreConfirm} disabled={!selectedStore || loading} className="w-full">
          {loading ? 'Confirmando…' : 'Confirmar'}
        </Button>
      </div>
    </div>
  );
}
