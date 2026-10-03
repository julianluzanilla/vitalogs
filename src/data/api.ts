export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Error de red (sin conexión): la petición no llegó al servidor. */
export class NetworkError extends Error {}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json' },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new NetworkError('Sin conexión');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (!res.ok) {
    if (res.status >= 500 || data === null) throw new NetworkError('El servidor no responde');
    throw new ApiError(res.status, (data as { error?: string })?.error || 'Error');
  }
  return data as T;
}
