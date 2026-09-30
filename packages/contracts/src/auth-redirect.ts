/** A route relative to the application, including its query and fragment. */
export function safeReturnPath(candidate: unknown): string {
  const fallback = '/trilha';
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  try {
    const origin = 'https://jack-academy.invalid';
    const target = new URL(candidate, origin);
    const decodedPath = decodeURIComponent(target.pathname);
    if (target.origin !== origin || decodedPath.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decodedPath) || /^\/entrar(?:\/|$)/i.test(new URL(decodedPath, origin).pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
