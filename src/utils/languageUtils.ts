import { SUPPORTED_LANGUAGES, LANGUAGE_CONFIG, SupportedLanguage, DEFAULT_LANGUAGE } from '@/constants/languages';

/**
 * Normaliza códigos de idioma para o formato interno
 */
export function normalizeLangCode(code: string): SupportedLanguage {
  const normalized = code.toLowerCase().replace('-', '');
  
  switch (normalized) {
    case 'ptbr':
    case 'pt':
    case 'ptbr':
      return SUPPORTED_LANGUAGES.PTBR;
    case 'en':
    case 'enus':
      return SUPPORTED_LANGUAGES.EN;
    case 'es':
    case 'eses':
      return SUPPORTED_LANGUAGES.ES;
    case 'fr':
    case 'frfr':
      return SUPPORTED_LANGUAGES.FR;
    case 'de':
    case 'dede':
      return SUPPORTED_LANGUAGES.DE;
    default:
      return DEFAULT_LANGUAGE;
  }
}

/**
 * Converte código interno para código da API
 */
export function toApiLangCode(lang: SupportedLanguage): string {
  return LANGUAGE_CONFIG[lang].apiCode;
}

/**
 * Valida se o idioma é suportado
 */
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return Object.values(SUPPORTED_LANGUAGES).includes(lang as SupportedLanguage);
}

/**
 * Obtém configuração completa do idioma
 */
export function getLanguageConfig(lang: SupportedLanguage) {
  return LANGUAGE_CONFIG[lang];
}
