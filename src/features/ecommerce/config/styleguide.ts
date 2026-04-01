export const ECOM_THEMES = ['default', 'light', 'classic', 'fresh'] as const;
export const ECOM_CAMPAIGNS = ['none', 'mothers-day', 'easter', 'black-friday'] as const;

export type EcomThemeId = (typeof ECOM_THEMES)[number];
export type EcomCampaignId = (typeof ECOM_CAMPAIGNS)[number];

export const DEFAULT_ECOM_THEME: EcomThemeId = 'default';
export const DEFAULT_ECOM_CAMPAIGN: EcomCampaignId = 'none';
