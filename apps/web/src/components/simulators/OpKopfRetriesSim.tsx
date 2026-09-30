import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle, type Tone } from './kit';

/** Como o Kopf trata o resultado de cada tentativa de um handler: sucesso, exceção, TemporaryError, PermanentError. */

export type Outcome = 'ok' | 'exception' | 'temporary' | 'permanent';
export interface RetryOpts {
  retries: number | null; // null = sem limite
  backoff: number; // segundos entre tentativas após exceção comum
  temporaryDelay: number; // delay passado em TemporaryError(delay=…)
  sideEffectBeforeFailure: boolean; // a 1ª tentativa cria o recurso externo e depois falha
  idempotent: boolean;
}
export interface Attempt {
  t: number;
  retry: number;
  text: string;
  tone: Tone;
}
export interface RetryResult {
  attempts: Attempt[];
  final: 'succeeded' | 'failed' | 'retrying';
}

export function simulateRetries(outcomes: Outcome[], o: RetryOpts): RetryResult {
  const attempts: Attempt[] = [];
  let t = 0;
  if (o.retries === 0) return { attempts: [{ t: 0, retry: 0, text: "Handler 'create_fn' has exceeded the number of retries (sem executar).", tone: 'red' }], final: 'failed' };
  for (let i = 0; i < outcomes.length; i++) {
    let out = outcomes[i];
    let msg = '';
    if (i > 0 && o.sideEffectBeforeFailure) {
      if (o.idempotent) msg = 'bucket "pedidos-backup" já existe → reutilizado; ';
      else {
        out = 'exception';
        msg = 'ApiException: (409) Conflict: bucket "pedidos-backup" AlreadyExists — ';
      }
    }
    const h = "Handler 'create_fn'";
    if (out === 'ok') {
      attempts.push({ t, retry: i, text: `${msg}${h} succeeded.`, tone: 'green' });
      return { attempts, final: 'succeeded' };
    }
    if (out === 'permanent') {
      attempts.push({ t, retry: i, text: `${msg}${h} failed permanently: engine não suportada.`, tone: 'red' });
      return { attempts, final: 'failed' };
    }
    const delay = out === 'temporary' ? o.temporaryDelay : o.backoff;
    const text = `${msg}${out === 'temporary' ? `${h} failed temporarily: banco ainda provisionando` : `${h} failed with an exception. Will retry.`}  (próxima tentativa em ${delay}s)`;
    attempts.push({ t, retry: i, text, tone: 'amber' });
    if (o.retries !== null && i + 1 >= o.retries) {
      attempts.push({ t: t + delay, retry: i + 1, text: `${h} has exceeded the number of retries.`, tone: 'red' });
      return { attempts, final: 'failed' };
    }
    t += delay;
  }
  return { attempts, final: 'retrying' };
}

const OUT: { value: Outcome; label: string }[] = [
  { value: 'ok', label: 'retorna normalmente' },
  { value: 'exception', label: 'raise Exception' },
  { value: 'temporary', label: 'raise kopf.TemporaryError' },
  { value: 'permanent', label: 'raise kopf.PermanentError' },
];

export default function OpKopfRetriesSim() {
  const [outs, setOuts] = useState<Outcome[]>(['exception', 'temporary', 'ok', 'ok', 'ok']);
  const [retries, setRetries] = useState('none');
  const [backoff, setBackoff] = useState('60');
  const [side, setSide] = useState(false);
  const [idem, setIdem] = useState(false);
  const r = simulateRetries(outs, { retries: retries === 'none' ? null : Number(retries), backoff: Number(backoff), temporaryDelay: 10, sideEffectBeforeFailure: side, idempotent: idem });

  return (
    <SimFrame title="create_fn · tentativas, backoff e desfecho" toolbar={<Badge tone={r.final === 'succeeded' ? 'green' : r.final === 'failed' ? 'red' : 'amber'}>{r.final}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {outs.map((o, i) => (
            <Choice key={i} label={`tentativa ${i + 1} (retry=${i})`} value={o} onChange={(v) => setOuts((xs) => xs.map((x, j) => (j === i ? v : x)))} options={OUT} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Choice label="retries=" value={retries} onChange={setRetries} options={[{ value: 'none', label: 'sem limite' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
            <Choice label="backoff=" value={backoff} onChange={setBackoff} options={[{ value: '60', label: '60s (padrão)' }, { value: '15', label: '15s' }, { value: '5', label: '5s' }]} />
          </div>
          <Toggle checked={side} onChange={setSide}><span className="text-xs">A 1ª tentativa cria o bucket externo e só depois falha</span></Toggle>
          <Toggle checked={idem} onChange={setIdem}><span className="text-xs">Handler idempotente (verifica se já existe antes de criar)</span></Toggle>
        </div>
        <div className="min-w-0">
          <ol className="space-y-2">
            {r.attempts.map((a, i) => (
              <li key={i} className="rounded-md border border-tactical-border p-2 font-mono text-xs">
                <span className="text-tactical-label">t={a.t}s · retry={a.retry} · </span>
                <span className={a.tone === 'green' ? 'text-signal-green' : a.tone === 'red' ? 'text-signal-red' : 'text-signal-amber'}>{a.text}</span>
              </li>
            ))}
          </ol>
          {r.final === 'retrying' && <p className="mt-2 text-sm text-signal-amber">…e continua tentando para sempre enquanto o erro persistir (sem limite de retries).</p>}
          <pre className="mt-3 overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{`@kopf.on.create('databases'${retries !== 'none' ? `, retries=${retries}` : ''}${backoff !== '60' ? `, backoff=${backoff}` : ''})
def create_fn(spec, name, retry, logger, **_):
    if spec['engine'] not in ('postgres', 'mysql'):
        raise kopf.PermanentError("engine não suportada")   # não adianta tentar de novo
    ${idem ? 'bucket = storage.get_or_create(f"{name}-backup")   # idempotente' : 'bucket = storage.create(f"{name}-backup")   # falha com 409 na 2ª vez'}
    if not db.ready(name):
        raise kopf.TemporaryError("banco ainda provisionando", delay=10)
    return {"bucket": bucket.id}`}</pre>
        </div>
      </div>
    </SimFrame>
  );
}
