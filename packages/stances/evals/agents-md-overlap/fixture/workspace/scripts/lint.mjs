// Minimal lint: no console.log in src/.
import { readdirSync, readFileSync } from 'node:fs';
const bad = readdirSync('src').filter((f) => readFileSync(`src/${f}`, 'utf8').includes('console.log'));
if (bad.length) {
  console.error(`console.log found in: ${bad.join(', ')}. Use the logger in src/log.js.`);
  process.exit(1);
}
