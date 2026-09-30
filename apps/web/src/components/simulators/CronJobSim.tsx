import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge, Choice, EventLog, LogEntry, SimFrame, Stepper, Tone, logEntry, pushLog, useInterval } from './kit';

/**
 * CronJob "backup" num relógio acelerado (1 tick = 10 segundos):
 * - a cada horário agendado aplica a concurrencyPolicy (Allow, Forbid, Replace);
 * - Jobs não indexados, parallelism=1, restartPolicy=Never; backoff por falha de Pod;
 * - mantém successfulJobsHistoryLimit=3 e failedJobsHistoryLimit=1.
 */

export type Policy = 'Allow' | 'Forbid' | 'Replace';
export type JobStatus = 'Running' | 'Complete' | 'Failed' | 'Replaced';

export interface CJob {
  name: string;
  scheduledAt: number;
  attempt: number;
  attemptStart: number;
  duration: number;
  backoffLimit: number;
  retryAt?: number;
  status: JobStatus;
}

export interface CronState {
  minute: number;
  second: number;
  lastSchedule: number;
  every: number;
  duration: number;
  policy: Policy;
  failing: boolean;
  backoffLimit: number;
  jobs: CJob[];
  skipped: number;
  log: LogEntry[];
}

export const SUCCESS_HISTORY = 3;
export const FAILED_HISTORY = 1;

export const initialCron = (): CronState => ({
  minute: 0,
  second: 0,
  lastSchedule: 0,
  every: 2,
  duration: 3,
  policy: 'Allow',
  failing: false,
  backoffLimit: 6,
  jobs: [],
  skipped: 0,
  log: [logEntry('cronjob/backup schedule "*/2 * * * *"', 'blue')],
});

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function stepCron(s: CronState): CronState {
  for (let i = 0; i < 6; i++) s = tickCron(s);
  return s;
}

/** Ten simulated seconds; Kubernetes v1.34 Job controller caps Pod-failure backoff at 10 minutes. */
export function tickCron(s: CronState): CronState {
  const second = s.second + 10;
  const minute = Math.floor(second / 60);
  let log = s.log;
  let skipped = s.skipped;
  let lastSchedule = s.lastSchedule;

  // Progresso dos Jobs em execução
  let jobs = s.jobs.map((j) => {
    if (j.status !== 'Running') return j;
    if (j.retryAt !== undefined) {
      if (second < j.retryAt) return j;
      log = pushLog(log, logEntry(`${j.name}: iniciando tentativa ${j.attempt + 1}`, 'amber'));
      return { ...j, attempt: j.attempt + 1, attemptStart: second, retryAt: undefined };
    }
    if (second - j.attemptStart < j.duration * 60) return j;
    if (!s.failing) {
      log = pushLog(log, logEntry(`${j.name}: Complete (tentativa ${j.attempt})`, 'green'));
      return { ...j, status: 'Complete' as const };
    }
    if (j.attempt > j.backoffLimit) {
      log = pushLog(log, logEntry(`${j.name}: Failed — BackoffLimitExceeded (${j.attempt} tentativas)`, 'red'));
      return { ...j, status: 'Failed' as const };
    }
    const delay = Math.min(600, 10 * 2 ** (j.attempt - 1));
    log = pushLog(log, logEntry(`${j.name}: Pod falhou; retentativa em ${delay}s`, 'amber'));
    return { ...j, retryAt: second + delay };
  });

  // Horário agendado
  // With no startingDeadlineSeconds, Forbid can catch up the latest missed schedule.
  const scheduledAt = Math.floor(minute / s.every) * s.every;
  if (scheduledAt > lastSchedule) {
    const active = jobs.filter((j) => j.status === 'Running');
    const name = `backup-${scheduledAt}`;
    if (active.length && s.policy === 'Forbid') {
      if (second % (s.every * 60) === 0) {
        skipped += 1;
        log = pushLog(log, logEntry(`${hhmm(minute)} não iniciado: ${active[0].name} ainda está rodando (Forbid)`, 'amber'));
      }
    } else {
      if (active.length && s.policy === 'Replace') {
        jobs = jobs.map((j) => (j.status === 'Running' ? { ...j, status: 'Replaced' as const } : j));
        log = pushLog(log, logEntry(`${hhmm(minute)} ${active.map((j) => j.name).join(', ')} deletado(s) para dar lugar a ${name} (Replace)`, 'amber'));
      }
      lastSchedule = scheduledAt;
      jobs = [...jobs, { name, scheduledAt, attempt: 1, attemptStart: second, duration: s.duration, backoffLimit: s.backoffLimit, status: 'Running' }];
      log = pushLog(log, logEntry(`${hhmm(minute)} ${name} criado${active.length && s.policy === 'Allow' ? ` (em paralelo com ${active.length} ativo(s))` : ''}`, 'blue'));
    }
  }

  // Histórico
  const complete = jobs.filter((j) => j.status === 'Complete');
  const failed = jobs.filter((j) => j.status === 'Failed');
  const drop = new Set([
    ...complete.slice(0, Math.max(0, complete.length - SUCCESS_HISTORY)).map((j) => j.name),
    ...failed.slice(0, Math.max(0, failed.length - FAILED_HISTORY)).map((j) => j.name),
    ...jobs.filter((j) => j.status === 'Replaced').map((j) => j.name),
  ]);
  jobs = jobs.filter((j) => !drop.has(j.name));

  return { ...s, minute, second, lastSchedule, jobs, skipped, log };
}

