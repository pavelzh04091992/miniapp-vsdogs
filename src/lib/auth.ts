export interface AuthenticatedUser {
  telegramId: string;
  role: 'admin' | 'user';
  status: 'active';
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export type AppAccessResult =
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'denied'; botUrl: string | null }
  | { status: 'unauthenticated'; botUrl: string | null }
  | { status: 'invalid-link'; botUrl: string | null }
  | { status: 'error' };

interface ResolveAccessOptions {
  initData?: string;
  authSignal?: string | null;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export async function resolveAppAccess(options: ResolveAccessOptions = {}): Promise<AppAccessResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;

  try {
    // An invalid magic-link redirect must stay visible even if this browser
    // already has a valid session from an earlier login. Otherwise a rejected
    // link appears to work because the session check immediately opens the app.
    if (options.authSignal === 'invalid-link') {
      return {
        status: 'invalid-link',
        botUrl: await loadBotUrl(fetchImpl, requestTimeoutMs),
      };
    }

    const sessionResponse = await fetchWithTimeout(fetchImpl, '/api/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }, requestTimeoutMs);

    if (sessionResponse.ok) {
      const user = await readAuthenticatedUser(sessionResponse);
      return user ? { status: 'authenticated', user } : { status: 'error' };
    }

    if (sessionResponse.status !== 401) {
      return { status: 'error' };
    }

    if (options.initData) {
      const response = await fetchWithTimeout(fetchImpl, '/api/auth/telegram', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData: options.initData }),
      }, requestTimeoutMs);

      if (response.ok) {
        const user = await readAuthenticatedUser(response);
        return user ? { status: 'authenticated', user } : { status: 'error' };
      }

      if (response.status === 403) {
        return {
          status: 'denied',
          botUrl: await loadBotUrl(fetchImpl, requestTimeoutMs),
        };
      }

      return { status: 'error' };
    }

    const botUrl = await loadBotUrl(fetchImpl, requestTimeoutMs);
    return { status: 'unauthenticated', botUrl };
  } catch {
    return { status: 'error' };
  }
}

async function readAuthenticatedUser(response: Response): Promise<AuthenticatedUser | null> {
  const body = await response.json().catch(() => null);
  const user = body?.user;

  if (
    !body?.ok ||
    !user ||
    typeof user.telegramId !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(user.telegramId) ||
    !['admin', 'user'].includes(user.role) ||
    user.status !== 'active' ||
    !isNullableString(user.username) ||
    !isNullableString(user.firstName) ||
    !isNullableString(user.lastName)
  ) {
    return null;
  }

  return user as AuthenticatedUser;
}

async function loadBotUrl(fetchImpl: typeof fetch, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(fetchImpl, '/api/auth/config', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }, timeoutMs);

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    return typeof body.botUrl === 'string' && /^https:\/\/t\.me\/[A-Za-z\d_]{5,32}$/.test(body.botUrl)
      ? body.botUrl
      : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
