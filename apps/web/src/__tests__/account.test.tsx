// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Progress, User } from '@jack-academy/contracts';
import { AccountProvider, useAccount } from '../auth/AccountProvider';
import { ApiError, request } from '../lib/api';

vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), request: vi.fn() }));
const api = vi.mocked(request);
const alice: User = { id: 'alice', name: 'Alice', email: null, avatarUrl: null, provider: 'google', welcomeCompleted: false, isAdmin: false };
const bob: User = { ...alice, id: 'bob', name: 'Bob', provider: 'github' };
const empty = (): Progress => ({ quizzes: {}, completed: {}, cases: {} });
const saved: Progress = { ...empty(), examBest: 0.9 };
let current: User | null;
let progress: Progress;
function wrapper({ children }: { children: ReactNode }) { return <AccountProvider>{children}</AccountProvider>; }
async function mount() {
  const hook = renderHook(useAccount, { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

beforeEach(() => {
  current = alice;
  progress = saved;
  api.mockReset();
  api.mockImplementation(async (path) => {
    if (path === 'auth/me') return { user: current, providers: { google: true, github: true } };
    if (path === 'auth/logout') { current = null; return undefined; }
    return progress;
  });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('account progress', () => {
  it('guests never import shared legacy progress or write it to an account', async () => {
    current = null;
    localStorage.setItem('kubenautas:progress:v1', JSON.stringify(saved));
    const { result } = await mount();
    expect(result.current.progress).toEqual(empty());
    await act(async () => { expect(await result.current.recordExam(1)).toBe(false); });
    expect(api.mock.calls.every(([path]) => path === 'auth/me')).toBe(true);
    expect(localStorage.getItem('kubenautas:progress:v1')).toBe(JSON.stringify(saved));
  });

  it('loads server progress and binds every read and write to the current account', async () => {
    const { result } = await mount();
    expect(result.current.progress.examBest).toBe(0.9);
    expect(api).toHaveBeenCalledWith('progress', { accountId: 'alice' });
    progress = { ...saved, quizzes: { 'containers/dockerfile': 0.8 } };
    await act(async () => { expect(await result.current.recordQuiz('containers/dockerfile', 0.8)).toBe(true); });
    expect(api).toHaveBeenLastCalledWith('progress/quiz', expect.objectContaining({ accountId: 'alice', method: 'POST', body: { lessonKey: 'containers/dockerfile', score: 0.8, eventId: expect.any(String) } }));
    expect(result.current.progress.quizzes['containers/dockerfile']).toBe(0.8);
  });

  it('clears progress on logout and restores only the next account progress', async () => {
    const { result } = await mount();
    await act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(result.current.progress).toEqual(empty());
    current = bob;
    progress = empty();
    await act(() => result.current.refresh());
    expect(result.current.user?.id).toBe('bob');
    expect(result.current.progress.examBest).toBeUndefined();
  });

  it('ignores an old account response after switching users', async () => {
    const { result } = await mount();
    let finish!: (value: Progress) => void;
    api.mockImplementationOnce(() => new Promise<Progress>((resolve) => { finish = resolve; }));
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.recordExam(1); });
    current = bob;
    progress = empty();
    await act(() => result.current.refresh());
    await act(async () => { finish({ ...saved, examBest: 1 }); await pending; });
    expect(result.current.user?.id).toBe('bob');
    expect(result.current.progress).toEqual(empty());
  });

  it('retains failed writes in order and retries without reporting unsaved success', async () => {
    const { result } = await mount();
    api.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { expect(await result.current.recordCase('crashloop-config', false)).toBe(false); });
    expect(result.current.error).toContain('Não foi possível salvar');
    expect(result.current.progress.cases).toEqual({});
    const calls = api.mock.calls.length;
    await act(async () => { expect(await result.current.recordCase('crashloop-config', true)).toBe(false); });
    expect(api.mock.calls.length).toBe(calls);
    progress = { ...saved, cases: { 'crashloop-config': { at: '2026-09-29T00:00:00Z', correct: false } } };
    await act(() => result.current.retrySave());
    const attempts = api.mock.calls.filter(([path]) => path === 'progress/case');
    expect(attempts.map(([, options]) => options?.body)).toEqual([
      { slug: 'crashloop-config', correct: false, eventId: expect.any(String) }, { slug: 'crashloop-config', correct: false, eventId: expect.any(String) }, { slug: 'crashloop-config', correct: true, eventId: expect.any(String) },
    ]);
    expect(attempts[0][1]?.body).toEqual(attempts[1][1]?.body);
    expect(result.current.error).toBeNull();
    expect(result.current.progress.cases?.['crashloop-config'].correct).toBe(false);
  });

  it('clears expired sessions without transferring a failed write to another account', async () => {
    const { result } = await mount();
    current = null;
    api.mockRejectedValueOnce(new ApiError(401, 'Sua sessão expirou.'));
    await act(async () => { await result.current.recordExam(1); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.user).toBeNull();
    expect(result.current.progress).toEqual(empty());
    current = bob;
    progress = empty();
    await act(() => result.current.retrySave());
    expect(result.current.user?.id).toBe('bob');
    expect(api.mock.calls.filter(([path]) => path === 'progress/exam')).toHaveLength(1);
  });

  it('completes welcome for the current account without clearing learning progress', async () => {
    const { result } = await mount();
    api.mockResolvedValueOnce({ ...alice, welcomeCompleted: true });
    await act(async () => { expect(await result.current.completeWelcome()).toBe(true); });
    expect(api).toHaveBeenLastCalledWith('auth/welcome', { method: 'POST', body: {}, accountId: 'alice' });
    expect(result.current.user?.welcomeCompleted).toBe(true);
    expect(result.current.progress).toEqual(saved);
  });

  it('keeps welcome pending after a failure so the user can retry', async () => {
    const { result } = await mount();
    api.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { await expect(result.current.completeWelcome()).rejects.toThrow('offline'); });
    expect(result.current.user?.welcomeCompleted).toBe(false);
    api.mockResolvedValueOnce({ ...alice, welcomeCompleted: true });
    await act(async () => { await result.current.completeWelcome(); });
    expect(result.current.user?.welcomeCompleted).toBe(true);
  });

  it('does not apply welcome completion from a previous account to the next account', async () => {
    const { result } = await mount();
    let finish!: (value: User) => void;
    api.mockImplementationOnce(() => new Promise<User>((resolve) => { finish = resolve; }));
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.completeWelcome(); });
    current = bob;
    progress = empty();
    await act(() => result.current.refresh());
    await act(async () => { finish({ ...alice, welcomeCompleted: true }); expect(await pending).toBe(false); });
    expect(result.current.user?.id).toBe('bob');
    expect(result.current.user?.welcomeCompleted).toBe(false);
  });

  it('deletes only the current account and discards its failed writes before another login', async () => {
    const { result } = await mount();
    api.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { await result.current.recordExam(1); });
    api.mockResolvedValueOnce(undefined);
    await act(async () => { expect(await result.current.deleteAccount(alice.id)).toBe(true); });
    expect(api).toHaveBeenLastCalledWith('auth/account', { method: 'DELETE', body: { confirmation: 'EXCLUIR' }, accountId: alice.id });
    expect(result.current.accountDeleted).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.progress).toEqual(empty());
    expect(result.current.error).toBeNull();
    current = bob;
    progress = empty();
    await act(() => result.current.retrySave());
    expect(result.current.user?.id).toBe(bob.id);
    expect(result.current.accountDeleted).toBe(false);
    expect(api.mock.calls.filter(([path]) => path === 'progress/exam')).toHaveLength(1);
  });

  it('rejects deletion after switching accounts without making a destructive request', async () => {
    const { result } = await mount();
    current = bob;
    await act(() => result.current.refresh());
    await act(async () => { await expect(result.current.deleteAccount(alice.id)).rejects.toThrow('A conta mudou'); });
    expect(api.mock.calls.some(([path]) => path === 'auth/account')).toBe(false);
    expect(result.current.user?.id).toBe(bob.id);
  });

  it('keeps the account and results when deletion fails and allows an explicit retry', async () => {
    const { result } = await mount();
    api.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { await expect(result.current.deleteAccount(alice.id)).rejects.toThrow('offline'); });
    expect(result.current.accountDeleted).toBe(false);
    expect(result.current.user?.id).toBe(alice.id);
    expect(result.current.progress).toEqual(saved);
    api.mockResolvedValueOnce(undefined);
    await act(async () => { expect(await result.current.deleteAccount(alice.id)).toBe(true); });
    expect(api.mock.calls.filter(([path]) => path === 'auth/account')).toHaveLength(2);
  });

  it('blocks duplicate deletion and focus refresh while pending, and ignores an older quiz response', async () => {
    const { result } = await mount();
    let finishSave!: (value: Progress) => void;
    let finishDelete!: () => void;
    api.mockImplementationOnce(() => new Promise<Progress>(resolve => { finishSave = resolve; }));
    let pendingSave!: Promise<boolean>;
    await act(async () => { pendingSave = result.current.recordExam(1); });
    api.mockImplementationOnce(() => new Promise<void>(resolve => { finishDelete = resolve; }));
    let pendingDelete!: Promise<boolean>;
    await act(async () => { pendingDelete = result.current.deleteAccount(alice.id); });
    const calls = api.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      expect(await result.current.deleteAccount(alice.id)).toBe(false);
    });
    expect(api.mock.calls.length).toBe(calls);
    await act(async () => { finishDelete(); expect(await pendingDelete).toBe(true); });
    await act(async () => { finishSave({ ...saved, examBest: 1 }); expect(await pendingSave).toBe(false); });
    expect(result.current.user).toBeNull();
    expect(result.current.progress).toEqual(empty());
  });

});
