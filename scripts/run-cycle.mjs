import { execSync } from 'node:child_process';

const LOCAL_URL = process.env.LOCAL_URL || 'http://127.0.0.1:5175';
const OFFICIAL_URL = process.env.OFFICIAL_URL || 'https://music.youtube.com';

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, LOCAL_URL, OFFICIAL_URL } });
}

console.log('=== Ciclo de fidelidade: reference → implement → screenshot → diff ===');
console.log(`Oficial: ${OFFICIAL_URL}\nLocal:   ${LOCAL_URL}\nViewport: 1920x1080\n`);

run('node scripts/capture-reference.mjs');
run('node scripts/compare.mjs');

console.log('\nRegistre o diff no CHECKLIST.md — se passou, avançar; se não, corrigir e repetir.');
