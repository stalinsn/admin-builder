import type { CvData } from '@/types/cv';
import type { TranslationResult } from '@/types/translation';

/**
 * Traduz dados do CV usando IA via API
 * @param cvData - Dados do CV para traduzir
 * @param targetLang - Idioma de destino (formato API: pt-br, en-us, etc.)
 * @param token - Token de autorização (opcional)
 * @param origem - Origem da requisição para analytics (opcional)
 * @returns Resultado da tradução com dados traduzidos e tokens usados
 */
export async function translateWithAI(
  cvData: CvData, 
  targetLang: string, 
  token?: string, 
  origem?: string
): Promise<TranslationResult> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    body: JSON.stringify({ cvData, targetLang, token, origem }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  
  if (!json.translated) {
    throw new Error('Resposta da API não contém dados traduzidos');
  }

  return {
    translated: json.translated,
    tokensUsed: json.tokensUsed || 0,
  };
}
