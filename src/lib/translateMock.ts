import { CvData } from '@/types/cv';
import { TranslationResult } from '@/types/translation';
import { getLanguageConfig, normalizeLangCode } from '@/utils/languageUtils';

/**
 * Simula tradução adicionando prefixo com o nome do idioma
 */
export function translateMock(cvData: CvData, targetLang: string): Promise<TranslationResult> {
  const normalizedLang = normalizeLangCode(targetLang);
  const langConfig = getLanguageConfig(normalizedLang);
  const prefix = `[${langConfig.name}] `;
  
  const fake: CvData = {
    ...cvData,
    name: prefix + cvData.name,
    title: prefix + cvData.title,
    location: prefix + cvData.location,
    contact: {
      phone: cvData.contact.phone,
      email: cvData.contact.email,
      linkedin: cvData.contact.linkedin,
    },
    summary: prefix + cvData.summary,
    coreSkills: cvData.coreSkills.map((s) => prefix + s),
    technicalSkills: Object.fromEntries(
      Object.entries(cvData.technicalSkills).map(([k, v]) => [k, prefix + v])
    ),
    languages: cvData.languages.map((l) => ({
      name: prefix + l.name,
      level: prefix + l.level,
    })),
    experience: cvData.experience.map((exp) => ({
      ...exp,
      company: prefix + exp.company,
      role: prefix + exp.role,
      location: prefix + exp.location,
      period: prefix + exp.period,
      bullets: exp.bullets.map((b) => prefix + b),
    })),
    education: cvData.education.map((ed) => ({
      ...ed,
      institution: prefix + ed.institution,
      degree: prefix + ed.degree,
      period: prefix + ed.period,
      details: ed.details ? prefix + ed.details : undefined,
    })),
    interests: cvData.interests.map((i) => prefix + i),
  };
  
  // Simula delay da rede
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ 
        translated: fake, 
        tokensUsed: 0 
      });
    }, Math.random() * 500 + 200); // 200-700ms
  });
}

/**
 * Simula tradução simples de string
 * @deprecated Esta função não é mais usada, mantida para compatibilidade
 */
export function translateMockString(text: string, targetLang: string): Promise<{ translated: string; tokensUsed: number }> {
  const normalizedLang = normalizeLangCode(targetLang);
  const langConfig = getLanguageConfig(normalizedLang);
  const prefix = `[${langConfig.name}] `;
  
  return Promise.resolve({
    translated: prefix + text,
    tokensUsed: text.length,
  });
}
