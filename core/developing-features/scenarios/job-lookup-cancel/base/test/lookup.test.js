import test from 'node:test';
import assert from 'node:assert/strict';
import { LookupPanel } from '../src/lookup.js';

test('a completed lookup shows its result and allows a new lookup', () => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  panel.jobCreated(attempt, 'job-1');
  panel.settle(attempt, { kind: 'completed', result: 'eligible' });
  assert.equal(panel.result, 'eligible');
  assert.equal(panel.canSubmit(), true);
});

test('a lookup past its deadline with a job id can be rechecked, not resubmitted', () => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  panel.jobCreated(attempt, 'job-1');
  panel.settle(attempt, { kind: 'deadline' });
  assert.equal(panel.canSubmit(), false);
  assert.equal(panel.canRecheck(), true);
});

test('a result of an older attempt is dropped', () => {
  const panel = new LookupPanel();
  const first = panel.submit();
  panel.reset();
  const second = panel.submit();
  panel.settle(first, { kind: 'completed', result: 'stale' });
  assert.equal(panel.busy, true);
  panel.settle(second, { kind: 'completed', result: 'fresh' });
  assert.equal(panel.result, 'fresh');
});
