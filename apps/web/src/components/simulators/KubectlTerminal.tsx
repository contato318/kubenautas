import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { ClusterState, completions, execute, initialCluster, podStatus, reconcile } from './cluster';
import { useInterval } from './kit';

interface Line {
  kind: 'in' | 'out' | 'err';
  text: string;
}

interface Mission {
  title: string;
  hint: string;
  check: (s: ClusterState) => boolean;
}

const ran = (s: ClusterState, re: RegExp) => s.history.some((h) => re.test(h));
const web = (s: ClusterState) => s.deployments.find((d) => d.name === 'web' && d.namespace === 'default');

const missions: Mission[] = [
  { title: 'Liste os nós do cluster', hint: 'kubectl get nodes', check: (s) => ran(s, /^(kubectl|k) get (nodes|node|no)\b/) },
  { title: 'Crie o Deployment web (nginx:1.27, 3 réplicas)', hint: 'kubectl create deployment web --image=nginx:1.27 --replicas=3', check: (s) => !!web(s) && web(s)!.revisions[0].image === 'nginx:1.27' && ran(s, /create (deployment|deploy) web/) && (web(s)!.replicas >= 3) },
  { title: 'Veja em quais nós os Pods caíram', hint: 'kubectl get pods -o wide', check: (s) => ran(s, /get (pods|pod|po)\b.*(-o ?wide)/) },
  { title: 'Exponha o web na porta 80', hint: 'kubectl expose deployment web --port=80', check: (s) => s.services.some((x) => x.name === 'web' && x.port === 80) },
  { title: 'Escale o web para 5 réplicas', hint: 'kubectl scale deployment web --replicas=5', check: (s) => ran(s, /scale/) && (web(s)?.replicas ?? 0) === 5 },
  { title: 'Delete um Pod do web e veja-o ser recriado', hint: 'kubectl delete pod <nome-de-um-pod-web>  (use Tab para completar)', check: (s) => ran(s, /delete (pod|pods|po) web-/) },
  { title: 'Atualize a imagem para nginx:1.28', hint: 'kubectl set image deployment/web nginx=nginx:1.28 e depois kubectl rollout status deployment/web', check: (s) => web(s)?.revisions.at(-1)?.image === 'nginx:1.28' },
];

const banner: Line[] = [
  { kind: 'out', text: 'Kubenautas cluster simulado · Kubernetes v1.34 · 1 control-plane + 3 workers' },
  { kind: 'out', text: 'Digite "help" para ver os comandos. Tab completa, ↑/↓ navegam no histórico.' },
];

export default function KubectlTerminal() {
  const [cluster, setCluster] = useState<ClusterState>(initialCluster);
  const [lines, setLines] = useState<Line[]>(banner);
  const [input, setInput] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep time moving so ContainerCreating → Running is visible on re-runs.
  useInterval(() => setCluster((c) => ({ ...c, now: Date.now() })), 1000);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  const run = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      setLines((l) => [...l, { kind: 'in', text: '' }]);
      return;
    }
    setHist((h) => [...h, trimmed]);
    setHIdx(-1);
    if (trimmed === 'clear') {
      setLines([]);
      return;
    }
    const res = execute(trimmed, cluster);
    setCluster(reconcile(res.state));
    setLines((l) => [...l, { kind: 'in', text: trimmed }, { kind: res.error ? 'err' : 'out', text: res.output }]);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      run(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hist.length) return;
      const i = hIdx === -1 ? hist.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(i);
      setInput(hist[i]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx === -1) return;
      const i = hIdx + 1;
      if (i >= hist.length) {
        setHIdx(-1);
        setInput('');
      } else {
        setHIdx(i);
        setInput(hist[i]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.split(' ');
      const last = parts[parts.length - 1];
      const matches = [...new Set(completions(cluster))].filter((c) => c.startsWith(last) && c !== last);
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        setInput(parts.join(' ') + (matches[0].endsWith('=') ? '' : ' '));
      } else if (matches.length > 1) {
        const common = matches.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
        if (common.length > last.length) {
          parts[parts.length - 1] = common;
          setInput(parts.join(' '));
        } else {
          setLines((l) => [...l, { kind: 'in', text: input }, { kind: 'out', text: matches.join('   ') }]);
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  const done = missions.map((m) => m.check(cluster));
  const firstOpen = done.indexOf(false);
  const running = cluster.pods.filter((p) => podStatus(p, cluster.now) === 'Running').length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="overflow-hidden rounded-lg border border-tactical-border bg-[#07070a]" onClick={() => inputRef.current?.focus()}>
        <div className="flex items-center gap-2 border-b border-tactical-border bg-tactical-raised/60 px-4 py-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-signal-red/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-signal-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-signal-green/70" />
          </span>
          <span className="label">kubenauta@cluster: ~</span>
          <span className="ml-auto font-mono text-[10px] text-tactical-label">
            {cluster.deployments.length} deploy · {cluster.pods.length} pods ({running} running) · {cluster.services.length} svc
          </span>
          <button
            className="ml-2 text-tactical-label hover:text-white"
            title="Resetar cluster"
            onClick={(e) => {
              e.stopPropagation();
              setCluster(initialCluster());
              setLines(banner);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div ref={scroller} className="h-[440px] overflow-y-auto p-4 font-mono text-[12.5px] leading-5">
          {lines.map((l, i) => (
            <pre key={i} className={`whitespace-pre-wrap break-words ${l.kind === 'err' ? 'text-signal-red' : l.kind === 'in' ? 'text-white' : 'text-tactical-dim'}`}>
              {l.kind === 'in' && <span className="text-signal-green">$ </span>}
              {l.text}
            </pre>
          ))}
          <div className="flex">
            <span className="text-signal-green">$&nbsp;</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="Terminal kubectl"
              className="flex-1 bg-transparent text-white caret-signal-green outline-none"
            />
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="label mb-3">Missões · {done.filter(Boolean).length}/{missions.length}</div>
        <ol className="space-y-3">
          {missions.map((m, i) => (
            <li key={m.title} className="flex gap-2">
              {done[i] ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal-green" /> : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${i === firstOpen ? 'text-k8s-400' : 'text-tactical-line'}`} />}
              <div>
                <div className={`text-sm ${done[i] ? 'text-tactical-label line-through' : ''}`}>{m.title}</div>
                {i === firstOpen && (
                  <button className="mt-1 text-left font-mono text-[11px] text-signal-amber hover:underline" onClick={() => { setInput(m.hint.split(' e depois')[0].split('  (')[0]); inputRef.current?.focus(); }}>
                    💡 {m.hint}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {firstOpen === -1 && <div className="mt-4 rounded-md border border-signal-green/50 bg-signal-green/10 p-3 text-sm text-signal-green">🎉 Todas as missões concluídas! Você já opera um cluster.</div>}
      </div>
    </div>
  );
}
