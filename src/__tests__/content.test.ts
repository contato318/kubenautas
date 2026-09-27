import { describe, expect, it } from 'vitest';
import { modules, allLessons, findLesson } from '../content/modules';

describe('conteúdo', () => {
  it('toda lição tem conteúdo e pelo menos 5 perguntas válidas', () => {
    for (const { module, lesson } of allLessons) {
      expect(lesson.content.length, `${module.id}/${lesson.slug}`).toBeGreaterThan(500);
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(5);
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
});
