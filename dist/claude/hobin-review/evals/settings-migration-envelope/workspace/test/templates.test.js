import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createTemplate, migrateStoredTemplates } from '../src/templates.js';
import { render } from '../src/render.js';
import { parseRows } from '../src/upstream.js';
import { syncTemplates } from '../src/sync.js';

test('render fills placeholders and appends the workspace signature', () => {
  const t = createTemplate({ id: 'welcome', body: 'Hi {name}' });
  assert.equal(render(t, { name: 'Ada' }, { signature: 'Team Example' }), 'Hi Ada\nTeam Example');
});

test('render reuses the placeholder pattern across calls', () => {
  const t = createTemplate({ id: 'a', body: '{x}-{x}' });
  assert.equal(render(t, { x: '1' }), '1-1');
  assert.equal(render(t, { x: '2' }), '2-2');
});

test('parseRows treats an empty catalog body as no rows', () => {
  assert.deepEqual(parseRows({}), []);
});

test('migration brings v1 records to v2', () => {
  const store = createStore([
    { id: 'legacy', version: 1, payload: { body: 'x', footer: 'Reply STOP to opt out' } },
  ]);
  assert.equal(migrateStoredTemplates(store), 1);
  assert.deepEqual(store.get('legacy'), { id: 'legacy', version: 2, payload: { body: 'x' } });
});

test('sync removes templates the catalog no longer lists', async () => {
  const store = createStore([createTemplate({ id: 'old', body: 'x' })]);
  const count = await syncTemplates(store, async () => ({ rows: [{ id: 'new', body: 'y' }] }));
  assert.equal(count, 1);
  assert.equal(store.get('old'), undefined);
});
