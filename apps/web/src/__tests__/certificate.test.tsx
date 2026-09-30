// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Certificate, CertificateResponse } from '@jack-academy/contracts';
import { useCertificate } from '../hooks/useCertificate';
import { ApiError, request } from '../lib/api';

vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), request: vi.fn() }));
const api = vi.mocked(request);
const certificate: Certificate = { id: 'certificate-alice', fullName: 'Alice dos Santos', examScore: 0.8, issuedAt: '2026-09-29T15:00:00.000Z', verificationUrl: 'http://localhost:5173/certificados/certificate-alice' };
beforeEach(() => { api.mockReset(); api.mockResolvedValue({ certificate: null }); });
afterEach(cleanup);

describe('certificates by account', () => {
  it('does not load or issue a certificate without an account', async () => {
    const { result } = renderHook(() => useCertificate());
    await act(async () => { expect(await result.current.issue('Alice dos Santos')).toBeNull(); });
    expect(api).not.toHaveBeenCalled();
    expect(result.current.certificate).toBeNull();
  });

  it('binds reads and issuance to the current account and keeps the server document', async () => {
    const { result } = renderHook(() => useCertificate('alice'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(api).toHaveBeenCalledWith('certificate', { accountId: 'alice' });
    api.mockResolvedValueOnce(certificate);
    await act(async () => { expect(await result.current.issue(certificate.fullName)).toEqual(certificate); });
    expect(api).toHaveBeenLastCalledWith('certificate', { method: 'POST', accountId: 'alice', body: { fullName: certificate.fullName } });
    expect(result.current.certificate).toEqual(certificate);
    expect(result.current.issuing).toBe(false);
  });

  it('supports retry after a load failure or an unsaved passing score', async () => {
    api.mockRejectedValueOnce(new TypeError('offline'));
    const { result } = renderHook(() => useCertificate('alice'));
    await waitFor(() => expect(result.current.error).toContain('carregar'));
    await act(() => result.current.reload());
    expect(result.current.loaded).toBe(true);
    api.mockRejectedValueOnce(new ApiError(403, 'not eligible'));
    await act(async () => { expect(await result.current.issue(certificate.fullName)).toBeNull(); });
    expect(result.current.error).toContain('aprovação ainda não está registrada');
    expect(result.current.certificate).toBeNull();
    api.mockResolvedValueOnce(certificate);
    await act(() => result.current.issue(certificate.fullName));
    expect(result.current.certificate).toEqual(certificate);
    expect(result.current.error).toBeNull();
  });

  it('ignores a previous account read after switching users', async () => {
    let finish!: (value: CertificateResponse) => void;
    api.mockImplementationOnce(() => new Promise<CertificateResponse>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useCertificate(id), { initialProps: { id: 'alice' } });
    rerender({ id: 'bob' });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { finish({ certificate }); });
    expect(result.current.accountId).toBe('bob');
    expect(result.current.certificate).toBeNull();
  });

  it('ignores issuance from a previous account and clears its visible certificate', async () => {
    api.mockResolvedValueOnce({ certificate });
    const { result, rerender } = renderHook(({ id }) => useCertificate(id), { initialProps: { id: 'alice' } });
    await waitFor(() => expect(result.current.certificate).toEqual(certificate));
    let finish!: (value: Certificate) => void;
    api.mockImplementationOnce(() => new Promise<Certificate>((resolve) => { finish = resolve; }));
    let pending!: Promise<Certificate | null>;
    await act(async () => { pending = result.current.issue(certificate.fullName); });
    rerender({ id: 'bob' });
    expect(result.current.certificate).toBeNull();
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { finish(certificate); expect(await pending).toBeNull(); });
    expect(result.current.accountId).toBe('bob');
    expect(result.current.certificate).toBeNull();
  });
});
