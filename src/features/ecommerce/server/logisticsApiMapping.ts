import type { ShippingOption } from '@/features/ecommerce/types/orderForm';
import type { LogisticsSimulationResult } from '@/features/ecommerce/types/logistics';

export function mapLogisticsResultToShippingResponse(result: LogisticsSimulationResult) {
  return {
    ...result,
    options: result.options.map(
      (option) =>
        ({
          id: option.id,
          name: option.label,
          price: option.price,
          estimate: option.estimate,
          mode: option.mode,
          originIds: option.originIds,
          originNames: option.originNames,
          policyIds: option.policyIds,
          matchedZoneIds: option.matchedZoneIds,
          splitShipment: option.splitShipment,
          allocations: option.allocations,
          estimateDaysMin: option.estimateDaysMin,
          estimateDaysMax: option.estimateDaysMax,
          itemValue: option.itemValue,
          totalValue: option.totalValue,
          pickupInstructions: option.pickupInstructions,
          pickupAddress: option.pickupAddress || null,
        }) satisfies ShippingOption,
    ),
  };
}
