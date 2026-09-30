import { useLocation } from 'react-router-dom';

export function useLoginPath() {
  const { pathname, search, hash } = useLocation();
  return `/entrar?returnTo=${encodeURIComponent(pathname + search + hash)}`;
}
