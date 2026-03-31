import { bootstrapAuthKitRuntime } from '../src/features/auth-kit/server/bootstrap';

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
