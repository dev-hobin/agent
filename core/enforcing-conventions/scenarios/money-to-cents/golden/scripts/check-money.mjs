// Fails when src/ does arithmetic on a price that has not gone through toCents().
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRICE_MATH = /\.\w*price\w*\s*[-+*/%]|[-+*/%]\s*[\w.]*\.\w*price\b/i;
const files = readdirSync('src', { recursive: true }).filter((f) => f.endsWith('.js'));
const problems = [];
for (const file of files) {
  readFileSync(join('src', file), 'utf8').split('\n').forEach((line, i) => {
    if (PRICE_MATH.test(line.replace(/toCents\([^)]*\)/g, 'cents'))) {
      problems.push(`src/${file}:${i + 1}: raw arithmetic on a price. Convert it with toCents(price) first and do arithmetic on integer cents (CONVENTIONS.md, Money).`);
    }
  });
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
