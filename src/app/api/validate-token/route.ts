import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ESe5JpZFiZTRVDAPZ3uxLAXBek3KoNE3NXDuLqXS6bk';
const SHEET_NAME = 'TokensIA';

type GoogleServiceCredentials = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
};

function normalizePrivateKey(privateKey?: string) {
  return String(privateKey || '').replace(/\\n/g, '\n');
}

function getGoogleCredentialsFromEnv(): GoogleServiceCredentials {
  const clientEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || '');

  return {
    type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE || 'service_account',
    project_id: String(process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID || ''),
    private_key_id: String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID || ''),
    private_key: normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    client_email: clientEmail,
    client_id: String(process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || ''),
    auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
    universe_domain: 'googleapis.com',
  };
}

function hasRequiredCredentials(credentials: GoogleServiceCredentials) {
  return Boolean(
    credentials.project_id &&
    credentials.private_key_id &&
    credentials.private_key &&
    credentials.client_email &&
    credentials.client_id
  );
}

function getGoogleCredentials(): GoogleServiceCredentials {
  const envCredentials = getGoogleCredentialsFromEnv();
  if (hasRequiredCredentials(envCredentials)) {
    return envCredentials;
  }

  const serviceAccountPath = path.join(process.cwd(), 'google-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('Credenciais Google ausentes: defina GOOGLE_SERVICE_ACCOUNT_* ou google-service-account.json');
  }

  const fileCredentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as Record<string, string>;
  const fileClientEmail = String(fileCredentials.client_email || '');

  const merged: GoogleServiceCredentials = {
    type: String(fileCredentials.type || 'service_account'),
    project_id: String(fileCredentials.project_id || ''),
    private_key_id: String(fileCredentials.private_key_id || ''),
    private_key: normalizePrivateKey(fileCredentials.private_key),
    client_email: fileClientEmail,
    client_id: String(fileCredentials.client_id || ''),
    auth_uri: String(fileCredentials.auth_uri || 'https://accounts.google.com/o/oauth2/auth'),
    token_uri: String(fileCredentials.token_uri || 'https://oauth2.googleapis.com/token'),
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(fileClientEmail)}`,
    universe_domain: 'googleapis.com',
  };

  if (!hasRequiredCredentials(merged)) {
    throw new Error('Credenciais Google incompletas no arquivo google-service-account.json');
  }

  return merged;
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const ATTEMPT_LIMIT = 5;
const BLOCK_TIME_MINUTES = 10;
const ipAttempts: Record<string, { count: number; last: number; blockedUntil?: number }> = {};

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();

  if (ipAttempts[ip]?.blockedUntil && now < ipAttempts[ip].blockedUntil) {
    return NextResponse.json({ error: 'Muitas tentativas inválidas. Tente novamente em alguns minutos.' }, { status: 429 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Token não informado.' }, { status: 400 });
  }

  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:C`,
    });

    const rows = data.values || [];
    for (let i = 0; i < rows.length; i += 1) {
      const [sheetToken, usos, ativo] = rows[i];
      if (sheetToken === token && ativo === 'TRUE' && Number(usos) > 0) {
        ipAttempts[ip] = { count: 0, last: now };
        return NextResponse.json({ success: true, usos_restantes: Number(usos) });
      }
    }
  } catch (error) {
    console.error('Erro interno em /api/validate-token:', error);
    return NextResponse.json({ error: 'Falha interna ao validar token.' }, { status: 500 });
  }

  if (!ipAttempts[ip]) ipAttempts[ip] = { count: 0, last: now };
  ipAttempts[ip].count += 1;
  ipAttempts[ip].last = now;

  if (ipAttempts[ip].count >= ATTEMPT_LIMIT) {
    ipAttempts[ip].blockedUntil = now + BLOCK_TIME_MINUTES * 60 * 1000;
  }

  return NextResponse.json({ error: 'Token inválido, inativo ou esgotado.' }, { status: 403 });
}
