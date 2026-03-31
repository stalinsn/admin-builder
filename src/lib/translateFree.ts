
export async function translateWithFreeAPI(text: string, targetLang: string) {
  try {
    const res = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'pt',
        target: targetLang,
        format: 'text',
      }),
    });

    const json = await res.json();

    if (json.error) {
      throw new Error(json.error);
    }

    return json.translatedText;
  } catch (error) {
    console.error('Erro na tradução gratuita:', error);
    return text; // fallback se der erro
  }
}
