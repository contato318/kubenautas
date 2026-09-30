import { useCallback, useEffect, useRef, useState } from 'react';
import type { Certificate, CertificateResponse } from '@jack-academy/contracts';
import { ApiError, request } from '../lib/api';

interface State {
  accountId?: string;
  certificate: Certificate | null;
  loaded: boolean;
  loading: boolean;
  issuing: boolean;
  error: string | null;
}
const empty = (): State => ({ certificate: null, loaded: false, loading: false, issuing: false, error: null });

export function useCertificate(accountId?: string) {
  const [state, setState] = useState<State>(empty);
  const version = useRef(0);
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;

  const reload = useCallback(async () => {
    const revision = ++version.current;
    if (!accountId) { setState(empty()); return; }
    setState({ ...empty(), accountId, loading: true });
    try {
      const result = await request<CertificateResponse>('certificate', { accountId });
      if (revision !== version.current || currentAccount.current !== accountId) return;
      setState({ ...empty(), accountId, loaded: true, certificate: result.certificate });
    } catch {
      if (revision !== version.current || currentAccount.current !== accountId) return;
      setState({ ...empty(), accountId, error: 'Não foi possível carregar seu certificado. Tente novamente.' });
    }
  }, [accountId]);

  useEffect(() => { void reload(); return () => { version.current++; }; }, [reload]);

  const issue = async (fullName: string): Promise<Certificate | null> => {
    if (!accountId) return null;
    const revision = ++version.current;
    setState((value) => ({ ...value, issuing: true, error: null }));
    try {
      const certificate = await request<Certificate>('certificate', { method: 'POST', accountId, body: { fullName } });
      if (revision !== version.current || currentAccount.current !== accountId) return null;
      setState({ ...empty(), accountId, loaded: true, certificate });
      return certificate;
    } catch (cause) {
      if (revision !== version.current || currentAccount.current !== accountId) return null;
      const error = cause instanceof ApiError && cause.status === 403
        ? 'Sua aprovação ainda não está registrada. Aguarde o salvamento da prova e tente novamente.'
        : cause instanceof ApiError && cause.status === 400
          ? 'Confira seu nome completo. Use de 3 a 120 caracteres, sem números ou símbolos especiais.'
          : 'Não foi possível emitir o certificado. Confira sua conexão e tente novamente.';
      setState((value) => ({ ...value, issuing: false, error }));
      return null;
    }
  };

  const own = state.accountId === accountId;
  return { ...(own ? state : { ...empty(), loading: !!accountId }), reload, issue };
}
