// Not named *.test.mjs so that an agent-defined `node --test` inside
// `npm run check` does not pick this file up and recurse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';

// A nested `node --test` inherits NODE_TEST_CONTEXT from this runner and then
// reports to it instead of exiting normally, so drop it for the child.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;

const runCheck = () => {
  const r = spawnSync('npm', ['run', 'check'], { encoding: 'utf8', env });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
};

test('npm run check passes on the fixed code', () => {
  const { status, output } = runCheck();
  assert.equal(status, 0, output);
});

test('a new raw float price calculation fails npm run check with a toCents hint', () => {
  const target = 'src/tax.js';
  copyFileSync('hidden/new-violation.txt', target);
  try {
    const { status, output } = runCheck();
    assert.notEqual(status, 0, 'check should fail on the new violation');
    assert.match(output, /toCents/);
  } finally {
    rmSync(target, { force: true });
  }
});
