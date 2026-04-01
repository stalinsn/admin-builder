import fs from 'node:fs';
import path from 'node:path';

import { bootstrapAuthKitRuntime } from '../src/features/auth-kit/server/bootstrap';

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (const entry of argv) {
    if (!entry.startsWith('--')) continue;
    if (entry.includes('=')) {
      const [key, value] = entry.slice(2).split('=');
      args.set(key, value);
    } else {
      args.set(entry.slice(2), true);
    }
  }
  return args;
}

async function main() {
  loadDotEnvFile();
  const args = parseArgs(process.argv.slice(2));

  const adminEmail = String(args.get('admin-email') || process.env.AUTH_KIT_ADMIN_EMAIL || '').trim();
  const adminName = String(args.get('admin-name') || process.env.AUTH_KIT_ADMIN_NAME || '').trim();
  const adminPassword = String(args.get('admin-password') || process.env.AUTH_KIT_ADMIN_PASSWORD || '').trim();
  const seedDefaultPanelUsers = Boolean(args.get('seed-default-panel-users'));

  if (!adminEmail || !adminName || !adminPassword) {
    console.error('Use: npm run auth-kit:bootstrap -- --admin-email=... --admin-name=... --admin-password=... [--seed-default-panel-users]');
    process.exit(1);
  }

  const result = await bootstrapAuthKitRuntime({
    adminEmail,
    adminName,
    adminPassword,
    seedDefaultPanelUsers,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
