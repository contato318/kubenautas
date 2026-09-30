import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Progress, SessionResponse, User } from '@jack-academy/contracts';
import { ApiError, request } from '../lib/api';
import { eventId } from '../lib/eventId';

const empty = (): Progress => ({ quizzes: {}, completed: {}, cases: {} });
type Status = 'loading' | 'ready' | 'error';
type Save = { path: string; method: string; body?: unknown; accountId: string };
interface Account {
  user: User | null;
  providers: SessionResponse['providers'];
  status: Status;
  progress: Progress;
  saving: boolean;
  accountDeleted: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (accountId: string) => Promise<boolean>;
  completeWelcome: () => Promise<boolean>;
  retrySave: () => Promise<void>;
  recordQuiz: (key: string, score: number) => Promise<boolean>;
  recordExam: (score: number) => Promise<boolean>;
  recordCase: (slug: string, correct: boolean) => Promise<boolean>;
  reset: () => Promise<boolean>;
}
const Context = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [providers, setProviders] = useState<SessionResponse['providers']>({ google: false, github: false });
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState<Progress>(empty);
  const [saving, setSaving] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  const loadVersion = useRef(0);
  const mutationVersion = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const failed = useRef<Save[]>([]);
  const channel = useRef<BroadcastChannel | null>(null);
  const deletingAccount = useRef<string | null>(null);

  const changeUser = useCallback((next: User | null) => {
    if (next) setAccountDeleted(false);
    if (userRef.current?.id !== next?.id) {
      mutationVersion.current++;
      failed.current = [];
      setProgress(empty());
      setError(null);
    }
    userRef.current = next;
    setUser(next);
  }, []);

  const refresh = useCallback(async () => {
    if (deletingAccount.current) return;
    const version = ++loadVersion.current;
    setStatus('loading');
    try {
      const session = await request<SessionResponse>('auth/me');
      if (version !== loadVersion.current) return;
      setProviders(session.providers);
      const changed = userRef.current?.id !== session.user?.id;
      changeUser(session.user);
      const revision = mutationVersion.current;
      const saved = session.user ? await request<Progress>('progress', { accountId: session.user.id }) : empty();
      if (version !== loadVersion.current) return;
      if (revision === mutationVersion.current) setProgress(saved);
      setStatus('ready');
      if (!failed.current.length) setError(null);
      if (changed) channel.current?.postMessage({ userId: session.user?.id ?? null });
    } catch (cause) {
      if (version !== loadVersion.current) return;
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 409)) changeUser(null);
      setStatus('error');
      setError('Não foi possível carregar sua conta. Seu progresso ainda não está disponível.');
    }
  }, [changeUser]);

  useEffect(() => {
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('jack-academy:account');
      channel.current.onmessage = (event: MessageEvent<{ userId: string | null; welcomeCompleted?: boolean }>) => {
        if (event.data.userId !== (userRef.current?.id ?? null)) { changeUser(null); void refresh(); }
        else if (event.data.welcomeCompleted && !userRef.current?.welcomeCompleted) void refresh();
      };
    }
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { loadVersion.current++; window.removeEventListener('focus', onFocus); channel.current?.close(); channel.current = null; };
  }, [changeUser, refresh]);

  const save = useCallback((operation: Save): Promise<boolean> => {
    mutationVersion.current++;
    const task = queue.current.then(async () => {
      if (userRef.current?.id !== operation.accountId || deletingAccount.current === operation.accountId) return false;
      // Keep failed attempts in order, especially the first answer to a case.
      if (failed.current.length && !failed.current.includes(operation) && operation.method !== 'DELETE') {
        failed.current.push(operation);
        return false;
      }
      setSaving(true);
      try {
        const next = await request<Progress>(operation.path, operation);
        if (userRef.current?.id !== operation.accountId) return false;
        mutationVersion.current++;
        setProgress(next);
        failed.current = operation.method === 'DELETE' ? [] : failed.current.filter((item) => item !== operation);
        if (!failed.current.length) setError(null);
        return true;
      } catch (cause) {
        if (userRef.current?.id !== operation.accountId) return false;
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 409)) {
          changeUser(null);
          void refresh();
        } else if (!failed.current.includes(operation)) failed.current.push(operation);
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível salvar. Confira sua conexão e tente novamente.');
        return false;
      } finally { setSaving(false); }
    });
    queue.current = task;
    return task;
  }, [changeUser, refresh]);

  const mutate = useCallback((path: string, body?: unknown, method = 'POST') => {
    const accountId = userRef.current?.id;
    if (!accountId) {
      setError('Entre com Google ou GitHub para salvar seu progresso.');
      return Promise.resolve(false);
    }
    const trackedBody = body && typeof body === 'object' && ['progress/quiz', 'progress/exam', 'progress/case'].includes(path)
      ? { ...body, eventId: eventId() } : body;
    return save({ path, method, body: trackedBody, accountId });
  }, [save]);

  const logout = useCallback(async () => {
    const accountId = userRef.current?.id;
    if (!accountId) return;
    ++loadVersion.current;
    setStatus('loading');
    try {
      await request('auth/logout', { method: 'POST', body: {}, accountId });
      changeUser(null);
      setStatus('ready');
      channel.current?.postMessage({ userId: null });
    } catch {
      setStatus('error');
      setError('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }, [changeUser]);

  const deleteAccount = useCallback(async (accountId: string) => {
    if (userRef.current?.id !== accountId) throw new ApiError(409, 'A conta mudou. Abra seu perfil novamente.');
    if (deletingAccount.current) return false;
    deletingAccount.current = accountId;
    ++loadVersion.current;
    try {
      await request('auth/account', { method: 'DELETE', body: { confirmation: 'EXCLUIR' }, accountId });
      if (userRef.current?.id !== accountId) return false;
      ++loadVersion.current;
      setAccountDeleted(true);
      changeUser(null);
      setSaving(false);
      setStatus('ready');
      channel.current?.postMessage({ userId: null });
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 409)) {
        deletingAccount.current = null;
        await refresh();
      }
      throw cause;
    } finally { deletingAccount.current = null; }
  }, [changeUser, refresh]);

  const retrySave = useCallback(async () => {
    if (failed.current.length) {
      for (const operation of [...failed.current]) if (!(await save(operation))) break;
    } else await refresh();
  }, [save, refresh]);

  const completeWelcome = useCallback(async () => {
    const accountId = userRef.current?.id;
    if (!accountId) throw new ApiError(401, 'Entre novamente para começar sua trilha.');
    try {
      const next = await request<User>('auth/welcome', { method: 'POST', body: {}, accountId });
      if (userRef.current?.id !== accountId) return false;
      // Ignore any older session refresh that still reports a pending welcome.
      ++loadVersion.current;
      changeUser(next);
      setStatus('ready');
      channel.current?.postMessage({ userId: accountId, welcomeCompleted: true });
      return true;
    } catch (cause) {
      if (userRef.current?.id === accountId && cause instanceof ApiError && (cause.status === 401 || cause.status === 409)) {
        changeUser(null);
        void refresh();
      }
      throw cause;
    }
  }, [changeUser, refresh]);

  return <Context.Provider value={{
    user, providers, status, progress, saving, accountDeleted, error, refresh, logout, deleteAccount, retrySave, completeWelcome,
    recordQuiz: (lessonKey, score) => mutate('progress/quiz', { lessonKey, score }),
    recordExam: (score) => mutate('progress/exam', { score }),
    recordCase: (slug, correct) => mutate('progress/case', { slug, correct }),
    reset: () => mutate('progress', undefined, 'DELETE'),
  }}>{children}</Context.Provider>;
}

export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error('useAccount requires AccountProvider');
  return value;
}
