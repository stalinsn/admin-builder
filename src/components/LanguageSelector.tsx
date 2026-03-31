"use client";

import React, { useState } from "react";

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
  const [open, setOpen] = useState(false);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const currentLabel =
    languageOptions.find((opt) => opt.code === lang)?.label || lang;

  return (
    <div className="lang-selector">
      <button
        className="btn"
        onClick={() => setOpen((prev) => !prev)}
        title="Selecionar idioma"
      >
        {currentLabel} ▾
      </button>
      {open && (
        <div className="dropdown">
          {languageOptions.map((opt) => (
            <div
              key={opt.code}
              className="dropdown-item"
              onClick={() => handleSelect(opt.code)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
