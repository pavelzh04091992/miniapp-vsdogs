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
}

export async function resolveAppAccess(options: ResolveAccessOptions = {}): Promise<AppAccessResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const sessionResponse = await fetchImpl('/api/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (sessionResponse.ok) {
      const user = await readAuthenticatedUser(sessionResponse);
      return user ? { status: 'authenticated', user } : { status: 'error' };
    }

    if (sessionResponse.status !== 401) {
      return { status: 'error' };
    }

    if (options.initData) {
      const response = await fetchImpl('/api/auth/telegram', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: options.initData }),
      });

      if (response.ok) {
        const user = await readAuthenticatedUser(response);
        return user ? { status: 'authenticated', user } : { status: 'error' };
      }

      if (response.status === 403) {
        return { status: 'denied', botUrl: await loadBotUrl(fetchImpl) };
      }

      return { status: 'error' };
    }

    const botUrl = await loadBotUrl(fetchImpl);
    return options.authSignal === 'invalid-link'
      ? { status: 'invalid-link', botUrl }
      : { status: 'unauthenticated', botUrl };
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
    !['admin', 'user'].includes(user.role) ||
    user.status !== 'active'
  ) {
    return null;
  }

  return user as AuthenticatedUser;
}

async function loadBotUrl(fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchImpl('/api/auth/config', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

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
