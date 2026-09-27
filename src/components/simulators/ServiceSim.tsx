import { useState } from 'react';
import { Plus, Send, Trash2, Zap } from 'lucide-react';
import { Badge, EventLog, LogEntry, SimFrame, logEntry, pushLog, rid, useInterval } from './kit';

interface Pod {
  name: string;
  ip: string;
  labelApp: 'web' | 'debug';
  ready: boolean;
  hits: number;
}

interface State {
  pods: Pod[];
  rr: number;
  lastHit: string | null;
  ok: number;
  failed: number;
  log: LogEntry[];
}

let ipSeq = 10;
const newPod = (): Pod => ({ name: `web-${rid()}`, ip: `10.244.${1 + (ipSeq % 3)}.${ipSeq++}`, labelApp: 'web', ready: true, hits: 0 });

const initial = (): State => ({ pods: [newPod(), newPod(), newPod()], rr: 0, lastHit: null, ok: 0, failed: 0, log: [] });

const isEndpoint = (p: Pod) => p.labelApp === 'web' && p.ready;

function sendRequest(s: State): State {
  const endpoints = s.pods.filter(isEndpoint);
  if (endpoints.length === 0) {
    return { ...s, lastHit: null, failed: s.failed + 1, log: pushLog(s.log, logEntry('GET http://web → 503 / connection refused (Service sem endpoints!)', 'red')) };
  }
  const target = endpoints[s.rr % endpoints.length];
  return {
    ...s,
    rr: s.rr + 1,
    lastHit: target.name,
    ok: s.ok + 1,
    pods: s.pods.map((p) => (p.name === target.name ? { ...p, hits: p.hits + 1 } : p)),
    log: pushLog(s.log, logEntry(`GET http://web (10.96.0.42:80) → ${target.name} (${target.ip}:8080) 200 OK`, 'green')),
  };
}

export default function ServiceSim() {
  const [s, setS] = useState<State>(initial);
  const [auto, setAuto] = useState(false);
  useInterval(() => setS(sendRequest), auto ? 450 : null);

  const update = (name: string, fn: (p: Pod) => Pod, msg: string) =>
    setS((st) => ({ ...st, pods: st.pods.map((p) => (p.name === name ? fn(p) : p)), log: pushLog(st.log, logEntry(msg, 'amber')) }));

  const endpoints = s.pods.filter(isEndpoint);

  return (
    <SimFrame title="service/web · ClusterIP 10.96.0.42" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setS(initial())}>Reset</button>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary px-3 py-1.5" onClick={() => setS(sendRequest)}>
          <Send className="h-3.5 w-3.5" /> Enviar requisição
        </button>
        <button className={`btn-ghost px-3 py-1.5 ${auto ? 'border-signal-amber text-signal-amber' : ''}`} onClick={() => setAuto((a) => !a)}>
          <Zap className="h-3.5 w-3.5" /> {auto ? 'Parar tráfego' : 'Tráfego contínuo'}
        </button>
        <button className="btn-ghost px-3 py-1.5" onClick={() => setS((st) => ({ ...st, pods: [...st.pods, newPod()], log: pushLog(st.log, logEntry('ReplicaSet criou um novo pod', 'blue')) }))}>
          <Plus className="h-3.5 w-3.5" /> Pod
        </button>
        <span className="ml-auto font-mono text-xs">
          <span className="text-signal-green">{s.ok} ok</span> · <span className="text-signal-red">{s.failed} falhas</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 rounded-md border border-k8s-500/50 bg-k8s-500/10 p-3 font-mono text-xs">
            <div className="mb-1 text-k8s-400">Service web</div>
            <div className="text-tactical-dim">selector: <span className="text-signal-amber">app=web</span> · port 80 → targetPort 8080</div>
            <div className="mt-2 text-tactical-dim">
              EndpointSlice:{' '}
              {endpoints.length ? endpoints.map((p) => <span key={p.name} className="mr-2 text-signal-green">{p.ip}:8080</span>) : <span className="text-signal-red">&lt;none&gt;</span>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.pods.map((p) => {
              const inEp = isEndpoint(p);
              return (
                <div
                  key={p.name}
                  className={`rounded-md border p-3 transition-all ${s.lastHit === p.name ? 'border-signal-green shadow-[0_0_0_2px_rgba(52,211,153,0.25)]' : inEp ? 'border-tactical-line' : 'border-dashed border-signal-red/50 opacity-80'} bg-tactical-bg`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{p.name}</span>
                    <button title="Deletar pod" onClick={() => setS((st) => ({ ...st, pods: st.pods.filter((x) => x.name !== p.name), log: pushLog(st.log, logEntry(`pod ${p.name} deletado`, 'red')) }))}>
                      <Trash2 className="h-3.5 w-3.5 text-tactical-label hover:text-signal-red" />
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-tactical-label">{p.ip}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone={p.labelApp === 'web' ? 'blue' : 'dim'}>app={p.labelApp}</Badge>
                    <Badge tone={p.ready ? 'green' : 'red'}>{p.ready ? 'Ready 1/1' : 'Ready 0/1'}</Badge>
                  </div>
                  <div className="mt-2 font-mono text-xs">requisições: <b>{p.hits}</b></div>
                  <div className="mt-3 flex flex-col gap-1">
                    <button
                      className="btn-ghost justify-center px-2 py-1 text-[10px]"
                      onClick={() => update(p.name, (x) => ({ ...x, ready: !x.ready }), `pod ${p.name}: readinessProbe ${p.ready ? 'FALHOU → removido dos endpoints' : 'OK → adicionado aos endpoints'}`)}
                    >
                      {p.ready ? 'Quebrar readiness' : 'Consertar readiness'}
                    </button>
                    <button
                      className="btn-ghost justify-center px-2 py-1 text-[10px]"
                      onClick={() => update(p.name, (x) => ({ ...x, labelApp: x.labelApp === 'web' ? 'debug' : 'web' }), `$ kubectl label pod ${p.name} app=${p.labelApp === 'web' ? 'debug' : 'web'} --overwrite`)}
                    >
                      {p.labelApp === 'web' ? 'Trocar label p/ app=debug' : 'Voltar label p/ app=web'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <EventLog entries={s.log} title="Tráfego" height="h-80" />
      </div>
    </SimFrame>
  );
}
