import { describe, expect, it } from 'vitest';
import { searchSimulators, simulatorCategories, simulatorCategory } from '../components/simulators/catalog';
import { simulators } from '../components/simulators/registry';

describe('simulator catalog', () => {
  it('makes every registered simulator available in exactly one category', () => {
    const ids = simulatorCategories.flatMap((category) => category.simulatorIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(simulators.map((simulator) => simulator.id).sort());
    expect(simulatorCategories.every((category) => category.simulatorIds.length > 0)).toBe(true);
  });

  it('finds titles and descriptions regardless of accents or capitalization', () => {
    expect(searchSimulators('todos', '  DIAGNOSTICO  ').map((item) => item.id)).toContain('ts-diagnosis');
    expect(searchSimulators('todos', 'réplicas').map((item) => item.id)).toContain('hpa');
    expect(searchSimulators('todos', 'replicas')).toEqual(searchSimulators('todos', 'réplicas'));
  });

  it('combines search words while keeping results within the selected category', () => {
    const results = searchSimulators('helm', 'values templates');
    expect(results.map((item) => item.id)).toContain('helm-template');
    expect(results.every((item) => simulatorCategory(item.id)?.id === 'helm')).toBe(true);
    expect(searchSimulators('rede', 'helm')).toEqual([]);
  });

  it('supports an empty search and a genuinely empty result', () => {
    expect(searchSimulators('todos', '   ')).toEqual(simulators);
    expect(searchSimulators('todos', 'nao-existe-um-simulador-com-este-nome')).toEqual([]);
  });
});
