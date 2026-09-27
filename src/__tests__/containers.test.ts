import { describe, expect, it } from 'vitest';
import { containersModule } from '../content/containersModule';
import { containersCaseMeta } from '../content/containersCases';
import { modules } from '../content/modules';
import { cases } from '../content/cases';
import { simulators } from '../components/simulators/registry';

describe('módulo de containers (pré-requisito)', () => {
  it('é o primeiro módulo da trilha', () => {
    expect(modules[0].id).toBe('containers');
    expect(modules[0].title).toBe('Pré-requisito: Containers (Docker)');
    expect(modules[1].id).toBe('fundamentos');
  });

  it('10 lições completas, cada uma com quiz de 10 perguntas', () => {
    expect(containersModule.lessons).toHaveLength(10);
    for (const l of containersModule.lessons) {
      expect(l.content.length, l.slug).toBeGreaterThan(3000);
      expect(l.quiz, l.slug).toHaveLength(10);
      if (l.simulator) expect(simulators.some((s) => s.id === l.simulator)).toBe(true);
    }
  });

  it('12 estudos de caso carregados com sintomas e solução', () => {
    expect(containersCaseMeta).toHaveLength(12);
    const loaded = cases.filter((c) => c.slug.startsWith('ct-'));
    expect(loaded).toHaveLength(12);
    for (const c of loaded) {
      expect(c.area).toBe('Containers');
      expect(c.solution).toContain('## Causa raiz');
    }
  });
});
