const USER_ID_KEY = 'artlens_userId';
const USER_CONTEXT_KEY = 'artlens_userContext';
const LANGUAGE_KEY = 'artlens_language';

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

// Re-register the user from saved localStorage context when the session is stale
async function reRegisterUser(): Promise<string | null> {
  const ctx = localStorage.getItem(USER_CONTEXT_KEY);
  const lang = localStorage.getItem(LANGUAGE_KEY);
  if (!ctx) return null;

  try {
    const parsed = JSON.parse(ctx);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: parsed.name || 'Guest',
        email: parsed.email || 'guest@artlens.ai',
        persona: parsed.persona || 'guide',
        language: lang || 'en',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.userId) {
      setUserId(data.userId);
      return data.userId;
    }
  } catch {
    // silent failure
  }
  return null;
}

async function requestWithRetry(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const makeHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {};
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const userId = getUserId();
    if (userId) h['X-User-Id'] = userId;
    return h;
  };

  const opts: RequestInit = { method, headers: makeHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(path, opts);

  // On 401, try to re-register and retry once
  if (res.status === 401) {
    const newId = await reRegisterUser();
    if (newId) {
      const retryHeaders = makeHeaders();
      const retryOpts: RequestInit = { method, headers: retryHeaders };
      if (body !== undefined) retryOpts.body = JSON.stringify(body);
      res = await fetch(path, retryOpts);
    }
  }

  return res;
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await requestWithRetry('POST', path, body);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await requestWithRetry('GET', path);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function apiPatch<T = any>(path: string, body: unknown): Promise<T> {
  const res = await requestWithRetry('PATCH', path, body);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}
