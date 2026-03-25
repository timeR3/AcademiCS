export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!API_BASE_URL) {
    return path;
  }
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let parsed: ApiResponse<T> | null = null;

  try {
    parsed = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1)) as ApiResponse<T>;
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed) {
    throw new ApiError('La API devolvió una respuesta inválida.', response.status);
  }

  if (!response.ok) {
    throw new ApiError(parsed.error || 'Error de API.', response.status);
  }

  if (typeof parsed.data === 'undefined') {
    throw new ApiError('La API no devolvió datos.', response.status);
  }

  return parsed.data;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    method: 'GET',
  });

  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    method: 'DELETE',
  });

  return parseResponse<T>(response);
}
