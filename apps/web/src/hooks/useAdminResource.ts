import { useEffect, useReducer, useState } from 'react';
import { useAccount } from '../auth/AccountProvider';
import { ApiError, request } from '../lib/api';

export function useAdminResource<T>(path: string | null) {
  const { user } = useAccount();
  const [attempt, reload] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string | null; code?: number }>({ key: '', data: null, loading: true, error: null });
  const accountId = user?.isAdmin ? user.id : undefined;
  const key = accountId && path ? `${accountId}:${path}` : '';
  useEffect(() => {
    let canceled = false;
    setState({ key, data: null, loading: !!key, error: null });
    if (!accountId || !path) return;
    void request<T>(path, { accountId }).then(data => {
      if (!canceled) setState({ key, data, loading: false, error: null });
    }).catch(cause => {
      if (canceled) return;
      const code = cause instanceof ApiError ? cause.status : undefined;
      const error = code === 403 ? 'Seu acesso administrativo não está autorizado.' : code === 404 ? 'Usuário não encontrado.' : code === 401 || code === 409 ? 'Sua sessão mudou. Atualize a página e entre novamente.' : 'Não foi possível carregar os dados. Tente novamente.';
      setState({ key, data: null, loading: false, error, code });
    });
    return () => { canceled = true; };
  }, [key, accountId, path, attempt]);
  return { ...(state.key === key ? state : { data: null, loading: !!key, error: null }), reload };
}
