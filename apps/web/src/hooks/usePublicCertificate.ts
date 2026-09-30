import { useEffect, useReducer, useState } from 'react';
import type { Certificate } from '@jack-academy/contracts';
import { ApiError, request } from '../lib/api';

type Verification = { status: 'loading' | 'not-found' | 'error'; certificate: null } | { status: 'valid'; certificate: Certificate };
const loading: Verification = { status: 'loading', certificate: null };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function usePublicCertificate(id?: string) {
  const [attempt, reload] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useState<{ id?: string; result: Verification }>({ result: loading });

  useEffect(() => {
    let canceled = false;
    if (!id || !uuid.test(id)) {
      setState({ id, result: { status: 'not-found', certificate: null } });
      return;
    }
    setState({ id, result: loading });
    void request<Certificate>(`certificates/${encodeURIComponent(id)}`).then((certificate) => {
      if (!canceled) setState({ id, result: { status: 'valid', certificate } });
    }).catch((error) => {
      if (!canceled) setState({ id, result: { status: error instanceof ApiError && [400, 404].includes(error.status) ? 'not-found' : 'error', certificate: null } });
    });
    return () => { canceled = true; };
  }, [id, attempt]);

  return { ...(state.id === id ? state.result : loading), reload };
}
