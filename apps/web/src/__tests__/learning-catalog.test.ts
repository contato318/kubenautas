import { describe, expect, it } from 'vitest';
import { learningCatalog } from '@jack-academy/contracts';
import { modules } from '../content/modules';
import { cases } from '../content/cases';
import { simulators } from '../components/simulators/registry';

describe('shared administrative learning catalog', () => {
  it('matches every lesson used to calculate completion', () => {
    expect(learningCatalog.modules).toEqual(modules.map(module => ({ id: module.id, title: module.title, lessons: module.lessons.map(lesson => ({ key: `${module.id}/${lesson.slug}`, title: lesson.title })) })));
  });
  it('matches the cases and simulators accepted for activity tracking', () => {
    expect(learningCatalog.cases).toEqual(cases.map(item => ({ id: item.slug, title: item.title })));
    expect(learningCatalog.simulators).toEqual(simulators.map(item => ({ id: item.id, title: item.title })));
  });
});
