import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, checkIn, supportTopic, loadState, dayKey, SELF } from '../public/community-demo/state.js';

test('daily check-in is idempotent and permits the following day', () => {
  const first = checkIn(initialState(), '2026-09-21').state;
  assert.equal(first.balance, 2);
  const duplicate = checkIn(first, '2026-09-21').state;
  assert.equal(duplicate.balance, 2);
  assert.equal(duplicate.ledger.length, 1);
  assert.equal(checkIn(duplicate, '2026-09-22').state.balance, 4);
});
test('support debits once without allowing own posts or overdrafts', () => {
  const topic = { id: 't1', author: '作者', title: '测试主题' };
  assert.equal(supportTopic(initialState(), topic).state.balance, 0);
  const start = checkIn(initialState()).state;
  assert.equal(supportTopic(start, { ...topic, author: SELF }).state, start);
  const first = supportTopic(start, topic).state;
  assert.equal(first.balance, 1);
  assert.equal(first.ledger[0].amount, -1);
  assert.equal(supportTopic(first, topic).state, first);
  const last = supportTopic(first, { ...topic, id: 't2' }).state;
  assert.equal(last.balance, 0);
  assert.equal(supportTopic(last, { ...topic, id: 't3' }).state, last);
  assert.equal(last.ledger.reduce((sum, entry) => sum + entry.amount, 0), last.balance);
});
test('check-in uses the Beijing date across a UTC day boundary', () => {
  assert.equal(dayKey(new Date('2026-09-21T15:59:59Z')), '2026-09-21');
  assert.equal(dayKey(new Date('2026-09-21T16:00:00Z')), '2026-09-22');
});
test('saved state survives reload and malformed storage recovers', () => {
  const state = supportTopic(checkIn(initialState()).state, { id: 't1', author: '作者', title: '测试主题' }).state;
  assert.deepEqual(loadState({ getItem: () => JSON.stringify(state) }), state);
  for (const input of ['broken', 'null', '{}', '{"balance":-1}', JSON.stringify({...state, posts:[{}]})]) {
    assert.deepEqual(loadState({ getItem: () => input }), initialState());
  }
  assert.deepEqual(loadState({ getItem: () => { throw new Error('storage unavailable'); } }), initialState());
});
