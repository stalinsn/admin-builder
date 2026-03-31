/**
 * Utilitário para cache local de traduções
 * Armazena traduções no localStorage com chaves baseadas em hash do conteúdo + idioma
 */

const CACHE_PREFIX = 'translation_';
const CACHE_VERSION = 'v1_'; // Para invalidar cache antigo se necessário

/**
 * Obtém uma tradução do cache local
 */
export function getTranslationCache(text: string, lang: string): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = `${CACHE_PREFIX}${CACHE_VERSION}${lang}_${hashString(text)}`;
    const cached = localStorage.getItem(key);
    
    if (cached) {
      // Valida se o JSON é válido antes de retornar
      JSON.parse(cached);
      return cached;
    }
    
    return null;
  } catch (error) {
    console.warn('Erro ao ler cache de tradução:', error);
    return null;
  }
}

/**
 * Salva uma tradução no cache local
 */
export function setTranslationCache(text: string, lang: string, translation: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Valida se é um JSON válido antes de salvar
    JSON.parse(translation);
    
    const key = `${CACHE_PREFIX}${CACHE_VERSION}${lang}_${hashString(text)}`;
    localStorage.setItem(key, translation);
  } catch (error) {
    console.warn('Erro ao salvar cache de tradução:', error);
  }
}

/**
 * Limpa todo o cache de traduções
 */
export function clearTranslationCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`Cache de traduções limpo: ${keys.length} itens removidos`);
  } catch (error) {
    console.warn('Erro ao limpar cache de tradução:', error);
  }
}

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): { count: number; totalSize: number } {
  if (typeof window === 'undefined') return { count: 0, totalSize: 0 };
  
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    const totalSize = keys.reduce((size, key) => {
      const value = localStorage.getItem(key);
      return size + (value ? value.length : 0);
    }, 0);
    
    return {
      count: keys.length,
      totalSize,
    };
  } catch (error) {
    console.warn('Erro ao calcular estatísticas do cache:', error);
    return { count: 0, totalSize: 0 };
  }
}

/**
 * Gera hash simples para string (djb2 algorithm)
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}
