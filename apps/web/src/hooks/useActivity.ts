import { useCallback, useEffect, useRef } from 'react';
import type { VisitKind } from '@jack-academy/contracts';
import { useAccount } from '../auth/AccountProvider';
import { request } from '../lib/api';
import { eventId as newEventId } from '../lib/eventId';

export function useActivity() {
  const { user } = useAccount();
  const accountId = user?.id;
  return useCallback((kind: VisitKind, target: string, eventId?: string) => {
    if (!accountId) return;
    // Browsing telemetry must never block learning or report an unsaved quiz as saved.
    void request('activity', { method: 'POST', accountId, body: { kind, target, eventId: eventId ?? newEventId() } }).catch(() => {});
  }, [accountId]);
}

export function useActivityVisit(kind: VisitKind, target?: string) {
  const { user } = useAccount();
  const track = useActivity();
  const last = useRef('');
  useEffect(() => {
    const key = user && target ? `${user.id}:${kind}:${target}` : '';
    if (!key) { last.current = ''; return; }
    if (last.current === key) return;
    last.current = key;
    track(kind, target!);
  }, [user?.id, kind, target, track]);
}
