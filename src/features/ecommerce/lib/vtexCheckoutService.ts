import type { OrderFormItem, Address, ShippingData, Totalizer } from '../types/orderForm';
import { isVtexLive } from './runtimeConfig';

// Minimal VTEX Checkout client through our BFF proxy
// Note: VTEX prices are in BRL, while some APIs may return cents. We keep our UI using BRL numbers.

export async function vtexSkuLookupByRefId(refId: string) {
  const res = await fetch(`/api/vtex/search?term=${encodeURIComponent(refId)}&page=1&pageSize=1`, { cache: 'no-store' });
  if (!res.ok) return null;
  const arr = await res.json();
  const firstProduct = Array.isArray(arr) ? arr[0] : null;
  const sku = firstProduct?.items?.[0];
  return sku ? { skuId: sku.itemId as string, seller: sku.sellers?.[0]?.sellerId as string } : null;
}

export async function simulateShipping(address: Address, items: OrderFormItem[]): Promise<{ shipping: ShippingData; totalizers: Totalizer[] } | null> {
  if (!isVtexLive()) return null;
  // Map our items to VTEX simulation items
  const mapped: Array<{ id: string; quantity: number; seller: string }> = [];
  for (const it of items) {
    // Try to resolve SKU id via search (assuming id is productId or refId)
    const sku = await vtexSkuLookupByRefId(it.id);
    if (!sku) continue;
    mapped.push({ id: sku.skuId, quantity: it.quantity, seller: sku.seller || '1' });
  }
  if (!mapped.length) return null;

  const body = {
    items: mapped,
    postalCode: address.postalCode,
    country: address.country || 'BRA',
  };
  const res = await fetch('/api/vtex/checkout/simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // data.logisticsInfo[].slas contains delivery options
  const deliveryOptionsFromVtex: Array<{ id: string; name: string; price: number; shippingEstimate?: string }> = [];
  if (Array.isArray(data.logisticsInfo)) {
    for (const li of data.logisticsInfo) {
      if (Array.isArray(li.slas)) {
        for (const sla of li.slas) {
          const price = typeof sla.price === 'number' ? sla.price / 100 : 0;
          deliveryOptionsFromVtex.push({ id: sla.id, name: sla.name, price, shippingEstimate: sla.shippingEstimate });
        }
      }
    }
  }
  // Pick distinct SLAs by id/name with the lowest price
  const bestByKey = new Map<string, { id: string; name: string; price: number; estimate?: string }>();
  for (const option of deliveryOptionsFromVtex) {
    const key = option.id || option.name;
    const existing = bestByKey.get(key);
    const current = { id: option.id || option.name, name: option.name, price: option.price, estimate: option.shippingEstimate };
    if (!existing || current.price < existing.price) bestByKey.set(key, current);
  }
  const options = Array.from(bestByKey.values());
  const shipping: ShippingData = {
    countries: ['BRA'],
    availableAddresses: [address],
    selectedAddress: address,
    deliveryOptions: options,
    pickupOptions: [],
    isValid: true,
  };
  // Build totalizers addition for shipping, do not change items/discounts here
  const totalizers: Totalizer[] = [{ id: 'Shipping', name: 'Frete', value: options[0]?.price ?? 0 }];
  return { shipping, totalizers };
}
