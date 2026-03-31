/**
 * Utilitário de sanitização de HTML para prevenir XSS
 * 
 * Usa DOMPurify para remover código malicioso de strings HTML
 * antes de renderizá-las com dangerouslySetInnerHTML.
 * 
 * Compatível com SSR (Server-Side Rendering) do Next.js.
 * No servidor, retorna o HTML como está (os dados devem vir de fonte confiável).
 * No cliente, sanitiza usando DOMPurify.
 * 
 * @example
 * import { sanitizeHtml } from '@/utils/sanitize';
 * 
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }} />
 */

/**
 * Configuração padrão - Tags permitidas
 */
const DEFAULT_ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'u', 's', 'strike',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'a', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const DEFAULT_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'id', 'title',
];

// Cache do DOMPurify para evitar imports múltiplos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DOMPurifyInstance: any = null;

function basicServerSanitizeHtml(dirty: string): string {
  return dirty
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript:|vbscript:|data:).*?\2/gi, '')
    .replace(/\s(href|src)\s*=\s*(javascript:|vbscript:|data:)[^\s>]+/gi, '');
}

/**
 * Carrega DOMPurify dinamicamente (apenas no cliente)
 */
async function getDOMPurify() {
  if (typeof window === 'undefined') {
    return null; // SSR - não temos DOM
  }
  if (!DOMPurifyInstance) {
    const purifyModule = await import('dompurify');
    DOMPurifyInstance = purifyModule.default || purifyModule;
  }
  return DOMPurifyInstance;
}

/**
 * Sanitiza HTML para prevenir ataques XSS
 * 
 * NOTA: Esta função é síncrona. No servidor (SSR), retorna o HTML original.
 * Para dados de fontes externas/não confiáveis, use sanitizeHtmlAsync.
 * 
 * Os dados do CV vêm de arquivos locais controlados, então são seguros no SSR.
 * 
 * @param dirty - String HTML potencialmente perigosa
 * @param allowedTags - Tags HTML permitidas (opcional)
 * @param allowedAttr - Atributos permitidos (opcional)
 * @returns String HTML sanitizada, segura para renderização
 */
export function sanitizeHtml(
  dirty: string | undefined | null,
  allowedTags: string[] = DEFAULT_ALLOWED_TAGS,
  allowedAttr: string[] = DEFAULT_ALLOWED_ATTR
): string {
  if (!dirty) return '';
  
  // No servidor, retorna como está (dados do CV são de fonte confiável)
  if (typeof window === 'undefined') {
    return basicServerSanitizeHtml(dirty);
  }
  
  // No cliente, usa DOMPurify se já carregado
  if (DOMPurifyInstance) {
    const clean = DOMPurifyInstance.sanitize(dirty, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttr,
    });
    return typeof clean === 'string' ? clean : '';
  }
  
  // Fallback: carrega DOMPurify e retorna HTML original por enquanto
  // O componente será re-renderizado após hidratação
  getDOMPurify().catch(() => {});
  return dirty;
}

/**
 * Sanitiza HTML de forma assíncrona (garante que DOMPurify está carregado)
 * Use esta função para dados de fontes externas/não confiáveis
 */
export async function sanitizeHtmlAsync(
  dirty: string | undefined | null,
  allowedTags: string[] = DEFAULT_ALLOWED_TAGS,
  allowedAttr: string[] = DEFAULT_ALLOWED_ATTR
): Promise<string> {
  if (!dirty) return '';
  
  const purify = await getDOMPurify();
  if (!purify) {
    return basicServerSanitizeHtml(dirty);
  }
  
  const clean = purify.sanitize(dirty, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttr,
  });
  return typeof clean === 'string' ? clean : '';
}

/**
 * Sanitiza HTML permitindo apenas formatação inline básica
 * (sem divs, parágrafos, ou estrutura de bloco)
 */
export function sanitizeInlineHtml(dirty: string | undefined | null): string {
  return sanitizeHtml(
    dirty,
    ['b', 'i', 'em', 'strong', 'u', 's', 'a', 'span', 'br'],
    ['href', 'target', 'rel', 'class']
  );
}

/**
 * Remove TODO HTML, retornando apenas texto puro
 */
export function stripHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';
  return dirty.replace(/<[^>]*>/g, '');
}

export default sanitizeHtml;
