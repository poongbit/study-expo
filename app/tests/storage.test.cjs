require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAttempt } = require('../src/basics/straightLine.ts');
const store = require('../src/basics/attemptStore.web.ts');
const data = new Map();
let failWrites = false;
global.localStorage = {
  get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => { if (failWrites) throw new Error('quota exceeded'); data.set(key,value); },
};
const attempt = previous => createAttempt([{strokeId:'s1',inputType:'STYLUS',startedAt:100,points:[{x:0.15,y:0.5,t:0},{x:0.85,y:0.5,t:100}]}], previous);
test('persist, reload, retry idempotently and preserve history on storage failure', async () => {
  const first = attempt(null);
  await store.saveAttempt(first);
  await store.saveAttempt(first);
  assert.equal(data.size, 1);
  // Re-import the adapter, as after reloading the app.
  delete require.cache[require.resolve('../src/basics/attemptStore.web.ts')];
  const reloaded = require('../src/basics/attemptStore.web.ts');
  assert.deepEqual((await reloaded.loadAttempts()).attempts, [first]);
  const second = attempt(first);
  failWrites = true;
  await assert.rejects(() => reloaded.saveAttempt(second));
  assert.deepEqual((await reloaded.loadAttempts()).attempts, [first]);
  failWrites = false;
  await reloaded.saveAttempt(second);
  const history = (await reloaded.loadAttempts()).attempts;
  assert.equal(history.length, 2);
  assert.equal(history[1].previousAttemptId, first.attemptId);
  data.set('chibicoach:straight-line-v1:corrupt', 'not json');
  const partial = await reloaded.loadAttempts();
  assert.equal(partial.unreadable, 1);
  assert.equal(partial.attempts.length, 2);
  assert.equal(data.get('chibicoach:straight-line-v1:corrupt'), 'not json');
});
