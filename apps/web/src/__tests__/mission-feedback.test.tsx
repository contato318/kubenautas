// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useObjectiveCompletion } from '../components/simulators/kube-sim/MissionFeedback';
import type { Mission } from '../components/simulators/kube-sim/session';

const missions: Mission[] = [{ id: 'cluster', level: 'basico', title: 'Conheça o cluster', intro: '', tasks: [
  { text: 'Liste os nós do cluster', hint: '', sol: '' },
  { text: 'Liste todos os Pods', hint: '', sol: '' },
] }];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('objective completion feedback', () => {
  it('celebrates a newly completed objective once, without replaying it on cluster ticks or revisits', () => {
    const { result, rerender } = renderHook(({ done }) => useObjectiveCompletion(done, missions), { initialProps: { done: [[false, false]] } });
    expect(result.current).toBeUndefined();
    rerender({ done: [[true, false]] });
    expect(result.current?.title).toBe('Liste os nós do cluster');
    const id = result.current?.id;
    act(() => vi.advanceTimersByTime(3000));
    rerender({ done: [[true, false]] });
    expect(result.current?.id).toBe(id);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeUndefined();
    rerender({ done: [[true, false]] });
    expect(result.current).toBeUndefined();
  });

  it('queues simultaneous objectives and discards pending celebrations when progress resets', () => {
    const { result, rerender } = renderHook(({ done }) => useObjectiveCompletion(done, missions), { initialProps: { done: [[false, false]] } });
    rerender({ done: [[true, true]] });
    expect(result.current?.step).toBe(1);
    act(() => vi.advanceTimersByTime(3400));
    expect(result.current?.title).toBe('Liste todos os Pods');
    rerender({ done: [[false, false]] });
    expect(result.current).toBeUndefined();
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current).toBeUndefined();
    rerender({ done: [[true, false]] });
    expect(result.current?.title).toBe('Liste os nós do cluster');
  });

  it('does not celebrate objectives that were already completed on mount', () => {
    const { result } = renderHook(() => useObjectiveCompletion([[true, true]], missions));
    expect(result.current).toBeUndefined();
  });
});
