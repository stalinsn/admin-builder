import React from "react";
import { safeSet } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { Language } from "@/types/cv";
import '@/styles/components/navbar.css';
import '@/styles/components/theme-toggle.css';
import NavbarContainer from "./Navbar/NavbarContainer";
import TranslationModeSelector from "./Navbar/TranslationModeSelector";
import ExportButton from "./Navbar/ExportButton";
import ClearCacheButton from "./Navbar/ClearCacheButton";
import ThemeToggle from "./ThemeToggle";

interface NavbarProps {
  lang: Language;
  onTranslate: (targetLang: Language) => void;
  translationMode: string;
  onChangeTranslationMode: (mode: string) => void;
  labels: {
    theme?: string;
    language?: string;
    mode?: string;
    exportPDF?: string;
    translationModeAI?: string;
    translationModeFree?: string;
    translationModeMock?: string;
    clearCache?: string;
    languageNames?: { [key: string]: string };
  };
  onClearTranslations?: () => void;
  hasCache?: boolean;
  cacheCleared?: boolean;
  githubProjectLink?: React.ReactNode;
}

export default function Navbar({
  lang,
  onTranslate,
  translationMode,
  onChangeTranslationMode,
  labels,
  onClearTranslations,
  hasCache,
  cacheCleared,
  githubProjectLink
}: NavbarProps) {
  const handleLanguageChange = (value: string) => {
  safeSet(STORAGE_KEYS.lastLang, value);
    onTranslate(value as Language);
  };

  const handleClearCache = () => {
    if (onClearTranslations) onClearTranslations();
  };

  return (
    <NavbarContainer githubProjectLink={githubProjectLink}>
      <span className="brand">CV · Stalin Nunes</span>
      <div className="button-group">
        <div className="theme-toggle">
          <span className="theme-label">{labels.theme}</span>
          <ThemeToggle />
        </div>
        <div className="language-selector">
          <label>{labels.language}:</label>
          <select
            className="navbar-select"
            value={lang}
            onChange={e => handleLanguageChange(e.target.value)}
            title="Selecionar idioma"
          >
            <option value="ptbr">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <TranslationModeSelector
          translationMode={translationMode || 'ai'}
          onChangeTranslationMode={onChangeTranslationMode}
          labels={labels}
        />
        <div className="button-actions">
          <ExportButton label={labels.exportPDF || "Exportar PDF"} />
          {hasCache && (
            <ClearCacheButton
              label={labels.clearCache || "Limpar Cache"}
              onClear={handleClearCache}
              disabled={!!cacheCleared}
            />
          )}
        </div>
      </div>
    </NavbarContainer>
  );
}
