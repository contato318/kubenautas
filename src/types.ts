export type SimulatorId =
  | 'deployment'
  | 'rolling-update'
  | 'service'
  | 'scheduler'
  | 'hpa'
  | 'pod-lifecycle'
  | 'terminal';

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  content: string;
  simulator?: SimulatorId;
  quiz: Question[];
}

export type Level = 'Básico' | 'Intermediário' | 'Avançado';

export interface Module {
  id: string;
  title: string;
  description: string;
  level: Level;
  emoji: string;
  lessons: Lesson[];
}
