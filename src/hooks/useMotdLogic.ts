import { useState, useEffect, useCallback } from 'react';
import { 
  VOCABULARIO_MOTIVACIONAL, 
  VOCABULARIO_HUMOR, 
  VOCABULARIO_REFLEXIVO, 
  VOCABULARIO_COMPARTILHADO,
  FRASES_MOTIVACIONAIS,
  FRASES_HUMOR
} from '@/data';

// =====================================================================
// SISTEMA AVANÇADO DE GERAÇÃO DE FRASES MOTIVACIONAIS
// =====================================================================

// Estruturas gramaticais inteligentes
const TEMPLATES = {
  // Template motivacional: crescimento e inspiração
  MOTIVACIONAL: {
    pattern: "{{contexto}} {{acao}} {{foco}}, {{motivacao}}",
    categoria: 'motivacional' as const
  },
  
  // Template reflexivo: momentos contemplativos e profundos
  REFLEXIVO: {
    pattern: "{{contexto}}, {{acao}} {{foco}} {{motivacao}}",
    categoria: 'reflexivo' as const
  },
  
  // Template humor: situações engraçadas e leveza
  HUMOR: {
    pattern: "{{contexto}}, {{acao}} {{foco}} {{motivacao}}",
    categoria: 'humor' as const
  },
  
  // Template condicional (usa vocabulário compartilhado)
  CONDICIONAL: {
    pattern: "{{condicional}}, {{conselho}}, {{resultado}}",
    categoria: 'compartilhado' as const
  }
};

// =====================================================================
// VOCABULÁRIO INTELIGENTE EXPANDIDO
// =====================================================================

const VOCABULARIO = {
  motivacional: VOCABULARIO_MOTIVACIONAL,
  reflexivo: VOCABULARIO_REFLEXIVO,
  humor: VOCABULARIO_HUMOR,
  compartilhado: VOCABULARIO_COMPARTILHADO
};

// Frases prontas com foco na qualidade motivacional e humor inteligente
const FRASES_PRONTAS = [
  ...FRASES_MOTIVACIONAIS,
  ...FRASES_HUMOR
];

// =====================================================================
// LÓGICA DE GERAÇÃO INTELIGENTE
// =====================================================================

class GeradorFrases {
  private usedCombinations: Set<string> = new Set();
  
  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  private generateFromTemplate(templateKey: keyof typeof TEMPLATES): string {
    const template = TEMPLATES[templateKey];
    let frase = template.pattern;
    
    // Seleciona o vocabulário baseado na categoria do template
    const categoria = template.categoria;
    const vocabularioEscolhido = VOCABULARIO[categoria];
    
    // Substitui cada placeholder pelo vocabulário correspondente
    const placeholders = frase.match(/\{\{(\w+)\}\}/g);
    
    if (!placeholders) return frase;
    
    placeholders.forEach(placeholder => {
      const key = placeholder.replace(/[{}]/g, '');
      if (vocabularioEscolhido && key in vocabularioEscolhido) {
        const palavras = vocabularioEscolhido[key as keyof typeof vocabularioEscolhido] as string[];
        const palavra = this.getRandomElement(palavras);
        frase = frase.replace(placeholder, palavra);
      }
    });
    
    return frase;
  }

  private createCombinationId(frase: string): string {
    // Cria um ID baseado nas palavras-chave da frase para evitar repetições similares
    const palavrasChave = frase
      .toLowerCase()
      .replace(/[.,!?]/g, '')
      .split(' ')
      .filter(palavra => palavra.length > 3)
      .slice(0, 3)
      .join('-');
    
    return `GEN-${palavrasChave}`;
  }

