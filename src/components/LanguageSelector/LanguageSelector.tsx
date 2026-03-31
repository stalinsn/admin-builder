"use client";

import React from "react";

interface LanguageSelectorProps {
  lang: string;
  onChange: (newLang: string) => void;
}

const languageOptions = [
  { code: "ptbr", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

export default function LanguageSelector({
  lang,
  onChange,
}: LanguageSelectorProps) {
  return (
    <select
      className="navbar-select"
      value={lang}
      onChange={(e) => onChange(e.target.value)}
      title="Selecionar idioma"
    >
      {languageOptions.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
