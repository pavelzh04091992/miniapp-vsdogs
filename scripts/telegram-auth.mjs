import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TELEGRAM_ID_PATTERN = /^[1-9]\d{0,19}$/;

export class TelegramAuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TelegramAuthError';
    this.code = code;
  }
}

export function validateTelegramInitData(initData, botToken, options = {}) {
  if (typeof initData !== 'string' || !initData || initData.length > 16_384) {
    throw new TelegramAuthError('invalid_init_data');
  }

  if (typeof botToken !== 'string' || !botToken) {
    throw new TelegramAuthError('auth_not_configured');
  }

  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const names = new Set();

  for (const [name] of entries) {
    if (names.has(name)) {
      throw new TelegramAuthError('duplicate_init_data_field');
    }

    names.add(name);
  }

  const providedHash = params.get('hash');

  if (!providedHash || !/^[a-f\d]{64}$/i.test(providedHash)) {
    throw new TelegramAuthError('invalid_init_data_hash');
  }

  const dataCheckString = entries
    .filter(([name]) => name !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const providedHashBuffer = Buffer.from(providedHash, 'hex');

  if (
    expectedHash.length !== providedHashBuffer.length ||
    !timingSafeEqual(expectedHash, providedHashBuffer)
  ) {
    throw new TelegramAuthError('invalid_init_data_signature');
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 900;
  const futureSkewSeconds = options.futureSkewSeconds ?? 60;
  const authDate = Number(params.get('auth_date'));

  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new TelegramAuthError('invalid_auth_date');
  }

  if (authDate > nowSeconds + futureSkewSeconds) {
    throw new TelegramAuthError('future_auth_date');
  }

  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError('expired_init_data');
  }

  let user;

  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    throw new TelegramAuthError('invalid_telegram_user');
  }

  const normalizedUser = normalizeTelegramUser(user);

  if (!normalizedUser) {
    throw new TelegramAuthError('invalid_telegram_user');
  }

  return {
    authDate,
    queryId: params.get('query_id') || null,
    user: normalizedUser,
  };
}

export function normalizeTelegramId(value) {
  const normalized = String(value ?? '').trim();
  return TELEGRAM_ID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeTelegramUser(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const id = normalizeTelegramId(value.id);

  if (!id || typeof value.first_name !== 'string' || !value.first_name.trim()) {
    return null;
  }

  return {
    id,
    firstName: value.first_name.trim().slice(0, 128),
    lastName: cleanOptionalString(value.last_name, 128),
    username: cleanOptionalString(value.username, 64),
    languageCode: cleanOptionalString(value.language_code, 35),
  };
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cleanOptionalString(value, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