  public gerarFrase(): string {
    // Define que tipo de frase será gerada
    const tipoRandom = Math.random();
    let templateEscolhido: keyof typeof TEMPLATES;
    
    // 40% motivacional, 30% reflexivo, 20% humor, 10% condicional
    if (tipoRandom < 0.4) {
      templateEscolhido = 'MOTIVACIONAL';
    } else if (tipoRandom < 0.7) {
      templateEscolhido = 'REFLEXIVO';
    } else if (tipoRandom < 0.9) {
      templateEscolhido = 'HUMOR';
    } else {
      templateEscolhido = 'CONDICIONAL';
    }

    // 70% - Frases geradas por template
    if (Math.random() < 0.7) {
      let tentativas = 0;
      let frase: string;
      let id: string;
      
      do {
        frase = this.generateFromTemplate(templateEscolhido);
        id = this.createCombinationId(frase);
        tentativas++;
      } while (this.usedCombinations.has(id) && tentativas < 10);
      
      if (tentativas < 10) {
        this.usedCombinations.add(id);
        return frase;
      }
    }
    
    // 30% - Frases prontas
    const frasesDisponiveis = FRASES_PRONTAS.filter(frase => 
      !this.usedCombinations.has(`FIXED-${frase.substring(0, 20)}`)
    );
    
    if (frasesDisponiveis.length > 0) {
      const frase = this.getRandomElement(frasesDisponiveis);
      this.usedCombinations.add(`FIXED-${frase.substring(0, 20)}`);
      return frase;
    }
    
    // Se todas as frases foram usadas, reseta o histórico
    this.resetUsedCombinations();
    return this.gerarFrase();
  }
  
  public resetUsedCombinations(): void {
    this.usedCombinations.clear();
  }
  
  public getStats(): { 
    totalCombinations: number; 
    usedCombinations: number; 
    breakdown: {
      frasesPronestas: number;
      templates: {
        motivacional: number;
        reflexivo: number;
        humor: number;
        condicional: number;
        total: number;
      };
      grandTotal: number;
    }
  } {
    // Calcula as combinações reais possíveis
    let totalCombinations = FRASES_PRONTAS.length;
    
    // Calcula combinações por categoria de template
    const motivacional = VOCABULARIO.motivacional;
    const reflexivo = VOCABULARIO.reflexivo;
    const humor = VOCABULARIO.humor;
    const compartilhado = VOCABULARIO.compartilhado;
    
    // Multiplicação das possibilidades por template
    const combinacoesMotivacional = 
      motivacional.contexto.length * 
      motivacional.acao.length * 
      motivacional.foco.length * 
      motivacional.motivacao.length;
      
    const combinacoesReflexivo = 
      reflexivo.contexto.length * 
      reflexivo.acao.length * 
      reflexivo.foco.length * 
      reflexivo.motivacao.length;
      
    const combinacoesHumor = 
      humor.contexto.length * 
      humor.acao.length * 
      humor.foco.length * 
      humor.motivacao.length;
      
    const combinacoesCondicional = 
      compartilhado.condicional.length * 
      compartilhado.conselho.length * 
      compartilhado.resultado.length;
    
    const totalTemplates = combinacoesMotivacional + combinacoesReflexivo + combinacoesHumor + combinacoesCondicional;
    totalCombinations += totalTemplates;
    
    const breakdown = {
      frasesPronestas: FRASES_PRONTAS.length,
      templates: {
        motivacional: combinacoesMotivacional,
        reflexivo: combinacoesReflexivo,
        humor: combinacoesHumor, 
        condicional: combinacoesCondicional,
        total: totalTemplates
      },
      grandTotal: totalCombinations
    };
    
    return {
      totalCombinations,
      usedCombinations: this.usedCombinations.size,
      breakdown
    };
  }
}

// =====================================================================
// HOOK PRINCIPAL (mantém a interface existente)
// =====================================================================

const gerador = new GeradorFrases();

// Resto do código do hook mantido igual...
const KEY = 'frasesMotivacionaisExibidasV4'; // Versão atualizada
const FAVORITES_KEY = 'frasesMotivacionaisFavoritas';
const STATS_KEY = 'frasesMotivacionaisStats';

function getExibidas(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function setExibidas(arr: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(arr));
}

function getFavoritas(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

function setFavoritasStorage(arr: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
}

function getStats(): { total: number; hoje: number; streak: number; lastDate: string } {
  if (typeof window === 'undefined') return { total: 0, hoje: 0, streak: 0, lastDate: '' };
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{"total":0,"hoje":0,"streak":0,"lastDate":""}');
  } catch {
    return { total: 0, hoje: 0, streak: 0, lastDate: '' };
  }
}

function updateStats(): { total: number; hoje: number; streak: number } {
  if (typeof window === 'undefined') return { total: 0, hoje: 0, streak: 0 };
  
  const today = new Date().toDateString();
  const currentStats = getStats();
  
  const newStats = {
    total: currentStats.total + 1,
    hoje: currentStats.lastDate === today ? currentStats.hoje + 1 : 1,
    streak: currentStats.lastDate === today ? currentStats.streak : currentStats.streak + 1,
    lastDate: today
  };
  
  localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
  return newStats;
}

