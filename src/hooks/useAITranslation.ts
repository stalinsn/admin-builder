'use client';

import { useState } from 'react';

export function useAITranslation() {
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [payloadSize, setPayloadSize] = useState<number | null>(null);
  const [charCount, setCharCount] = useState<number | null>(null);

  const translateAllCV = async (
    cvData: Record<string, unknown>,
    targetLang: string
  ): Promise<unknown | null> => {
    if (!targetLang) return null;

    const jsonPayload = JSON.stringify(cvData);
    const payloadSizeValue = (jsonPayload.length * 2) / 1024;
    const charCountValue = jsonPayload.length;

    setElapsedTime(null);
    setPayloadSize(payloadSizeValue);
    setCharCount(charCountValue);

    const startTime = performance.now();

    setLoading(true);
    setStatusMessage('🔄 Traduzindo com IA...');
    setTokensUsed(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',       
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvData, targetLang }),
      });

      const json = await res.json();

      if (res.ok) {
        setTokensUsed(json.tokensUsed);
        const endTime = performance.now();
        setElapsedTime((endTime - startTime) / 1000);
        setStatusMessage(`✅ Tradução concluída! Tokens usados: ${json.tokensUsed}`);

        return json.translated;
      } else {
        console.warn(`[Translation Error] ${json.error}`);
        setStatusMessage('❌ Erro durante tradução');
        return null;
      }
    } catch (error) {
      console.error('Translation error:', error);
      setStatusMessage('❌ Erro durante tradução');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    statusMessage,
    tokensUsed,
    elapsedTime,
    payloadSize,
    charCount,
    translateAllCV,
  };
}
