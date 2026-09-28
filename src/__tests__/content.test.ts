import { describe, expect, it } from 'vitest';
import { modules, allLessons, findLesson } from '../content/modules';
import { extraQuizzes } from '../content/quizzesExtra';
import { cases, SOLUTION_MARKER } from '../content/cases';
import { simulators } from '../components/simulators/registry';

describe('conteúdo', () => {
  it('toda lição tem conteúdo e pelo menos 10 perguntas válidas', () => {
    for (const { module, lesson } of allLessons) {
      expect(lesson.content.length, `${module.id}/${lesson.slug}`).toBeGreaterThan(500);
      expect(lesson.quiz.length, `${module.id}/${lesson.slug}`).toBeGreaterThanOrEqual(10);
      for (const q of lesson.quiz) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });

  it('slugs são únicos e navegação prev/next é consistente', () => {
    const keys = allLessons.map(({ module, lesson }) => `${module.id}/${lesson.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    const first = findLesson(modules[0].id, modules[0].lessons[0].slug)!;
    expect(first.prev).toBeNull();
    expect(first.next?.lesson.slug).toBe(modules[0].lessons[1].slug);
  });

  it('perguntas extras apontam para lições existentes e nenhuma pergunta se repete', () => {
    const keys = new Set(allLessons.map(({ module, lesson }) => `${module.id}/${lesson.slug}`));
    for (const key of Object.keys(extraQuizzes)) expect(keys.has(key), key).toBe(true);
    const texts = allLessons.flatMap(({ lesson }) => lesson.quiz.map((q) => q.q));
    expect(texts.length).toBe(800);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('simuladores das lições existem no registro', () => {
    const ids = new Set(simulators.map((s) => s.id));
    for (const { lesson } of allLessons) {
      for (const id of [lesson.simulator, ...(lesson.extraSimulators ?? [])]) if (id) expect(ids.has(id), id).toBe(true);
    }
  });

  it('86 estudos de caso completos, com diagnóstico válido', () => {
    expect(cases).toHaveLength(86);
    expect(new Set(cases.map((c) => c.slug)).size).toBe(86);
    for (const c of cases) {
      expect(c.symptoms.length, c.slug).toBeGreaterThan(300);
      expect(c.solution.length, c.slug).toBeGreaterThan(500);
      expect(c.symptoms).not.toContain(SOLUTION_MARKER);
      for (const section of ['## Causa raiz', '## Correção', '## Prevenção']) expect(c.solution, `${c.slug} ${section}`).toContain(section);
      expect(c.diagnosis.answer).toBeLessThan(c.diagnosis.options.length);
      if (c.simulator) expect(simulators.some((s) => s.id === c.simulator)).toBe(true);
    }
  });
});
