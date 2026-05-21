const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SEGMENT_DEFINITIONS = [
  {
    id: 'all',
    label: 'All active fans',
    description: 'Every active follower.',
  },
  {
    id: 'paying',
    label: 'Paying fans',
    description: 'Fans with at least one completed purchase.',
  },
  {
    id: 'top_spenders',
    label: 'Top spenders',
    description: 'The highest-spending 20% of paying fans.',
  },
  {
    id: 'recently_active',
    label: 'Recently active',
    description: 'Fans active in the last 14 days.',
  },
  {
    id: 'new_fans',
    label: 'New fans',
    description: 'Fans who joined in the last 7 days.',
  },
  {
    id: 'never_purchased',
    label: 'Never purchased',
    description: 'Fans who have not unlocked or tipped yet.',
  },
  {
    id: 'high_message_activity',
    label: 'High message activity',
    description: 'Fans with 5 or more messages.',
  },
];

const SEGMENT_IDS = new Set(SEGMENT_DEFINITIONS.map(s => s.id));

function normalizeSegmentId(segmentId) {
  const id = String(segmentId || 'all').trim();
  return SEGMENT_IDS.has(id) ? id : 'all';
}

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function daysSince(value, now) {
  const time = toTime(value);
  if (!time) return Infinity;
  return Math.floor((now.getTime() - time) / MS_PER_DAY);
}

function getFanId(row) {
  return row?.fan?.id ?? row?.userId ?? row?.fanId ?? null;
}

function getLastActivity(row) {
  return Math.max(
    toTime(row.lastPurchaseAt),
    toTime(row.lastMessageAt),
    toTime(row.fan?.lastLoginAt),
    toTime(row.joinedAt),
  );
}

function activeRows(fans) {
  return (Array.isArray(fans) ? fans : []).filter(row => row?.status === 'active' && getFanId(row) != null);
}

function selectFanIdsForSegment(fans, segmentId, opts = {}) {
  const id = normalizeSegmentId(segmentId);
  const now = opts.now instanceof Date ? opts.now : new Date(opts.now || Date.now());
  const rows = activeRows(fans);

  let selected;
  if (id === 'paying') {
    selected = rows.filter(row => Number(row.totalSpent || 0) > 0 || Number(row.purchaseCount || 0) > 0);
  } else if (id === 'top_spenders') {
    const paying = rows
      .filter(row => Number(row.totalSpent || 0) > 0)
      .sort((a, b) => Number(b.totalSpent || 0) - Number(a.totalSpent || 0));
    selected = paying.slice(0, Math.max(1, Math.ceil(paying.length * 0.2)));
  } else if (id === 'recently_active') {
    selected = rows.filter(row => {
      const last = getLastActivity(row);
      return last > 0 && daysSince(last, now) <= 14;
    });
  } else if (id === 'new_fans') {
    selected = rows.filter(row => daysSince(row.joinedAt, now) <= 7);
  } else if (id === 'never_purchased') {
    selected = rows.filter(row => Number(row.totalSpent || 0) <= 0 && Number(row.purchaseCount || 0) <= 0);
  } else if (id === 'high_message_activity') {
    selected = rows.filter(row => Number(row.messageCount || 0) >= 5);
  } else {
    selected = rows;
  }

  return selected.map(getFanId);
}

module.exports = {
  SEGMENT_DEFINITIONS,
  normalizeSegmentId,
  selectFanIdsForSegment,
};
