// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@jack-academy/contracts';
import { useAdminResource } from '../hooks/useAdminResource';
import { useActivityVisit } from '../hooks/useActivity';
import { ApiError, request } from '../lib/api';

let user: User | null;
vi.mock('../auth/AccountProvider', () => ({ useAccount: () => ({ user }) }));
vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), request: vi.fn() }));
const api = vi.mocked(request);
const staff: User = { id:'staff', name:'Admin', email:'admin@example.test', avatarUrl:null, provider:'google', welcomeCompleted:true, isAdmin:true };
beforeEach(() => { user = staff; api.mockReset(); api.mockResolvedValue({ registered: 10 }); });
afterEach(cleanup);

describe('administrative data access', () => {
  it('does not fetch for a non-admin and sends the administrator identity on reads', async () => {
    user = { ...staff, isAdmin: false };
    const { result, rerender } = renderHook(() => useAdminResource<{ registered: number }>('admin/overview'));
    expect(api).not.toHaveBeenCalled();
    user = staff;
    rerender();
    await waitFor(() => expect(result.current.data?.registered).toBe(10));
    expect(api).toHaveBeenCalledWith('admin/overview', { accountId: 'staff' });
  });
  it('clears sensitive data immediately when authorization is removed', async () => {
    const { result, rerender } = renderHook(() => useAdminResource('admin/overview'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    user = { ...staff, isAdmin: false };
    rerender();
    expect(result.current.data).toBeNull();
  });
  it('does not apply a delayed previous account response to another administrator', async () => {
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(() => useAdminResource<{ registered: number }>('admin/overview'));
    user = { ...staff, id: 'second-admin' };
    rerender();
    await waitFor(() => expect(result.current.data?.registered).toBe(10));
    await act(async () => { finish({ registered: 99 }); });
    expect(result.current.data?.registered).toBe(10);
    expect(api).toHaveBeenLastCalledWith('admin/overview', { accountId: 'second-admin' });
  });
  it('shows authorization errors without retaining previously loaded data', async () => {
    const { result } = renderHook(() => useAdminResource('admin/overview'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    api.mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toContain('não está autorizado'));
    expect(result.current.data).toBeNull();
  });
});

describe('learning visit tracking', () => {
  it('records one visit in StrictMode and does not repeat on account refresh', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { rerender } = renderHook(() => useActivityVisit('lesson_opened', 'containers/dockerfile'), { wrapper });
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    user = { ...staff };
    rerender();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('activity', { method:'POST', accountId:'staff', body:{ kind:'lesson_opened', target:'containers/dockerfile', eventId:expect.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/) } });
  });
  it('does not track guests, and binds later visits to their own account', async () => {
    user = null;
    const { rerender } = renderHook(({ target }) => useActivityVisit('simulator_opened', target), { initialProps:{target:'deployment'} });
    expect(api).not.toHaveBeenCalled();
    user = staff;
    rerender({target:'deployment'});
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    user = { ...staff, id:'student', isAdmin:false };
    rerender({target:'deployment'});
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api).toHaveBeenLastCalledWith('activity', expect.objectContaining({accountId:'student'}));
    api.mockRejectedValueOnce(new TypeError('offline'));
    rerender({target:'service'});
    await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
  });
});
