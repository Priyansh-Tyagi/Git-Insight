// Run with: npm run setup
// Creates .env from .env.example if it doesn't exist yet, then auto-fills
// JWT_SECRET and TOKEN_ENCRYPTION_KEY with properly generated 64-char hex
// values directly — no manual copy-paste step, so no risk of a dropped
// character or stray whitespace breaking them.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example');
}

let content = fs.readFileSync(envPath, 'utf8');

function ensureSecret(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(regex);
  const current = match ? match[1].trim() : '';

  if (current.length === 64 && /^[0-9a-f]+$/i.test(current)) {
    console.log(`${key} already set correctly (64 hex chars) — leaving as-is`);
    return content;
  }

  const fresh = crypto.randomBytes(32).toString('hex');
  if (match) {
    content = content.replace(regex, `${key}=${fresh}`);
  } else {
    content += `\n${key}=${fresh}\n`;
  }
  console.log(`${key} generated fresh (was ${current.length === 0 ? 'empty' : 'invalid'})`);
  return content;
}

content = ensureSecret(content, 'JWT_SECRET');
content = ensureSecret(content, 'TOKEN_ENCRYPTION_KEY');

fs.writeFileSync(envPath, content);

console.log('\nDone. Remaining manual steps in .env:');
console.log('  - DATABASE_URL (your real local Postgres connection string)');
console.log('  - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (from a registered GitHub OAuth App)');
