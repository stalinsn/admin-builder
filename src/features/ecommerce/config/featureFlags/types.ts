export type FlagKey = keyof typeof import('./defaults').BASE_ECOMMERCE_FEATURE_FLAGS;
export type FeatureFlags = Record<FlagKey, boolean>;

export type FeatureFlagGroup = {
  id: string;
  label: string;
  description: string;
  keys: FlagKey[];
};
