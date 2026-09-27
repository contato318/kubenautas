import { useCallback, useEffect, useState } from 'react';

const KEY = 'kubenautas:progress:v1';

export interface Progress {
  /** lessonKey -> best quiz score (0..1) */
  quizzes: Record<string, number>;
  /** lessonKey -> ISO date when the lesson was completed */
  completed: Record<string, string>;
  examBest?: number;
}

const empty: Progress = { quizzes: {}, completed: {} };

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

const listeners = new Set<(p: Progress) => void>();
let state: Progress = load();

function save(next: Progress) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep in memory only */
  }
  listeners.forEach((l) => l(next));
}

export const lessonKey = (moduleId: string, slug: string) => `${moduleId}/${slug}`;

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(state);

  useEffect(() => {
    listeners.add(setProgress);
    return () => {
      listeners.delete(setProgress);
    };
  }, []);

  const recordQuiz = useCallback((key: string, score: number) => {
    const best = Math.max(state.quizzes[key] ?? 0, score);
    const completed = { ...state.completed };
    if (score >= 0.7 && !completed[key]) completed[key] = new Date().toISOString();
    save({ ...state, quizzes: { ...state.quizzes, [key]: best }, completed });
  }, []);

  const recordExam = useCallback((score: number) => {
    save({ ...state, examBest: Math.max(state.examBest ?? 0, score) });
  }, []);

  const reset = useCallback(() => save(empty), []);

  return { progress, recordQuiz, recordExam, reset };
}