export function useMotdLogic() {
  const [frase, setFrase] = useState('');
  const [exibidas, setExibidasState] = useState<string[]>([]);
  const [favoritas, setFavoritas] = useState<string[]>([]);
  const [aviso, setAviso] = useState('');
  const [fadeClass, setFadeClass] = useState('fade-in');
  const [stats, setStats] = useState({ total: 0, hoje: 0, streak: 0 });

  const gerarNovaFrase = useCallback(() => {
    setFadeClass('fade-out');
    
    setTimeout(() => {
      const novaFrase = gerador.gerarFrase();
      const exibidasAtual = getExibidas();
      
      exibidasAtual.push(novaFrase);
      setExibidas(exibidasAtual);
      setExibidasState([...exibidasAtual]);
      setFrase(novaFrase);
      setAviso('');
      setFadeClass('fade-in');
      
      // Atualiza estatísticas
      const novasStats = updateStats();
      setStats(novasStats);
    }, 300);
  }, []);

  useEffect(() => {
    const frasesExibidas = getExibidas();
    const frasesGostei = getFavoritas();
    const estatisticas = getStats();
    
    setExibidasState(frasesExibidas);
    setFavoritas(frasesGostei);
    setStats(estatisticas);
  }, []);

  const toggleFavorita = useCallback((fraseTarget: string) => {
    const isCurrentlyFavorited = favoritas.includes(fraseTarget);
    const novasFavoritas = isCurrentlyFavorited 
      ? favoritas.filter(frase => frase !== fraseTarget)
      : [...favoritas, fraseTarget];
    
    // Se estamos removendo dos favoritos, garantimos que a frase volte para o histórico
    if (isCurrentlyFavorited) {
      const exibidasAtual = getExibidas();
      if (!exibidasAtual.includes(fraseTarget)) {
        exibidasAtual.push(fraseTarget);
        setExibidas(exibidasAtual);
        setExibidasState([...exibidasAtual]);
      }
    }
    
    setFavoritas(novasFavoritas);
    setFavoritasStorage(novasFavoritas);
    
    const acao = isCurrentlyFavorited ? 'removida das' : 'adicionada às';
    const emoji = isCurrentlyFavorited ? '💔' : '❤️';
    const mensagemExtra = isCurrentlyFavorited ? ' (mantida no histórico)' : '';
    setAviso(`Frase ${acao} favoritas${mensagemExtra}! ${emoji}`);
    setTimeout(() => setAviso(''), 2500);
  }, [favoritas]);

  const copiarFrase = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(frase);
      setAviso('Frase copiada! 📋');
      setTimeout(() => setAviso(''), 2000);
    } catch {
      setAviso('Erro ao copiar 😅');
      setTimeout(() => setAviso(''), 2000);
    }
  }, [frase]);

  const compartilharFrase = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Frase Motivacional do Dia',
          text: frase,
          url: window.location.href
        });
      } catch {
        copiarFrase();
      }
    } else {
      copiarFrase();
    }
  }, [frase, copiarFrase]);

  const limparHistorico = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Preserva as frases favoritas no histórico
      const frasesPreservadas = getFavoritas();
      
      if (frasesPreservadas.length > 0) {
        setExibidas(frasesPreservadas);
        setExibidasState([...frasesPreservadas]);
        setAviso(`Histórico limpo! ${frasesPreservadas.length} favoritas preservadas 🗑️❤️`);
      } else {
        localStorage.removeItem(KEY);
        setExibidasState([]);
        setAviso('Histórico limpo! 🗑️');
      }
      
      gerador.resetUsedCombinations();
      setTimeout(() => setAviso(''), 3500);
    }
  }, []);

  const limparTudo = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEY);
      localStorage.removeItem(FAVORITES_KEY);
      localStorage.removeItem(STATS_KEY);
      setExibidasState([]);
      setFavoritas([]);
      setStats({ total: 0, hoje: 0, streak: 0 });
      gerador.resetUsedCombinations();
      setAviso('Tudo limpo! Histórico, favoritas e estatísticas removidos 🗑️💥');
      setTimeout(() => setAviso(''), 4000);
    }
  }, []);

  return {
    frase,
    setFrase,
    exibidas,
    favoritas,
    aviso,
    fadeClass,
    setFadeClass,
    stats,
    gerarNovaFrase,
    toggleFavorita,
    copiarFrase,
    compartilharFrase,
    limparHistorico,
    limparTudo
  };
}
