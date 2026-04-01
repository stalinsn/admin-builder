import { FEATURE_FLAG_GROUPS } from './catalog';
import { BASE_ECOMMERCE_FEATURE_FLAGS } from './defaults';

export type { FeatureFlagGroup, FeatureFlags, FlagKey } from './types';
export { FEATURE_FLAG_GROUPS };

export const featureFlags = Object.freeze(BASE_ECOMMERCE_FEATURE_FLAGS) as import('./types').FeatureFlags;

export function isOn(key: import('./types').FlagKey | string): boolean {
  return (featureFlags as Record<string, boolean>)[key] ?? false;
}

export function isOff(key: import('./types').FlagKey | string): boolean {
  return !isOn(key);
}
