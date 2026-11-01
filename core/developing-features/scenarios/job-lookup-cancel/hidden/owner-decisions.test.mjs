import test from 'node:test';
import assert from 'node:assert/strict';
import { LookupPanel } from '../src/lookup.js';

// The server job keeps running after a cancel, so its outcome is unknown, not failed.
test('a cancelled lookup does not allow a duplicate lookup for the same target', () => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  panel.jobCreated(attempt, 'job-1');
  assert.equal(panel.cancel(), true);
  assert.equal(panel.canSubmit(), false);
  assert.equal(panel.submit(), null);
});

test('a lookup cancelled before its job id is known also blocks a new lookup', () => {
  const panel = new LookupPanel();
  panel.submit();
  panel.cancel();
  assert.equal(panel.canSubmit(), false);
});

test('a late result of a cancelled lookup changes nothing', () => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  panel.jobCreated(attempt, 'job-1');
  panel.cancel();
  panel.settle(attempt, { kind: 'completed', result: 'late' });
  panel.jobCreated(attempt, 'job-2');
  assert.equal(panel.result, null);
  assert.equal(panel.jobId, 'job-1');
});

test('a cancelled recheck leaves the review recheckable', () => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  panel.jobCreated(attempt, 'job-1');
  panel.settle(attempt, { kind: 'deadline' });
  panel.recheck();
  panel.cancel();
  assert.equal(panel.canRecheck(), true);
  assert.equal(panel.canSubmit(), false);
});

test('cancel is not offered when nothing runs', () => {
  const panel = new LookupPanel();
  assert.equal(panel.canCancel(), false);
  assert.equal(panel.cancel(), false);
});
