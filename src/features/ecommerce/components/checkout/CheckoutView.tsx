"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useOrderForm } from '../../state/OrderFormContext';
import { useCart } from '../../state/CartContext';
import type { Address } from '../../types/orderForm';
import { lookupCep } from '../../lib/cepService';
import { formatBRL } from '../../utils/currency';
import { safeGet, safeSet } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { isOn } from '../../config/featureFlags';
import { getAnalyticsSessionId, trackStorefrontEvent } from '@/features/analytics/client/runtime';
import { resolveSelectedShippingOption, simulateLogisticsClient } from '../../lib/logisticsClient';

type CheckoutStep = 'profile' | 'address' | 'shipping' | 'payment' | 'review';
type PaymentMethod = 'pix' | 'cash_on_delivery' | 'credit_card';

function generateOrderFormRuntimeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function maskCEP(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

function maskUF(value: string) {
  return value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function maskCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function maskExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.replace(/(\d{2})(\d{0,2})/, (_match, month, year) => (year ? `${month}/${year}` : month));
}

function maskCVC(value: string) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export default function CheckoutView() {
  const router = useRouter();
  const { orderForm, setOrderForm, setShipping } = useOrderForm();
  const { clear } = useCart();
  const [step, setStep] = useState<CheckoutStep>('profile');
  const [pm, setPm] = useState<PaymentMethod>('pix');
  const [placing, setPlacing] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addr, setAddr] = useState<Address>(() => orderForm.shipping.selectedAddress || {});
  const [profile, setProfile] = useState({
    firstName: orderForm.clientProfileData?.firstName ?? '',
    lastName: orderForm.clientProfileData?.lastName ?? '',
    email: orderForm.clientProfileData?.email ?? '',
    phone: orderForm.clientProfileData?.phone ?? '',
  });
  const [ccNumber, setCcNumber] = useState('');
  const [ccExpiry, setCcExpiry] = useState('');
  const [ccCvc, setCcCvc] = useState('');
  const [ccHolder, setCcHolder] = useState('');
  const showError = isOn('ecom.checkout.error');
  const enabledStepMap = React.useMemo(
    () => ({
      profile: isOn('ecom.checkout.step.profile'),
      address: isOn('ecom.checkout.step.address'),
      shipping: isOn('ecom.checkout.step.shipping'),
      payment: isOn('ecom.checkout.step.payment'),
      review: isOn('ecom.checkout.step.review'),
    }),
    [],
  );
  const stepsOrder: CheckoutStep[] = ['profile', 'address', 'shipping', 'payment', 'review'];
  const enabledSteps = stepsOrder.filter((checkoutStep) => enabledStepMap[checkoutStep]);
  const firstEnabledStep = enabledSteps[0] || 'review';
  const hasAnyStepEnabled = enabledSteps.length > 0;

  useEffect(() => {
    setAddr(orderForm.shipping.selectedAddress || {});
    setProfile({
      firstName: orderForm.clientProfileData?.firstName ?? '',
      lastName: orderForm.clientProfileData?.lastName ?? '',
      email: orderForm.clientProfileData?.email ?? '',
      phone: orderForm.clientProfileData?.phone ?? '',
    });

    const savedPm = safeGet(STORAGE_KEYS.checkoutPm);
    if (savedPm) setPm(savedPm as PaymentMethod);
  }, [orderForm.clientProfileData, orderForm.shipping.selectedAddress]);

  const itemsTotal = useMemo(
    () => orderForm.totalizers.find((totalizer) => totalizer.id === 'Items')?.value ?? 0,
    [orderForm.totalizers],
  );
  const shippingValue = useMemo(
    () => orderForm.totalizers.find((totalizer) => totalizer.id === 'Shipping')?.value ?? 0,
    [orderForm.totalizers],
  );
  const discounts = useMemo(
    () => orderForm.totalizers.find((totalizer) => totalizer.id === 'Discounts')?.value ?? 0,
    [orderForm.totalizers],
  );
  const grandTotal = useMemo(() => itemsTotal + shippingValue + discounts, [itemsTotal, shippingValue, discounts]);
  const selectedShippingOption = useMemo(() => resolveSelectedShippingOption(orderForm.shipping), [orderForm.shipping]);
  const shippingOptions = useMemo(
    () => [...orderForm.shipping.deliveryOptions, ...orderForm.shipping.pickupOptions],
    [orderForm.shipping.deliveryOptions, orderForm.shipping.pickupOptions],
  );

  useEffect(() => {
    if (!enabledStepMap[step]) setStep(firstEnabledStep);
  }, [enabledStepMap, step, firstEnabledStep]);

  useEffect(() => {
    trackStorefrontEvent({
      type: 'checkout_step',
      checkoutStep: step,
      paymentMethod: pm,
      cartItemsCount: orderForm.items.reduce((sum, item) => sum + item.quantity, 0),
      cartValue: grandTotal,
    });
  }, [step, pm, orderForm.items, grandTotal]);

  function nextEnabledStep(from: CheckoutStep): CheckoutStep {
    const currentIndex = stepsOrder.indexOf(from);
    for (let index = currentIndex + 1; index < stepsOrder.length; index++) {
      const candidate = stepsOrder[index];
      if (enabledStepMap[candidate]) return candidate;
    }
    return from;
  }

  function shouldValidate(requiredStep: CheckoutStep, targetStep: CheckoutStep) {
    if (!enabledStepMap[requiredStep]) return false;
    return stepsOrder.indexOf(targetStep) >= stepsOrder.indexOf(requiredStep);
  }

  function updateProfile(data: Partial<typeof profile>) {
    setOrderForm((prev) => ({ ...prev, clientProfileData: { ...(prev.clientProfileData ?? {}), ...data } }));
  }

  function persistProfile() {
    updateProfile({
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
    });
  }

  function updateAddress(address: Address) {
    setAddr(address);
    setShipping({ address });
  }

  async function refreshShippingOptions(nextAddress: Address) {
    setShippingLoading(true);
    try {
      const result = await simulateLogisticsClient({
        address: nextAddress,
        postalCode: nextAddress.postalCode,
        items: orderForm.items.map((item) => ({ id: item.id, quantity: item.quantity })),
      });

      if (!result.options.length) {
        throw new Error('Nenhuma opção logística disponível para este endereço.');
      }

      const deliveryOptions = result.options.filter((option) => option.mode === 'delivery');
      const pickupOptions = result.options
        .filter((option) => option.mode === 'pickup')
        .map((option) => ({ ...option, address: option.pickupAddress || null }));
      const selectedId = result.recommendedOptionId || deliveryOptions[0]?.id || pickupOptions[0]?.id || null;
      const selectedMode = selectedId?.startsWith('pickup') ? 'pickup' : 'delivery';

      setShipping({
        address: nextAddress,
        deliveryOptions,
        pickupOptions,
        selectedOptionId: selectedId,
        selectedMode,
      });
    } finally {
      setShippingLoading(false);
    }
  }

  function openStep(nextStep: CheckoutStep) {
    if (!enabledStepMap[nextStep]) return;
    setFormError(null);
    if (nextStep === 'address' || nextStep === 'shipping' || nextStep === 'payment' || nextStep === 'review') {
      persistProfile();
    }
    setStep(nextStep);
  }

  function selectPayment(method: PaymentMethod) {
    setPm(method);
    safeSet(STORAGE_KEYS.checkoutPm, method);
    trackStorefrontEvent({
      type: 'checkout_step',
      checkoutStep: 'payment_selected',
      paymentMethod: method,
      cartValue: grandTotal,
    });
    setOrderForm((prev) => ({
      ...prev,
      paymentData: {
        ...prev.paymentData,
        payments: [{ system: method, value: grandTotal }],
        isValid: method !== 'credit_card',
      },
    }));
  }

  function validateProfile() {
    if (!profile.firstName.trim() || !profile.email.trim()) {
      setFormError('Informe nome e e-mail para continuar.');
      setStep('profile');
      return false;
    }
    return true;
  }

  function validateAddress() {
    if (!addr.postalCode || !addr.city || !addr.state || !addr.street) {
      setFormError('Preencha CEP, rua, cidade e UF para continuar.');
      setStep('address');
      return false;
    }
    return true;
  }

  function validateShipping() {
    if (!shippingOptions.length || !orderForm.shipping.selectedOptionId) {
      setFormError('Selecione uma modalidade de entrega para continuar.');
      setStep('shipping');
      return false;
    }
    return true;
  }

  function validatePayment() {
    if (pm !== 'credit_card') return true;
    const cardDigits = ccNumber.replace(/\D/g, '');
    if (cardDigits.length < 16 || ccExpiry.length < 5 || ccCvc.length < 3 || !ccHolder.trim()) {
      setFormError('Preencha os dados do cartão para continuar.');
      setStep('payment');
      return false;
    }
    return true;
  }

  async function handleContinue(nextStep: CheckoutStep) {
    if (shouldValidate('profile', nextStep) && !validateProfile()) return;
    if (shouldValidate('address', nextStep) && !validateAddress()) return;

    if ((nextStep === 'shipping' || nextStep === 'payment' || nextStep === 'review') && addr.postalCode) {
      try {
        await refreshShippingOptions(addr);
      } catch (shippingError) {
        setFormError(shippingError instanceof Error ? shippingError.message : 'Não foi possível simular a entrega.');
        setStep('address');
        return;
      }
    }

    if (shouldValidate('shipping', nextStep) && !validateShipping()) return;
    if (shouldValidate('payment', nextStep) && !validatePayment()) return;
    openStep(nextStep);
  }

  function placeOrder() {
    if (!orderForm.items.length) {
      setFormError('Seu carrinho está vazio.');
      return;
    }
    if (enabledStepMap.profile && !validateProfile()) return;
    if (enabledStepMap.address && !validateAddress()) return;
    if (enabledStepMap.shipping && !validateShipping()) return;
    if (enabledStepMap.payment && !validatePayment()) return;

    setPlacing(true);
    setFormError(null);
    setOrderForm((prev) => ({
      ...prev,
      paymentData: {
        ...prev.paymentData,
        payments: [{ system: pm, value: grandTotal }],
        isValid: true,
      },
    }));

    const payload = {
      orderFormId: orderForm.id,
      draftToken: orderForm.draftToken,
      items: orderForm.items,
      clientProfileData: {
        ...orderForm.clientProfileData,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
      },
      shipping: orderForm.shipping,
      payments: [{ system: pm, value: grandTotal }],
      totalizers: orderForm.totalizers,
      value: grandTotal,
    };

    fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-hub-analytics-session': getAnalyticsSessionId(),
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then((result) => {
        try {
          clear();
        } catch {}
        setOrderForm((prev) => ({
          ...prev,
          id: generateOrderFormRuntimeId(),
          sessionStartedAt: new Date().toISOString(),
          draftId: null,
          draftToken: null,
          draftUpdatedAt: null,
          items: [],
          totalizers: [],
          value: 0,
        }));
        const params = new URLSearchParams();
        params.set('orderId', String(result.orderId || ''));
        if (Array.isArray(result.orderIds) && result.orderIds.length) {
          params.set('orderIds', result.orderIds.join(','));
        }
        if (result.primaryOrderId) {
          params.set('primaryOrderId', String(result.primaryOrderId));
        }
        if (result.publicToken) {
          params.set('publicToken', String(result.publicToken));
        }
        router.push(`/e-commerce/checkout/confirmation?${params.toString()}`);
      })
      .catch((checkoutError: Error) => {
        setFormError(`Falha ao fechar pedido: ${checkoutError.message}`);
      })
      .finally(() => setPlacing(false));
  }

  return (
    <div className="checkout">
      <div className="checkout__content">
        {!hasAnyStepEnabled ? <div className="co-error" role="status">Nenhuma etapa do checkout está habilitada no feature flag.</div> : null}
        {showError && formError ? <div className="co-error" role="alert">{formError}</div> : null}

        {enabledStepMap.profile ? (
          <section className="co-step">
            <h2 className="co-step__header">
              <button type="button" className="co-step__toggle" aria-expanded={step === 'profile'} aria-controls="co-step-profile" onClick={() => openStep('profile')}>
                1. Identificação
              </button>
            </h2>
            {step === 'profile' ? (
              <div className="co-step__body" id="co-step-profile">
                <div className="co-field">
                  <label htmlFor="profile-firstName">Nome</label>
                  <input id="profile-firstName" type="text" value={profile.firstName} onChange={(event) => setProfile((prev) => ({ ...prev, firstName: event.target.value }))} onBlur={persistProfile} />
                </div>
                <div className="co-field">
                  <label htmlFor="profile-lastName">Sobrenome</label>
                  <input id="profile-lastName" type="text" value={profile.lastName} onChange={(event) => setProfile((prev) => ({ ...prev, lastName: event.target.value }))} onBlur={persistProfile} />
                </div>
                <div className="co-field">
                  <label htmlFor="profile-email">E-mail</label>
                  <input id="profile-email" type="email" value={profile.email} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} onBlur={persistProfile} />
                </div>
                <div className="co-field">
                  <label htmlFor="profile-phone">Telefone</label>
                  <input id="profile-phone" type="tel" placeholder="(11) 91234-5678" value={maskPhone(profile.phone)} onChange={(event) => setProfile((prev) => ({ ...prev, phone: maskPhone(event.target.value) }))} onBlur={persistProfile} />
                </div>
                <div className="co-actions">
                  <button type="button" onClick={() => void handleContinue(nextEnabledStep('profile'))}>Continuar</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {enabledStepMap.address ? (
          <section className="co-step">
            <h2 className="co-step__header">
              <button type="button" className="co-step__toggle" aria-expanded={step === 'address'} aria-controls="co-step-address" onClick={() => openStep('address')}>
                2. Endereço
              </button>
            </h2>
            {step === 'address' ? (
              <div className="co-step__body" id="co-step-address">
                <div className="co-grid">
                  <div className="co-field">
                    <label htmlFor="address-postalCode">CEP</label>
                    <input
                      id="address-postalCode"
                      type="text"
                      placeholder="00000-000"
                      value={maskCEP(addr.postalCode || '')}
                      onChange={(event) => setAddr({ ...addr, postalCode: maskCEP(event.target.value) })}
                      onBlur={async (event) => {
                        const data = await lookupCep(event.target.value);
                        if (data) {
                          const mergedAddress = {
                            ...addr,
                            postalCode: data.cep,
                            street: data.street ?? addr.street,
                            neighborhood: data.neighborhood ?? addr.neighborhood,
                            city: data.city ?? addr.city,
                            state: data.state ?? addr.state,
                            country: data.country ?? addr.country,
                          };
                          updateAddress(mergedAddress);
                        } else {
                          updateAddress({ ...addr, postalCode: maskCEP(event.target.value) });
                        }
                      }}
                    />
                  </div>
                  <div className="co-field"><label htmlFor="address-street">Rua</label><input id="address-street" type="text" value={addr.street || ''} onChange={(event) => setAddr({ ...addr, street: event.target.value })} onBlur={() => updateAddress(addr)} /></div>
                  <div className="co-field"><label htmlFor="address-number">Número</label><input id="address-number" type="text" value={addr.number || ''} onChange={(event) => setAddr({ ...addr, number: event.target.value })} onBlur={() => updateAddress(addr)} /></div>
                  <div className="co-field"><label htmlFor="address-complement">Complemento</label><input id="address-complement" type="text" value={addr.complement || ''} onChange={(event) => setAddr({ ...addr, complement: event.target.value })} onBlur={() => updateAddress(addr)} /></div>
                  <div className="co-field"><label htmlFor="address-neighborhood">Bairro</label><input id="address-neighborhood" type="text" value={addr.neighborhood || ''} onChange={(event) => setAddr({ ...addr, neighborhood: event.target.value })} onBlur={() => updateAddress(addr)} /></div>
                  <div className="co-field"><label htmlFor="address-city">Cidade</label><input id="address-city" type="text" value={addr.city || ''} onChange={(event) => setAddr({ ...addr, city: event.target.value })} onBlur={() => updateAddress(addr)} /></div>
                  <div className="co-field"><label htmlFor="address-state">UF</label><input id="address-state" type="text" maxLength={2} value={addr.state || ''} onChange={(event) => setAddr({ ...addr, state: maskUF(event.target.value) })} onBlur={() => updateAddress(addr)} /></div>
                </div>
                <div className="co-actions">
                  <button type="button" onClick={() => void handleContinue(nextEnabledStep('address'))}>
                    {shippingLoading ? 'Simulando…' : 'Continuar'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {enabledStepMap.shipping ? (
          <section className="co-step">
            <h2 className="co-step__header">
              <button type="button" className="co-step__toggle" aria-expanded={step === 'shipping'} aria-controls="co-step-shipping" onClick={() => openStep('shipping')}>
                3. Entrega
              </button>
            </h2>
            {step === 'shipping' ? (
              <div className="co-step__body" id="co-step-shipping">
                {!shippingOptions.length ? <p className="panel-muted">Informe o endereço para carregar as opções logísticas.</p> : null}
                {shippingOptions.map((option) => (
                  <div className="co-radio" key={option.id}>
                    <label>
                      <input
                        type="radio"
                        name="ship"
                        checked={orderForm.shipping.selectedOptionId === option.id}
                        data-track-id={`checkout-ship-${option.id}`}
                        onChange={() =>
                          setShipping({
                            address: addr,
                            deliveryOptions: orderForm.shipping.deliveryOptions,
                            pickupOptions: orderForm.shipping.pickupOptions,
                            selectedOptionId: option.id,
                            selectedMode: option.mode || (option.id.startsWith('pickup') ? 'pickup' : 'delivery'),
                          })
                        }
                      />
                      {option.name} {option.estimate ? `(${option.estimate})` : ''} • {formatBRL(option.price)}
                      {option.splitShipment ? ' • atendimento dividido' : ''}
                    </label>
                  </div>
                ))}
                <div className="co-actions">
                  <button type="button" onClick={() => void handleContinue(nextEnabledStep('shipping'))}>Continuar</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {enabledStepMap.payment ? (
          <section className="co-step">
            <h2 className="co-step__header">
              <button type="button" className="co-step__toggle" aria-expanded={step === 'payment'} aria-controls="co-step-payment" onClick={() => openStep('payment')}>
                4. Pagamento
              </button>
            </h2>
            {step === 'payment' ? (
              <div className="co-step__body" id="co-step-payment">
                <div className="co-radio"><label><input type="radio" name="pm" data-track-id="checkout-pay-pix" checked={pm === 'pix'} onChange={() => selectPayment('pix')} />PIX</label></div>
                <div className="co-radio"><label><input type="radio" name="pm" data-track-id="checkout-pay-cod" checked={pm === 'cash_on_delivery'} onChange={() => selectPayment('cash_on_delivery')} />Pagamento na entrega</label></div>
                <div className="co-radio"><label><input type="radio" name="pm" data-track-id="checkout-pay-credit" checked={pm === 'credit_card'} onChange={() => selectPayment('credit_card')} />Cartão de crédito</label></div>
                {pm === 'credit_card' ? (
                  <div className="co-grid">
                    <div className="co-field"><label htmlFor="card-number">Número do cartão</label><input id="card-number" type="text" inputMode="numeric" placeholder="0000 0000 0000 0000" value={ccNumber} onChange={(event) => setCcNumber(maskCardNumber(event.target.value))} /></div>
                    <div className="co-field"><label htmlFor="card-expiry">Validade</label><input id="card-expiry" type="text" inputMode="numeric" placeholder="MM/AA" value={ccExpiry} onChange={(event) => setCcExpiry(maskExpiry(event.target.value))} /></div>
                    <div className="co-field"><label htmlFor="card-cvc">CVC</label><input id="card-cvc" type="text" inputMode="numeric" placeholder="123" value={ccCvc} onChange={(event) => setCcCvc(maskCVC(event.target.value))} /></div>
                    <div className="co-field"><label htmlFor="card-holder">Titular</label><input id="card-holder" type="text" placeholder="Nome completo" value={ccHolder} onChange={(event) => setCcHolder(event.target.value)} /></div>
                  </div>
                ) : null}
                <div className="co-actions">
                  <button type="button" onClick={() => void handleContinue(nextEnabledStep('payment'))}>Revisão</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {enabledStepMap.review ? (
          <section className="co-step">
            <h2 className="co-step__header">
              <button type="button" className="co-step__toggle" aria-expanded={step === 'review'} aria-controls="co-step-review" onClick={() => openStep('review')}>
                5. Revisão e Finalização
              </button>
            </h2>
            {step === 'review' ? (
              <div className="co-step__body" id="co-step-review">
                <ul className="co-items">
                  {orderForm.items.map((item) => (
                    <li key={item.id} className="co-item"><span>{item.name}</span><span>x{item.quantity}</span><span>{formatBRL(item.price * item.quantity)}</span></li>
                  ))}
                </ul>
                <div className="co-summary">
                  <div><span>Itens</span><b>{formatBRL(itemsTotal)}</b></div>
                  <div><span>{selectedShippingOption?.mode === 'pickup' ? 'Retirada' : 'Frete'}</span><b>{formatBRL(shippingValue)}</b></div>
                  {selectedShippingOption ? <div><span>Opção</span><b>{selectedShippingOption.name}</b></div> : null}
                  {discounts < 0 ? <div><span>Descontos</span><b>- {formatBRL(Math.abs(discounts))}</b></div> : null}
                  <div className="co-total"><span>Total</span><b>{formatBRL(grandTotal)}</b></div>
                </div>
                <div className="co-actions">
                  <button className="co-place" data-track-id="checkout-place-order" type="button" onClick={placeOrder} disabled={placing}>
                    {placing ? 'Finalizando…' : 'Finalizar pedido'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {isOn('ecom.checkout.asideSummary') ? (
        <aside className="checkout__aside">
          <div className="co-card">
            <h3>Resumo</h3>
            <div className="co-row"><span>Itens</span><span>{formatBRL(itemsTotal)}</span></div>
            <div className="co-row"><span>{selectedShippingOption?.mode === 'pickup' ? 'Retirada' : 'Frete'}</span><span>{formatBRL(shippingValue)}</span></div>
            {discounts < 0 ? <div className="co-row"><span>Descontos</span><span>- {formatBRL(Math.abs(discounts))}</span></div> : null}
            <div className="co-row co-row--total"><span>Total</span><span>{formatBRL(grandTotal)}</span></div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
