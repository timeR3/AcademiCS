export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const technicalErrorByFriendlyMessage = new Map<string, string>();
const TECHNICAL_ERROR_REGISTRY_LIMIT = 80;

function normalizeMessage(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function isTechnicalMessage(message: string): boolean {
  const technicalMarkers = [
    '<!doctype',
    '<html',
    'stack',
    'syntaxerror',
    'unexpected token',
    'cannot ',
    'failed to fetch',
    'networkerror',
    'econn',
    'sql',
  ];
  const lower = message.toLowerCase();
  return technicalMarkers.some((marker) => lower.includes(marker));
}

function statusFallback(status: number, fallback: string): string {
  if (status === 400) return 'No pudimos procesar tu solicitud. Revisa los datos e inténtalo nuevamente.';
  if (status === 401) return 'No pudimos iniciar sesión. Verifica tu correo y contraseña.';
  if (status === 403) return 'No tienes permisos para realizar esta acción.';
  if (status === 404) return 'No encontramos la información solicitada. Inténtalo de nuevo en unos minutos.';
  if (status === 409) return 'Ya existe un registro con esos datos. Revisa la información e inténtalo nuevamente.';
  if (status === 422) return 'Hay campos por corregir antes de continuar.';
  if (status === 429) return 'Hay muchas solicitudes en este momento. Espera un momento e inténtalo de nuevo.';
  if (status >= 500) return 'Tuvimos un problema interno. Ya estamos trabajando en ello; inténtalo nuevamente en unos minutos.';
  return fallback;
}

function compactTechnicalDetails(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 1400) return normalized;
  return `${normalized.slice(0, 1400)}...`;
}

function registerTechnicalErrorDetails(friendlyMessage: string, technicalDetails: string | null): void {
  if (!technicalDetails) return;
  const friendly = normalizeMessage(friendlyMessage);
  if (!friendly) return;
  const details = compactTechnicalDetails(technicalDetails);
  if (!details || details === friendly) return;
  technicalErrorByFriendlyMessage.set(friendly, details);
  if (technicalErrorByFriendlyMessage.size > TECHNICAL_ERROR_REGISTRY_LIMIT) {
    const oldestKey = technicalErrorByFriendlyMessage.keys().next().value as string | undefined;
    if (oldestKey) {
      technicalErrorByFriendlyMessage.delete(oldestKey);
    }
  }
}

function buildTechnicalErrorDetails(error: unknown): string | null {
  if (error instanceof ApiError) {
    const apiMessage = normalizeMessage(error.message);
    return apiMessage ? `HTTP ${error.status}: ${apiMessage}` : `HTTP ${error.status}`;
  }
  if (error instanceof Error) {
    const normalized = normalizeMessage(error.message);
    return normalized || null;
  }
  return null;
}

export function getTechnicalDetailsForFriendlyMessage(message: string): string | undefined {
  return technicalErrorByFriendlyMessage.get(normalizeMessage(message));
}

export function getFriendlyErrorMessage(error: unknown, fallback = 'No pudimos completar la acción. Inténtalo nuevamente.'): string {
  const technicalDetails = buildTechnicalErrorDetails(error);
  if (error instanceof ApiError) {
    const apiMessage = normalizeMessage(error.message);
    if (apiMessage && !isTechnicalMessage(apiMessage)) {
      registerTechnicalErrorDetails(apiMessage, technicalDetails);
      return apiMessage;
    }
    const friendly = statusFallback(error.status, fallback);
    registerTechnicalErrorDetails(friendly, technicalDetails);
    return friendly;
  }
  if (error instanceof Error) {
    const normalized = normalizeMessage(error.message);
    if (!normalized) {
      registerTechnicalErrorDetails(fallback, technicalDetails);
      return fallback;
    }
    if (isTechnicalMessage(normalized)) {
      const friendly = 'No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.';
      registerTechnicalErrorDetails(friendly, technicalDetails);
      return friendly;
    }
    registerTechnicalErrorDetails(normalized, technicalDetails);
    return normalized;
  }
  registerTechnicalErrorDetails(fallback, technicalDetails);
  return fallback;
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
    const compactRaw = raw.replace(/\s+/g, ' ').trim();
    const preview = compactRaw.length > 220 ? `${compactRaw.slice(0, 220)}...` : compactRaw;
    const detail = preview ? ` Respuesta recibida: ${preview}` : '';
    throw new ApiError(`La API devolvió una respuesta inválida.${detail}`, response.status);
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
