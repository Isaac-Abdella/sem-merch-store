// Creates server/.env and client/.env from the examples (if they don't exist yet)
// and fills in a random JWT secret. Safe to run more than once.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');

function copyEnv(dir, transform = (s) => s) {
  const example = path.join(root, dir, '.env.example');
  const target = path.join(root, dir, '.env');
  if (fs.existsSync(target)) {
    console.log(`✓ ${dir}/.env already exists — left unchanged`);
    return;
  }
  fs.writeFileSync(target, transform(fs.readFileSync(example, 'utf8')));
  console.log(`✓ created ${dir}/.env`);
}

copyEnv('server', (s) =>
  s.replace('JWT_SECRET=change-me-to-a-long-random-string', `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
);
copyEnv('client');
