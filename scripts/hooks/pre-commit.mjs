// Pre-commit guard for a public repo: blocks env files and scans staged files for secrets.
import { execFileSync, spawnSync } from 'node:child_process';

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

const envFiles = staged.filter((f) => /(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example'));
if (envFiles.length > 0) {
  console.error(`Refusing to commit env files: ${envFiles.join(', ')}`);
  console.error('Secrets belong in .env (gitignored) or in Netlify environment variables.');
  process.exit(1);
}

const privateFiles = staged.filter((f) => f.startsWith('private/'));
if (privateFiles.length > 0) {
  console.error(`Refusing to commit private notes: ${privateFiles.join(', ')}`);
  process.exit(1);
}

const binary = /\.(png|jpe?g|webp|gif|ico|mp4|mov|mp3|wav|woff2?|ttf|otf|pdf)$/i;
const toScan = staged.filter((f) => !binary.test(f) && f !== 'package-lock.json');
if (toScan.length === 0) process.exit(0);

const result = spawnSync('npx', ['--no-install', 'secretlint', '--maskSecrets', ...toScan], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
