export function createRateLimiter(options = {}) {
  const limit = parsePositiveInteger(options.limit, 20, 'limit');
  const windowMs = parsePositiveInteger(options.windowMs, 60_000, 'windowMs');
  const maxKeys = parsePositiveInteger(options.maxKeys, 10_000, 'maxKeys');
  const now = options.now ?? Date.now;
  const entries = new Map();

  return {
    consume(rawKey) {
      const timestamp = now();
      const key = normalizeKey(rawKey);
      let entry = entries.get(key);

      if (!entry || timestamp >= entry.resetAt) {
        entry = { count: 0, resetAt: timestamp + windowMs };
      }

      entry.count += 1;
      entries.delete(key);
      entries.set(key, entry);

      if (entries.size > maxKeys) {
        pruneEntries(entries, timestamp, maxKeys);
      }

      return {
        allowed: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000)),
      };
    },

    clear(rawKey) {
      entries.delete(normalizeKey(rawKey));
    },
  };
}

function pruneEntries(entries, timestamp, maxKeys) {
  for (const [key, entry] of entries) {
    if (timestamp >= entry.resetAt) {
      entries.delete(key);
    }
  }

  while (entries.size > maxKeys) {
    entries.delete(entries.keys().next().value);
  }
}

function normalizeKey(value) {
  const key = String(value || 'anonymous').trim();
  return key.slice(0, 256) || 'anonymous';
}

function parsePositiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
