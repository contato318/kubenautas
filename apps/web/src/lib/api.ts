const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export function apiUrl(path: string) { return `${base}/${path.replace(/^\//, '')}`; }
export async function request<T>(path: string, options: { method?: string; body?: unknown; accountId?: string } = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: options.method ?? 'GET', credentials: 'include', cache: 'no-store',
    headers: {
      ...(options.method ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' } : {}),
      ...(options.accountId ? { 'X-Account-Id': options.accountId } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ApiError(response.status, response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : response.status === 409 ? 'A conta mudou em outra aba. Atualize a página.' : 'Não foi possível acessar sua conta. Tente novamente.');
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
