export interface Contact {
  phone: string;
  email: string;
  linkedin: string;
}

export type Language = 'pt-br' | 'en-us' | 'es-es' | 'fr-fr' | 'de-de';

export interface Experience {
  company: string;
  role: string;
  period: string;
  location: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  period: string;
  details?: string;
}

export interface CvData {
  name: string;
  title: string;
  location: string;
  contact: Contact;
  summary: string;
  coreSkills: string[];
  technicalSkills: Record<string, string>;
  languages: { name: string; level: string }[];
  experience: Experience[];
  education: Education[];
  interests: string[];
  summaryTitle?: string;
  coreSkillsTitle?: string;
  technicalSkillsTitle?: string;
  experienceTitle?: string;
  educationTitle?: string;
  languagesTitle?: string;
  interestsTitle?: string;
  githubProject?: {
    url: string;
    label: string;
  };
}