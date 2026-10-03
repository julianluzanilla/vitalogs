// Crea (o reemplaza la contraseña de) un administrador en D1.
// Uso: node scripts/create-admin.mjs <usuario> [--local]
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ITERATIONS = 100_000; // igual que functions/lib/crypto.ts
const args = process.argv.slice(2);
const local = args.includes('--local');
const username = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('Uso: node scripts/create-admin.mjs <usuario> [--local]');
  process.exit(1);
}

function ask(question) {
  // Lee la contraseña sin mostrarla en pantalla.
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const password = await ask('Contraseña del administrador (mín. 10 caracteres): ');
if (password.length < 10) { console.error('La contraseña es muy corta.'); process.exit(1); }
const again = await ask('Repite la contraseña: ');
if (again !== password) { console.error('Las contraseñas no coinciden.'); process.exit(1); }

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const pwHash = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
const sql = `INSERT INTO admins (id, username, pw_hash, created_at) VALUES ('${randomUUID()}', '${username}', '${pwHash}', ${Date.now()})
ON CONFLICT(username) DO UPDATE SET pw_hash = excluded.pw_hash;`;

const file = join(tmpdir(), `vitalogs-admin-${Date.now()}.sql`);
writeFileSync(file, sql);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'vitalogs', local ? '--local' : '--remote', `--file=${file}`], { stdio: 'inherit', shell: true });
  console.log(`\nAdministrador "${username}" listo. Entra en /admin.`);
} finally {
  unlinkSync(file);
}
