import type { OrderFormItem, ShippingData, Totalizer } from '../types/orderForm';

type CouponKind = 'percent' | 'fixed' | 'shipping';

type CouponRule = {
  code: string;
  kind: CouponKind;
  value: number;
  minSubtotal?: number;
  message: string;
};

type PricingInput = {
  items: OrderFormItem[];
  shipping: ShippingData;
  coupon?: string;
};

type CouponResult = {
  normalizedCoupon: string;
  discount: number;
  message: string;
  valid: boolean;
};

export type OrderPricingResult = {
  value: number;
  totalizers: Totalizer[];
  couponMessages: string[];
};

const COUPON_RULES: CouponRule[] = [
  { code: 'BEMVINDO10', kind: 'percent', value: 10, message: 'Cupom aplicado: 10% off em itens.' },
  { code: 'ECOM15', kind: 'fixed', value: 15, minSubtotal: 120, message: 'Cupom aplicado: R$ 15,00 de desconto.' },
  { code: 'FRETEGRATIS', kind: 'shipping', value: 100, minSubtotal: 80, message: 'Cupom aplicado: frete grátis.' },
];

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeCoupon(raw?: string) {
  return (raw || '').trim().toUpperCase();
}

function shippingTotal(shipping: ShippingData) {
  const deliveryOptions = shipping.deliveryOptions || [];
  const pickupOptions = shipping.pickupOptions || [];
  const selectedFromDelivery = deliveryOptions.find((option) => option.id === shipping.selectedOptionId);
  const selectedFromPickup = pickupOptions.find((option) => option.id === shipping.selectedOptionId);
  const selected =
    selectedFromDelivery ||
    selectedFromPickup ||
    (shipping.selectedMode === 'pickup' ? pickupOptions[pickupOptions.length - 1] : deliveryOptions[deliveryOptions.length - 1]) ||
    deliveryOptions[deliveryOptions.length - 1] ||
    pickupOptions[pickupOptions.length - 1];
  if (!selected) return 0;
  return toMoney(selected?.price || 0);
}

function itemsTotal(items: OrderFormItem[]) {
  return toMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

function resolveCouponDiscount(input: { coupon?: string; subtotal: number; shipping: number }): CouponResult | null {
  const normalizedCoupon = normalizeCoupon(input.coupon);
  if (!normalizedCoupon) return null;

  const rule = COUPON_RULES.find((candidate) => candidate.code === normalizedCoupon);
  if (!rule) {
    return {
      normalizedCoupon,
      discount: 0,
      message: 'Cupom inválido ou indisponível para esta loja.',
      valid: false,
    };
  }

  if (rule.minSubtotal && input.subtotal < rule.minSubtotal) {
    return {
      normalizedCoupon,
      discount: 0,
      message: `Cupom disponível para subtotal acima de R$ ${rule.minSubtotal.toFixed(2)}.`,
      valid: false,
    };
  }

  let rawDiscount = 0;
  if (rule.kind === 'percent') rawDiscount = (input.subtotal * rule.value) / 100;
  if (rule.kind === 'fixed') rawDiscount = rule.value;
  if (rule.kind === 'shipping') rawDiscount = input.shipping;

  const maxDiscount = input.subtotal + input.shipping;
  const discount = Math.min(toMoney(rawDiscount), toMoney(maxDiscount));
  return {
    normalizedCoupon,
    discount,
    message: rule.message,
    valid: discount > 0,
  };
}

export function buildOrderPricing({ items, shipping, coupon }: PricingInput): OrderPricingResult {
  const subtotal = itemsTotal(items);
  const hasItems = subtotal > 0;
  const shippingValue = hasItems ? shippingTotal(shipping) : 0;
  const couponResult = hasItems ? resolveCouponDiscount({ coupon, subtotal, shipping: shippingValue }) : null;
  const discount = couponResult?.valid ? couponResult.discount : 0;
  const discountValue = discount > 0 ? -toMoney(discount) : 0;
  const value = toMoney(subtotal + shippingValue + discountValue);

  const totalizers: Totalizer[] = [{ id: 'Items', name: 'Itens', value: subtotal }];
  if (hasItems && (shipping.deliveryOptions.length > 0 || shipping.pickupOptions.length > 0)) {
    totalizers.push({ id: 'Shipping', name: 'Frete', value: shippingValue });
  }
  if (discountValue < 0) {
    totalizers.push({ id: 'Discounts', name: 'Descontos', value: discountValue });
  }

  const couponMessages = couponResult ? [couponResult.message] : [];
  return { value, totalizers, couponMessages };
}

export function computeSavingsFromListPrice(items: Array<{ price: number; listPrice?: number; quantity: number }>) {
  return toMoney(
    items.reduce((sum, item) => {
      if (!item.listPrice || item.listPrice <= item.price) return sum;
      return sum + (item.listPrice - item.price) * item.quantity;
    }, 0),
  );
}
