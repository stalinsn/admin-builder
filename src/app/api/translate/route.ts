import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { updateTokenRow } from '@/lib/updateTokenRow';
import crypto from 'crypto';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({ apiKey });
}

const languageNames: Record<string, string> = {
  ptbr: 'Português (Brasil)',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
};

export async function POST(req: NextRequest) {
  let openai: OpenAI;

  try {
    openai = getOpenAIClient();
  } catch {
    return NextResponse.json(
      { error: 'Serviço de tradução indisponível no momento.' },
      { status: 503 },
    );
  }

  const { cvData, targetLang, token, password, origem } = await req.json();

  if (password) {
    const correctPassword = process.env.AI_TRANSLATE_PASSWORD;
    if (!correctPassword || password !== correctPassword) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }
  } else if (!token) {
    return NextResponse.json({ error: 'Token de autorização ou senha obrigatório.' }, { status: 401 });
  }

  if (!password && token) {
    const validateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/validate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const validateJson = await validateRes.json().catch(() => ({}));

    if (!validateRes.ok) {
      if (validateRes.status === 403) {
        return NextResponse.json({ error: 'Token inválido ou esgotado.' }, { status: 401 });
      }

      if (validateRes.status === 429) {
        return NextResponse.json({ error: validateJson.error || 'Muitas tentativas inválidas.' }, { status: 429 });
      }

      return NextResponse.json({ error: 'Falha interna ao validar token.' }, { status: 500 });
    }

    if (!validateJson.success) {
      return NextResponse.json({ error: 'Token inválido ou esgotado.' }, { status: 401 });
    }

    const usosRestantes = typeof validateJson.usos_restantes === 'number' ? validateJson.usos_restantes : 0;
    if (usosRestantes > 0) {
      await updateTokenRow({ token, update: { usos_restantes: usosRestantes - 1 } });
    }
  }

  const langName = languageNames[targetLang] || targetLang;

  const prompt = `Traduza este currículo para ${langName} e retorne **apenas** o JSON.
Preserve a estrutura do objeto, apenas traduza os textos.

IMPORTANTE: Adicione os seguintes campos ao JSON traduzido, com os títulos das seções principais traduzidos:
- summaryTitle
- coreSkillsTitle
- technicalSkillsTitle
- experienceTitle
- educationTitle
- languagesTitle

Exemplo:
{
  ...
  "summaryTitle": "Professional Summary",
  "coreSkillsTitle": "Core Skills",
  ...
}

Currículo:
${JSON.stringify(cvData, null, 2)}`;

  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
  });

  const elapsed = (Date.now() - start) / 1000;
  const result = completion.choices[0].message?.content?.trim();
  const tokensUsed = completion.usage?.total_tokens || 0;
  const modelo = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-3.5-turbo';
  const userAgent = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for') || '';
  const texto_hash = crypto.createHash('sha256').update(JSON.stringify(cvData)).digest('hex');
  let status = 'sucesso';

  try {
    const json = JSON.parse(result || '{}');

    await updateTokenRow({
      token,
      update: {
        ultimo_uso: new Date().toISOString(),
        ip,
        idioma: targetLang,
        tokens: tokensUsed.toString(),
        tempo: elapsed.toFixed(2),
        modelo,
        user_agent: userAgent,
        texto_hash,
        status,
        origem: origem || '',
      },
    });

    return NextResponse.json({
      translated: json,
      tokensUsed,
    });
  } catch (error) {
    status = 'erro';

    await updateTokenRow({
      token,
      update: {
        ultimo_uso: new Date().toISOString(),
        ip,
        idioma: targetLang,
        tokens: tokensUsed.toString(),
        tempo: elapsed.toFixed(2),
        modelo,
        user_agent: userAgent,
        texto_hash,
        status,
        origem: origem || '',
      },
    });

    console.error('Erro ao parsear a resposta da IA:', error);
    return NextResponse.json({ error: 'Falha ao converter a resposta em JSON' }, { status: 500 });
  }
}
