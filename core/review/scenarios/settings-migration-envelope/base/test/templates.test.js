import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createTemplate } from '../src/templates.js';
import { render } from '../src/render.js';
import { parseRows } from '../src/upstream.js';
import { syncTemplates } from '../src/sync.js';

test('render fills placeholders and appends the footer', () => {
  const t = createTemplate({ id: 'welcome', body: 'Hi {name}', footer: 'Reply STOP to opt out' });
  assert.equal(render(t, { name: 'Ada' }), 'Hi Ada\nReply STOP to opt out');
});

test('parseRows rejects a body without the rows envelope', () => {
  assert.throws(() => parseRows({ error: 'maintenance' }));
});

test('sync removes templates the catalog no longer lists', async () => {
  const store = createStore([createTemplate({ id: 'old', body: 'x' })]);
  const count = await syncTemplates(store, async () => ({ rows: [{ id: 'new', body: 'y' }] }));
  assert.equal(count, 1);
  assert.equal(store.get('old'), undefined);
});
