import React from "react";

interface TranslationModeSelectorProps {
  translationMode: string;
  onChangeTranslationMode: (mode: string) => void;
  labels: {
    mode?: string;
    translationModeAI?: string;
    translationModeMock?: string;
  };
}

export default function TranslationModeSelector({
  translationMode,
  onChangeTranslationMode,
  labels,
}: TranslationModeSelectorProps) {
  return (
    <div className="translation-mode">
      <label>{labels.mode}:</label>
      <select
        className="navbar-select"
        value={translationMode || "ai"}
        onChange={(e) => onChangeTranslationMode(e.target.value)}
      >
        <option value="ai">{labels.translationModeAI || "IA"}</option>
        <option value="mock">{labels.translationModeMock || "Mock"}</option>
      </select>
    </div>
  );
}
