// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Certificate } from '@jack-academy/contracts';
import { usePublicCertificate } from '../hooks/usePublicCertificate';
import { ApiError, request } from '../lib/api';

vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), request: vi.fn() }));
const api = vi.mocked(request);
const id = 'b7e226fd-90b7-4b20-8724-3b552eef7402';
const otherId = 'f5b48c63-0d77-4258-b819-bd827875da37';
const certificate: Certificate = { id, fullName: 'Ana dos Santos', examScore: 0.8, issuedAt: '2026-09-29T15:00:00.000Z', verificationUrl: `https://example.test/certificados/${id}` };
beforeEach(() => { api.mockReset(); api.mockResolvedValue(certificate); });
afterEach(cleanup);

describe('public certificate verification', () => {
  it('loads the registered document without account headers', async () => {
    const { result } = renderHook(() => usePublicCertificate(id));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('valid'));
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith(`certificates/${id}`);
    expect(result.current.certificate).toEqual(certificate);
  });

  it.each([undefined, 'PREVIA-NOTA-ILUSTRATIVA', '../certificate', 'invalid'])('rejects a malformed identifier (%s) without fetching', async (invalid) => {
    const { result } = renderHook(() => usePublicCertificate(invalid));
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(api).not.toHaveBeenCalled();
    expect(result.current.certificate).toBeNull();
  });

  it('does not verify an identifier absent from the registry', async () => {
    api.mockRejectedValueOnce(new ApiError(404, 'not found'));
    const { result } = renderHook(() => usePublicCertificate(id));
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(result.current.certificate).toBeNull();
  });

  it('distinguishes connection failures from missing certificates and supports retry', async () => {
    api.mockRejectedValueOnce(new TypeError('offline'));
    const { result } = renderHook(() => usePublicCertificate(id));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.certificate).toBeNull();
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('valid'));
    expect(result.current.certificate).toEqual(certificate);
  });

  it('hides the previous certificate and ignores its late response when the URL changes', async () => {
    let finish!: (certificate: Certificate) => void;
    api.mockImplementationOnce(() => new Promise<Certificate>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ currentId }) => usePublicCertificate(currentId), { initialProps: { currentId: id } });
    api.mockRejectedValueOnce(new ApiError(404, 'not found'));
    rerender({ currentId: otherId });
    expect(result.current.certificate).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    await act(async () => { finish(certificate); });
    expect(result.current.certificate).toBeNull();
    expect(result.current.status).toBe('not-found');
  });
});
