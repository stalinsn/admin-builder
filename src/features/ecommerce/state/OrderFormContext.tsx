"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderForm, OrderFormItem, ShippingData, Address, ShippingOption, Totalizer } from '../types/orderForm';
import { safeJsonGet, safeJsonSet } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { useCart } from './CartContext';
import { isVtexLive } from '../lib/runtimeConfig';
import { simulateShipping } from '../lib/vtexCheckoutService';
import { buildOrderPricing } from '../lib/pricing';

const STORAGE_KEY = STORAGE_KEYS.orderForm;
const ORDER_DRAFT_MIN_SESSION_MS = 20 * 60 * 1000;

function generateId() {
  const cryptoObj: unknown = (typeof crypto !== 'undefined') ? (crypto as unknown) : undefined;
  if (cryptoObj && typeof cryptoObj === 'object' && 'randomUUID' in (cryptoObj as Record<string, unknown>)) {
    return (cryptoObj as { randomUUID: () => string }).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function itemsEqual(left: OrderFormItem[], right: OrderFormItem[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const itemLeft = left[index];
    const itemRight = right[index];
    if (!itemLeft || !itemRight) return false;
    if (
      itemLeft.id !== itemRight.id ||
      itemLeft.name !== itemRight.name ||
      itemLeft.price !== itemRight.price ||
      itemLeft.image !== itemRight.image ||
      itemLeft.listPrice !== itemRight.listPrice ||
      itemLeft.unit !== itemRight.unit ||
      itemLeft.packSize !== itemRight.packSize ||
      itemLeft.quantity !== itemRight.quantity
    ) {
      return false;
    }
  }
  return true;
}

function totalizersEqual(left: Totalizer[], right: Totalizer[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const totalizerLeft = left[index];
    const totalizerRight = right[index];
    if (!totalizerLeft || !totalizerRight) return false;
    if (
      totalizerLeft.id !== totalizerRight.id ||
      totalizerLeft.name !== totalizerRight.name ||
      totalizerLeft.value !== totalizerRight.value
    ) {
      return false;
    }
  }
  return true;
}

function normalizeShipping(shipping?: Partial<ShippingData> | null): ShippingData {
  return {
    countries: shipping?.countries || [],
    availableAddresses: shipping?.availableAddresses || [],
    selectedAddress: shipping?.selectedAddress || null,
    deliveryOptions: shipping?.deliveryOptions || [],
    pickupOptions: shipping?.pickupOptions || [],
    selectedOptionId: shipping?.selectedOptionId || null,
    selectedMode: shipping?.selectedMode || null,
    isValid: Boolean(shipping?.isValid),
  };
}

type Ctx = {
  orderForm: OrderForm;
  setOrderForm: React.Dispatch<React.SetStateAction<OrderForm>>;
  refreshFromCart: () => void;
  updateMarketing: (data: Partial<OrderForm['marketingData']>) => void;
  updatePreferences: (data: Partial<OrderForm['clientPreferencesData']>) => void;
  setShipping: (params: {
    address?: Address | null;
    option?: ShippingOption | null;
    deliveryOptions?: ShippingOption[];
    pickupOptions?: Array<ShippingOption & { address?: Address | null }>;
    selectedOptionId?: string | null;
    selectedMode?: 'delivery' | 'pickup' | null;
  }) => void;
};

const OrderFormCtx = createContext<Ctx | null>(null);

export function OrderFormProvider({ children }: { children: React.ReactNode }) {
  const { state: cart } = useCart();
  const [orderForm, setOrderForm] = useState<OrderForm>(() => ({
    id: generateId(),
    sessionStartedAt: new Date().toISOString(),
    draftId: null,
    draftToken: null,
    draftUpdatedAt: null,
    items: [],
    value: 0,
    totalizers: [],
    marketingData: {},
    canEditData: true,
    loggedIn: false,
    paymentData: {
      paymentSystems: [
        { id: 'pix', name: 'PIX' },
        { id: 'cash_on_delivery', name: 'Pagamento na entrega' },
        { id: 'credit_card', name: 'Cartão de crédito' },
      ],
      payments: [],
      installmentOptions: [],
      availableAccounts: [],
      isValid: false,
    },
    messages: { couponMessages: [], generalMessages: [] },
    shipping: { countries: [], availableAddresses: [], selectedAddress: null, deliveryOptions: [], pickupOptions: [], selectedOptionId: null, selectedMode: null, isValid: false },
    userProfileId: null,
    userType: 'STORE_USER',
    clientProfileData: null,
    clientPreferencesData: { locale: 'pt-BR', optInNewsletter: null },
    allowManualPrice: false,
    customData: null,
  }));
  const [hydrated, setHydrated] = useState(false);
  const orderFormRef = useRef(orderForm);
  const lastDraftSyncSignatureRef = useRef<string>('');

  useEffect(() => {
    orderFormRef.current = orderForm;
  }, [orderForm]);

  useEffect(() => {
    if (!hydrated) return;
    safeJsonSet(STORAGE_KEY, orderForm);
  }, [orderForm, hydrated]);

  useEffect(() => {
    const persisted = safeJsonGet<OrderForm | null>(STORAGE_KEY, null);
    if (persisted) {
      setOrderForm((prev) => {
        const merged: OrderForm = {
          ...prev,
          ...persisted,
          marketingData: { ...prev.marketingData, ...(persisted.marketingData || {}) },
          paymentData: { ...prev.paymentData, ...(persisted.paymentData || {}) },
          messages: { ...prev.messages, ...(persisted.messages || {}) },
          shipping: normalizeShipping(persisted.shipping),
          clientPreferencesData: { ...prev.clientPreferencesData, ...(persisted.clientPreferencesData || {}) },
        };
        const pricing = buildOrderPricing({
          items: merged.items,
          shipping: merged.shipping,
          coupon: merged.marketingData.coupon,
        });
        return {
          ...merged,
          sessionStartedAt: merged.sessionStartedAt || prev.sessionStartedAt || new Date().toISOString(),
          totalizers: pricing.totalizers,
          value: pricing.value,
          messages: { ...merged.messages, couponMessages: pricing.couponMessages },
        };
      });
    }
    setHydrated(true);
  }, []);

  const refreshFromCart = React.useCallback(() => {
    setOrderForm((prev) => {
      const items: OrderFormItem[] = Object.values(cart.items).map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        price: item.price,
        listPrice: item.listPrice,
        unit: item.unit,
        packSize: item.packSize,
        quantity: item.qty,
      }));

      const pricing = buildOrderPricing({
        items,
        shipping: prev.shipping,
        coupon: prev.marketingData.coupon,
      });

      if (
        itemsEqual(prev.items, items) &&
        totalizersEqual(prev.totalizers, pricing.totalizers) &&
        prev.value === pricing.value &&
        prev.messages.couponMessages.join('|') === pricing.couponMessages.join('|')
      ) {
        return prev;
      }

      return {
        ...prev,
        items,
        totalizers: pricing.totalizers,
        value: pricing.value,
        messages: { ...prev.messages, couponMessages: pricing.couponMessages },
      };
    });
  }, [cart.items]);

  useEffect(() => {
    refreshFromCart();
  }, [refreshFromCart]);

  useEffect(() => {
    if (!hydrated) return;

    const shouldPersistDraft =
      orderForm.items.length > 0 ||
      Boolean(orderForm.clientProfileData?.email) ||
      Boolean(orderForm.shipping.selectedAddress?.postalCode) ||
      Boolean(orderForm.draftToken);

    if (!shouldPersistDraft) return;

    const sessionStartedAt = orderForm.sessionStartedAt ? new Date(orderForm.sessionStartedAt).getTime() : Date.now();
    const sessionAgeMs = Date.now() - sessionStartedAt;
    const canPersistDraft = sessionAgeMs >= ORDER_DRAFT_MIN_SESSION_MS || Boolean(orderForm.draftToken);
    if (!canPersistDraft) return;

    const payload = {
      orderFormId: orderForm.id,
      draftToken: orderForm.draftToken,
      customerEmail: orderForm.clientProfileData?.email || null,
      items: orderForm.items,
      clientProfileData: orderForm.clientProfileData,
      shippingAddress: orderForm.shipping.selectedAddress,
        shippingOptions: {
          deliveryOptions: orderForm.shipping.deliveryOptions,
          pickupOptions: orderForm.shipping.pickupOptions,
          selectedOptionId: orderForm.shipping.selectedOptionId || orderForm.shipping.deliveryOptions[0]?.id || null,
          selectedMode: orderForm.shipping.selectedMode || null,
        },
      payments: orderForm.paymentData.payments,
      totalizers: orderForm.totalizers,
      value: orderForm.value,
      customData: orderForm.customData,
    };

    const signature = JSON.stringify(payload);
    if (lastDraftSyncSignatureRef.current === signature) return;

    const timeout = window.setTimeout(() => {
      fetch('/api/ecommerce/order-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(await response.text());
          return response.json();
        })
        .then((result) => {
          lastDraftSyncSignatureRef.current = signature;
          const draft = result?.draft;
          if (!draft) return;

          setOrderForm((prev) => {
            const nextDraftId = typeof draft.id === 'string' ? draft.id : prev.draftId || null;
            const nextDraftToken = typeof draft.publicToken === 'string' ? draft.publicToken : prev.draftToken || null;
            if (prev.draftId === nextDraftId && prev.draftToken === nextDraftToken) {
              return prev;
            }

            return {
              ...prev,
              draftId: nextDraftId,
              draftToken: nextDraftToken,
              draftUpdatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : prev.draftUpdatedAt || null,
            };
          });
        })
        .catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    hydrated,
    orderForm.id,
    orderForm.sessionStartedAt,
    orderForm.draftToken,
    orderForm.items,
    orderForm.clientProfileData,
    orderForm.shipping.selectedAddress,
    orderForm.shipping.deliveryOptions,
    orderForm.shipping.pickupOptions,
    orderForm.paymentData.payments,
    orderForm.totalizers,
    orderForm.value,
    orderForm.customData,
  ]);

  const updateMarketing = React.useCallback((data: Partial<OrderForm['marketingData']>) => {
    setOrderForm((prev) => {
      const marketingData = { ...prev.marketingData, ...data };
      const pricing = buildOrderPricing({
        items: prev.items,
        shipping: prev.shipping,
        coupon: marketingData.coupon,
      });
      return {
        ...prev,
        marketingData,
        totalizers: pricing.totalizers,
        value: pricing.value,
        messages: { ...prev.messages, couponMessages: pricing.couponMessages },
      };
    });
  }, []);

  const updatePreferences = React.useCallback((data: Partial<OrderForm['clientPreferencesData']>) => {
    setOrderForm((prev) => ({ ...prev, clientPreferencesData: { ...prev.clientPreferencesData, ...data } }));
  }, []);

  const setShipping = React.useCallback((params: {
    address?: Address | null;
    option?: ShippingOption | null;
    deliveryOptions?: ShippingOption[];
    pickupOptions?: Array<ShippingOption & { address?: Address | null }>;
    selectedOptionId?: string | null;
    selectedMode?: 'delivery' | 'pickup' | null;
  }) => {
    setOrderForm((prev) => {
      const nextDeliveryOptions = params.deliveryOptions || (params.option && (params.selectedMode || params.option.mode || 'delivery') === 'delivery' ? [params.option] : prev.shipping.deliveryOptions);
      const nextPickupOptions = params.pickupOptions || (params.option && (params.selectedMode || params.option.mode) === 'pickup' ? [{ ...params.option, address: params.option.pickupAddress || null }] : prev.shipping.pickupOptions);
      const nextSelectedMode = params.selectedMode || params.option?.mode || prev.shipping.selectedMode || (nextPickupOptions.length && !nextDeliveryOptions.length ? 'pickup' : 'delivery');
      const nextSelectedOptionId =
        params.selectedOptionId ||
        params.option?.id ||
        prev.shipping.selectedOptionId ||
        (nextSelectedMode === 'pickup' ? nextPickupOptions[0]?.id : nextDeliveryOptions[0]?.id) ||
        null;

      const shipping: ShippingData = {
        ...prev.shipping,
        selectedAddress: params.address === undefined ? prev.shipping.selectedAddress : (params.address ?? null),
        deliveryOptions: nextDeliveryOptions,
        pickupOptions: nextPickupOptions,
        selectedOptionId: nextSelectedOptionId,
        selectedMode: nextSelectedMode,
        isValid: Boolean(params.address) || Boolean(params.option) || nextDeliveryOptions.length > 0 || nextPickupOptions.length > 0 || prev.shipping.isValid,
      };

      const pricing = buildOrderPricing({
        items: prev.items,
        shipping,
        coupon: prev.marketingData.coupon,
      });

      return {
        ...prev,
        shipping,
        totalizers: pricing.totalizers,
        value: pricing.value,
        messages: { ...prev.messages, couponMessages: pricing.couponMessages },
      };
    });

    if (isVtexLive() && (params.address || params.option === undefined)) {
      setTimeout(async () => {
        try {
          const latest = orderFormRef.current;
          const address = params.address ?? latest.shipping.selectedAddress;
          if (!address) return;
          const update = await simulateShipping(address, latest.items);
          if (!update) return;

          setOrderForm((prev) => {
            const shipping: ShippingData = {
              ...prev.shipping,
              ...update.shipping,
              selectedAddress: update.shipping.selectedAddress ?? prev.shipping.selectedAddress,
            };
            const pricing = buildOrderPricing({
              items: prev.items,
              shipping,
              coupon: prev.marketingData.coupon,
            });
            return {
              ...prev,
              shipping,
              totalizers: pricing.totalizers,
              value: pricing.value,
              messages: { ...prev.messages, couponMessages: pricing.couponMessages },
            };
          });
        } catch {
          // silent fallback to local pricing flow
        }
      }, 0);
    }
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({ orderForm, setOrderForm, refreshFromCart, updateMarketing, updatePreferences, setShipping }),
    [orderForm, refreshFromCart, updateMarketing, updatePreferences, setShipping],
  );

  return <OrderFormCtx.Provider value={ctx}>{children}</OrderFormCtx.Provider>;
}

export function useOrderForm() {
  const ctx = useContext(OrderFormCtx);
  if (!ctx) throw new Error('useOrderForm deve ser usado dentro de <OrderFormProvider>');
  return ctx;
}
