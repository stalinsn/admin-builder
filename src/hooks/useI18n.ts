'use client';

import { useState, useEffect, useCallback } from 'react';
import { cvData } from '@/data';
import { cvDataEn } from '@/data/cv-en';
import { cvDataEs } from '@/data/cv-es';
import { cvDataFr } from '@/data/cv-fr';
import { cvDataDe } from '@/data/cv-de';
import { translateWithAI } from '@/lib/translateService';
import { CvData } from '@/types/cv';
import { TranslationStatus, TranslationMode, TranslationCache } from '@/types/translation';
import { getTranslationCache, setTranslationCache } from '@/utils/translationCache';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { 
  SUPPORTED_LANGUAGES, 
  SupportedLanguage, 
  DEFAULT_LANGUAGE 
} from '@/constants/languages';
import { 
  normalizeLangCode, 
  toApiLangCode, 
  isValidLanguage 
} from '@/utils/languageUtils';

// Dados mockados por idioma
const MOCK_DATA: Record<SupportedLanguage, CvData> = {
  [SUPPORTED_LANGUAGES.PTBR]: cvData,
  [SUPPORTED_LANGUAGES.EN]: cvDataEn,
  [SUPPORTED_LANGUAGES.ES]: cvDataEs,
  [SUPPORTED_LANGUAGES.FR]: cvDataFr,
  [SUPPORTED_LANGUAGES.DE]: cvDataDe,
};

const INITIAL_STATUS: TranslationStatus = {
  tokensUsed: null,
  elapsedTime: null,
  payloadSize: null,
  charCount: null,
  model: '',
};

export function useI18n() {
  // Estados principais
  const [lang, setLang] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [data, setData] = useState<CvData>(cvData);
  const [translations, setTranslations] = useState<TranslationCache>({
    [DEFAULT_LANGUAGE]: cvData,
  });
  
  // Estados da tradução
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translationMode, setTranslationMode] = useState<TranslationMode>('ai');
  const [userAcceptedFallback, setUserAcceptedFallback] = useState(false);
  const [status, setStatus] = useState<TranslationStatus>(INITIAL_STATUS);
  
  // LocalStorage com SSR
  const [lastLang, setLastLang] = useLocalStorage<SupportedLanguage>('lastLang', DEFAULT_LANGUAGE);
  
  // Inicializa idioma do localStorage
  useEffect(() => {
    if (isValidLanguage(lastLang) && lastLang !== lang) {
      setLang(lastLang);
      if (translations[lastLang]) {
        setData(translations[lastLang]);
      }
    }
  }, [lastLang, lang, translations]);

  // Função para trocar idioma (com cache)
  const switchLang = useCallback((targetLang: string) => {
    const normalizedLang = normalizeLangCode(targetLang);
    if (lang === normalizedLang) return;

    if (translations[normalizedLang]) {
      setLang(normalizedLang);
      setData(translations[normalizedLang]);
      setLastLang(normalizedLang);
      setError(null);
    }
  }, [lang, translations, setLastLang]);

  // Função para salvar tradução
  const saveTranslation = useCallback((targetLang: SupportedLanguage, translatedData: CvData) => {
    setTranslations(prev => ({
      ...prev,
      [targetLang]: translatedData,
    }));
    setLang(targetLang);
    setData(translatedData);
    setLastLang(targetLang);
    setError(null);
  }, [setLastLang]);

  // Função principal de tradução
  const handleTranslate = useCallback(async (
    targetLang: string, 
    token?: string, 
    origem?: string
  ) => {
    setError(null);
    const normalizedLang = normalizeLangCode(targetLang);
    
    if (lang === normalizedLang) return;

    // 1. Verifica cache local
    const cached = getTranslationCache(JSON.stringify(data), normalizedLang);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CvData;
        saveTranslation(normalizedLang, parsed);
        return;
      } catch (error) {
        console.warn('Erro ao parsear cache:', error);
      }
    }

    // 2. Verifica cache em memória
    if (translations[normalizedLang]) {
      switchLang(normalizedLang);
      return;
    }

    // 3. Tradução por IA
    if (translationMode === 'ai') {
      setLoading(true);
      const start = Date.now();
      
      try {
        const apiLang = toApiLangCode(normalizedLang);
        const result = await translateWithAI(data, apiLang, token, origem);
        const elapsed = Date.now() - start;
        
        if (!result?.translated) {
          throw new Error('Tradução IA não retornou resultado válido.');
        }
        
        // Salva nos caches
        saveTranslation(normalizedLang, result.translated);
        setTranslationCache(
          JSON.stringify(data), 
          normalizedLang, 
          JSON.stringify(result.translated)
        );
        
        // Atualiza estatísticas
        setStatus({
          tokensUsed: result.tokensUsed || null,
          elapsedTime: elapsed,
          payloadSize: JSON.stringify(data).length,
          charCount: JSON.stringify(result.translated).length,
          model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo',
        });
        
      } catch (error) {
        console.error('Erro na tradução IA:', error);
        setError('A tradução com IA está indisponível no momento. Gostaria de usar a tradução padrão?');
        setStatus(INITIAL_STATUS);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 4. Fallback para mock
    if (translationMode === 'mock' || (error && userAcceptedFallback)) {
      const mockData = MOCK_DATA[normalizedLang];
      if (mockData) {
        saveTranslation(normalizedLang, mockData);
      } else {
        setError('Tradução padrão não disponível para este idioma.');
      }
      return;
    }
  }, [
    lang, 
    data, 
    translations, 
    translationMode, 
    error, 
    userAcceptedFallback,
    saveTranslation,
    switchLang
  ]);

  // Função para limpar traduções
  const clearTranslations = useCallback(() => {
    setTranslations({ [DEFAULT_LANGUAGE]: cvData });
    setLang(DEFAULT_LANGUAGE);
    setData(cvData);
    setLastLang(DEFAULT_LANGUAGE);
    setError(null);
    setStatus(INITIAL_STATUS);
  }, [setLastLang]);

  // Função wrapper para mudança de modo de tradução
  const changeTranslationMode = useCallback((mode: string) => {
    setTranslationMode(mode as TranslationMode);
  }, []);

  return {
    // Estados principais
    lang,
    data,
    translations,
    
    // Estados da tradução
    loading,
    error,
    translationMode,
    userAcceptedFallback,
    status,
    
    // Funções
    handleTranslate,
    switchLang,
    saveTranslation,
    clearTranslations,
    setTranslationMode: changeTranslationMode,
    setUserAcceptedFallback,
  };
}