const tone: Record<JobStatus, Tone> = { Running: 'cyan', Complete: 'green', Failed: 'red', Replaced: 'dim' };

export default function CronJobSim() {
  const [s, setS] = useState<CronState>(initialCron);
  const [running, setRunning] = useState(true);
  useInterval(() => setS(tickCron), running ? 200 : null);
  const set = (patch: Partial<CronState>) => setS((st) => ({ ...st, ...patch }));
  const active = s.jobs.filter((j) => j.status === 'Running').length;

  return (
    <SimFrame
      title={`batch/v1 · CronJob backup · relógio ${hhmm(s.minute)}:${String(s.second % 60).padStart(2, '0')}`}
      toolbar={
        <>
          <button aria-label={running ? 'Pausar relógio' : 'Retomar relógio'} className="btn-ghost px-2 py-1" onClick={() => setRunning((r) => !r)}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
          <button className="btn-ghost px-2 py-1" onClick={() => { setRunning(false); setS(tickCron); }}>Avançar 10s</button>
          <button className="btn-ghost px-2 py-1" onClick={() => setS(initialCron())}>Reset</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Choice label="schedule" value={String(s.every)} onChange={(v) => set({ every: Number(v) })} options={[1, 2, 5].map((n) => ({ value: String(n), label: `*/${n} * * * * (a cada ${n} min)` }))} />
            <Choice label="concurrencyPolicy" value={s.policy} onChange={(v) => set({ policy: v })} options={(['Allow', 'Forbid', 'Replace'] as Policy[]).map((p) => ({ value: p, label: p }))} />
            <Stepper label="Duração do Job (min)" value={s.duration} min={1} max={8} onChange={(v) => set({ duration: v })} />
            <Stepper label="backoffLimit (padrão: 6)" value={s.backoffLimit} min={0} max={10} onChange={(v) => set({ backoffLimit: v })} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-tactical-dim">
            <input type="checkbox" className="accent-[#326ce5]" checked={s.failing} onChange={(e) => set({ failing: e.target.checked })} /> O backup falha (ex.: banco inacessível)
          </label>

          <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-tactical-dim">
            <span>ativos: <span className="text-signal-cyan">{active}</span></span>
            <span>execuções puladas: <span className="text-signal-amber">{s.skipped}</span></span>
          </div>

          <div className="mt-3 space-y-1.5">
            {s.jobs.length === 0 && <p className="text-sm text-tactical-label">aguardando o primeiro horário…</p>}
            {[...s.jobs].reverse().map((j) => (
              <div key={j.name} className="flex flex-wrap items-center gap-3 rounded border border-tactical-border px-3 py-1.5 font-mono text-xs">
                <span className="w-28">{j.name}</span>
                <Badge tone={tone[j.status]}>{j.status}</Badge>
                <span className="text-tactical-label">agendado {hhmm(j.scheduledAt)} · tentativa {j.attempt}{j.retryAt !== undefined ? ` · retentativa em ${j.retryAt - s.second}s` : ''}</span>
                {j.status === 'Running' && (
                  <div className="ml-auto h-1.5 w-24 overflow-hidden rounded bg-tactical-raised">
                    <div className="h-full bg-signal-cyan" style={{ width: `${j.retryAt !== undefined ? 0 : Math.min(100, ((s.second - j.attemptStart) / (j.duration * 60)) * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-tactical-label">
            Com duração maior que o intervalo, Allow acumula Jobs em paralelo (e disputa recursos), Forbid pula execuções e Replace nunca deixa um
            backup terminar. Sem startingDeadlineSeconds, Forbid pode iniciar o último horário perdido quando o Job anterior termina.
            Alterações de duração e backoffLimit valem para os próximos Jobs. Cada Pod usa restartPolicy: Never; falhas aguardam 10s, 20s, 40s… até 10min (controlador do Kubernetes 1.34).
            O relógio é acelerado; pausá-lo congela a simulação, não altera spec.suspend. Histórico padrão: 3 sucessos e 1 falha.
          </p>
        </div>
        <EventLog entries={s.log} height="h-96" />
      </div>
    </SimFrame>
  );
}
