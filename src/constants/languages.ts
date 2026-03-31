// Constantes centralizadas para configuração de idiomas
export const SUPPORTED_LANGUAGES = {
  PTBR: 'ptbr',
  EN: 'en', 
  ES: 'es',
  FR: 'fr',
  DE: 'de',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

export const LANGUAGE_CONFIG = {
  [SUPPORTED_LANGUAGES.PTBR]: {
    name: 'Português (Brasil)',
    apiCode: 'pt-br',
    flag: '🇧🇷',
  },
  [SUPPORTED_LANGUAGES.EN]: {
    name: 'English',
    apiCode: 'en-us', 
    flag: '🇺🇸',
  },
  [SUPPORTED_LANGUAGES.ES]: {
    name: 'Español',
    apiCode: 'es-es',
    flag: '🇪🇸',
  },
  [SUPPORTED_LANGUAGES.FR]: {
    name: 'Français',
    apiCode: 'fr-fr',
    flag: '🇫🇷',
  },
  [SUPPORTED_LANGUAGES.DE]: {
    name: 'Deutsch',
    apiCode: 'de-de',
    flag: '🇩🇪',
  },
} as const;

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.PTBR;
