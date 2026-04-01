import type { Address, OrderFormItem, ShippingData, ShippingOption } from '../types/orderForm';

export type LogisticsSimulationApiResponse = {
  coverage: 'covered' | 'partial' | 'unavailable';
  postalCode?: string;
  options: ShippingOption[];
  recommendedOptionId?: string;
  matchedZoneIds: string[];
  unmatchedItemIds: string[];
};

export function resolveSelectedShippingOption(shipping: ShippingData): ShippingOption | null {
  const delivery = shipping.deliveryOptions || [];
  const pickup = shipping.pickupOptions || [];
  return (
    delivery.find((option) => option.id === shipping.selectedOptionId) ||
    pickup.find((option) => option.id === shipping.selectedOptionId) ||
    (shipping.selectedMode === 'pickup' ? pickup[pickup.length - 1] : delivery[delivery.length - 1]) ||
    delivery[delivery.length - 1] ||
    pickup[pickup.length - 1] ||
    null
  );
}

export async function simulateLogisticsClient(input: {
  postalCode?: string;
  address?: Address | null;
  items?: Array<Pick<OrderFormItem, 'id' | 'quantity'>>;
  mode?: 'delivery' | 'pickup';
}): Promise<LogisticsSimulationApiResponse> {
  const response = await fetch('/api/ecommerce/logistics/simulate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postalCode: input.postalCode,
      address: input.address,
      mode: input.mode,
      items: Array.isArray(input.items)
        ? input.items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          }))
        : [],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as LogisticsSimulationApiResponse;
}
