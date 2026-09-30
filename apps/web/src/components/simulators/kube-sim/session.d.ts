export interface MissionTask { text: string; hint: string; sol: string }
export interface Mission { id: string; level: string; title: string; intro: string; tasks: MissionTask[]; scenario?: boolean }
export interface SessionSnapshot {
  lines: { kind: 'in' | 'out' | 'err'; text: string; ansi?: string }[];
  busy: boolean;
  prompt: string;
  promptAnsi: string;
  interactive: boolean;
  pending: boolean;
  namespace: string;
  active: number;
  done: boolean[][];
  prepared: boolean[];
  editing: { path: string; content: string } | null;
  nodes: { name: string; schedulable: boolean }[];
  pods: { name: string; namespace: string; node: string; status: string }[];
  deployments: number;
  services: number;
}
export class SimulatorSession {
  constructor();
  missions: Mission[];
  levels: [string, string][];
  history: string[];
  subscribe(callback: () => void): () => void;
  getSnapshot(): SessionSnapshot;
  tick(): void;
  stop(): void;
  resume(): void;
  clear(): void;
  reset(): void;
  select(index: number): void;
  prepare(): void;
  submit(line: string): Promise<number | undefined>;
  interrupt(input?: string): void;
  finishEdit(content: string | null): void;
  complete(value: string, caret?: number): { value: string; caret: number };
}
