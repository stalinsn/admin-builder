import { useState } from "react";
import { labels } from "../data/labels";
import { cvData } from "../data/cvData";

type Language = "pt" | "en";

export function useTranslation() {
  const [lang, setLang] = useState<Language>("pt");

  const t = labels[lang];

  const handleToggleLanguage = () => {
    setLang((prev) => (prev === "pt" ? "en" : "pt"));
  };

  return {
    lang,
    t,
    cv: cvData,
    setLang,
    toggleLanguage: handleToggleLanguage,
  };
}
