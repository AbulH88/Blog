const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SEGMENT_DEFINITIONS,
  selectFanIdsForSegment,
  normalizeSegmentId,
} = require('../services/audienceSegments');

const now = new Date('2026-05-21T12:00:00Z');

const fans = [
  {
    fan: { id: 1, username: 'big', lastLoginAt: '2026-05-20T12:00:00Z' },
    status: 'active',
    joinedAt: '2026-03-01T00:00:00Z',
    totalSpent: 120,
    purchaseCount: 4,
    messageCount: 9,
    lastPurchaseAt: '2026-05-19T12:00:00Z',
    lastMessageAt: '2026-05-18T12:00:00Z',
  },
  {
    fan: { id: 2, username: 'new' },
    status: 'active',
    joinedAt: '2026-05-18T12:00:00Z',
    totalSpent: 0,
    purchaseCount: 0,
    messageCount: 1,
    lastPurchaseAt: null,
    lastMessageAt: null,
  },
  {
    fan: { id: 3, username: 'quiet' },
    status: 'active',
    joinedAt: '2026-01-01T00:00:00Z',
    totalSpent: 0,
    purchaseCount: 0,
    messageCount: 0,
    lastPurchaseAt: null,
    lastMessageAt: '2026-04-01T12:00:00Z',
  },
  {
    fan: { id: 4, username: 'inactive_whale' },
    status: 'active',
    joinedAt: '2026-01-01T00:00:00Z',
    totalSpent: 80,
    purchaseCount: 1,
    messageCount: 2,
    lastPurchaseAt: '2026-04-01T12:00:00Z',
    lastMessageAt: '2026-04-01T12:00:00Z',
  },
  {
    fan: { id: 5, username: 'cancelled' },
    status: 'cancelled',
    joinedAt: '2026-05-20T12:00:00Z',
    totalSpent: 999,
    purchaseCount: 10,
    messageCount: 20,
    lastPurchaseAt: '2026-05-20T12:00:00Z',
    lastMessageAt: '2026-05-20T12:00:00Z',
  },
];

test('normalizes unknown or empty segment ids to all', () => {
  assert.equal(normalizeSegmentId(''), 'all');
  assert.equal(normalizeSegmentId('not-real'), 'all');
  assert.equal(normalizeSegmentId('paying'), 'paying');
});

test('exposes launch-ready built-in segments', () => {
  assert.deepEqual(
    SEGMENT_DEFINITIONS.map(s => s.id),
    ['all', 'paying', 'top_spenders', 'recently_active', 'new_fans', 'never_purchased', 'high_message_activity'],
  );
});

test('selects active fan ids for each built-in segment', () => {
  assert.deepEqual(selectFanIdsForSegment(fans, 'all', { now }), [1, 2, 3, 4]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'paying', { now }), [1, 4]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'top_spenders', { now }), [1]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'recently_active', { now }), [1, 2]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'new_fans', { now }), [2]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'never_purchased', { now }), [2, 3]);
  assert.deepEqual(selectFanIdsForSegment(fans, 'high_message_activity', { now }), [1]);
});
