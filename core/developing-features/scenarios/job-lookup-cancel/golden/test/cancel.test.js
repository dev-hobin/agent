import test from 'node:test';
import assert from 'node:assert/strict';
import { LookupPanel } from '../src/lookup.js';

const running = (jobId) => {
  const panel = new LookupPanel();
  const attempt = panel.submit();
  if (jobId) panel.jobCreated(attempt, jobId);
  return { panel, attempt };
};

test('S1 cancel is offered only while a lookup or recheck runs', () => {
  const panel = new LookupPanel();
  assert.equal(panel.canCancel(), false);
  assert.equal(panel.cancel(), false);
  panel.submit();
  assert.equal(panel.canCancel(), true);
});

test('S2 a cancelled lookup with a job id becomes a recheckable review', () => {
  const { panel } = running('job-1');
  assert.equal(panel.cancel(), true);
  assert.equal(panel.busy, false);
  assert.equal(panel.canSubmit(), false);
  assert.equal(panel.canRecheck(), true);
});

test('S3 a lookup cancelled before its job id arrived blocks a new lookup until reset', () => {
  const { panel } = running(null);
  panel.cancel();
  assert.equal(panel.canSubmit(), false);
  assert.equal(panel.canRecheck(), false);
  panel.reset();
  assert.equal(panel.canSubmit(), true);
});

test('S4 a result that arrives after its lookup was cancelled is dropped', () => {
  const { panel, attempt } = running('job-1');
  panel.cancel();
  panel.settle(attempt, { kind: 'completed', result: 'late' });
  assert.equal(panel.result, null);
  assert.equal(panel.review, 'withId');
});

test('S5 cancelling a recheck keeps the review recheckable', () => {
  const { panel, attempt } = running('job-1');
  panel.settle(attempt, { kind: 'deadline' });
  const recheck = panel.recheck();
  panel.cancel();
  assert.equal(panel.recovering, false);
  assert.equal(panel.canRecheck(), true);
  panel.settleRecheck(recheck, 'completed');
  assert.equal(panel.review, 'withId');
});
