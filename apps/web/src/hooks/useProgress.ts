import { useAccount } from '../auth/AccountProvider';
export type { Progress } from '@jack-academy/contracts';

export const lessonKey = (moduleId: string, slug: string) => `${moduleId}/${slug}`;

export function useProgress() {
  const { progress, recordQuiz, recordExam, recordCase, reset } = useAccount();
  return { progress, recordQuiz, recordExam, recordCase, reset };
}
