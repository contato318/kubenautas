import { useState } from 'react';
import { Badge, Choice, MetricBox, RangeField, SimFrame } from './kit';

/**
 * Resolução de nomes como o resolver da libc faz com o resolv.conf dos Pods:
 * - nome terminado em "." é absoluto: consulta só ele;
 * - com menos pontos que ndots, tenta primeiro cada domínio de busca e por último o nome como veio;
 * - com ndots ou mais pontos, tenta primeiro o nome absoluto e depois os domínios de busca;
 * - para no primeiro sucesso. Cada tentativa gera consultas A e AAAA.
 */

export const CLUSTER_RECORDS = new Set([
  'api.loja.svc.cluster.local',
  'db.dados.svc.cluster.local',
  'kube-dns.kube-system.svc.cluster.local',
  'web-0.web.loja.svc.cluster.local',
]);
export const EXTERNAL_RECORDS = new Set(['google.com', 'api.pagamentos.com.br', 'registry.example.io']);

export const searchDomains = (namespace: string) => [`${namespace}.svc.cluster.local`, 'svc.cluster.local', 'cluster.local'];

export interface Attempt {
  name: string;
  found: boolean;
}

export function resolve(input: string, namespace: string, ndots: number): { attempts: Attempt[]; answer: string | null } {
  const name = input.trim().toLowerCase();
  if (!name) return { attempts: [], answer: null };
  const exists = (fqdn: string) => CLUSTER_RECORDS.has(fqdn) || EXTERNAL_RECORDS.has(fqdn);

  let candidates: string[];
  if (name.endsWith('.')) {
    candidates = [name.slice(0, -1)];
  } else {
    const dots = name.split('.').length - 1;
    const searched = searchDomains(namespace).map((d) => `${name}.${d}`);
    candidates = dots >= ndots ? [name, ...searched] : [...searched, name];
  }

  const attempts: Attempt[] = [];
  for (const c of candidates) {
    const found = exists(c);
    attempts.push({ name: c, found });
    if (found) return { attempts, answer: c };
  }
  return { attempts, answer: null };
}

const EXAMPLES = ['api', 'db.dados', 'web-0.web', 'google.com', 'api.pagamentos.com.br', 'api.pagamentos.com.br.', 'naoexiste'];

export default function DnsSim() {
  const [namespace, setNamespace] = useState('loja');
  const [ndots, setNdots] = useState(5);
  const [name, setName] = useState('api.pagamentos.com.br');
  const { attempts, answer } = resolve(name, namespace, ndots);
  const queries = attempts.length * 2;

  return (
    <SimFrame title="/etc/resolv.conf · CoreDNS">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Choice label="Namespace do Pod" value={namespace} onChange={setNamespace} options={['loja', 'dados', 'default'].map((n) => ({ value: n, label: n }))} />
          <RangeField label={`options ndots: ${ndots}`} min={1} max={5} value={ndots} onChange={setNdots} />
          <pre className="rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-signal-green">
            {`nameserver 10.96.0.10\nsearch ${searchDomains(namespace).join(' ')}\noptions ndots:${ndots}`}
          </pre>
          <div className="label">Serviços existentes</div>
          <ul className="font-mono text-[11px] leading-5 text-tactical-dim">
            {[...CLUSTER_RECORDS, ...EXTERNAL_RECORDS].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div>
          <label className="flex flex-col gap-1">
            <span className="label">Nome que a aplicação resolve</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-tactical-border bg-tactical-bg px-3 py-2 font-mono text-sm" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} className="btn-ghost px-2 py-1 normal-case" onClick={() => setName(e)}>{e}</button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetricBox label="Tentativas" value={attempts.length} />
            <MetricBox label="Consultas (A + AAAA)" value={queries} tone={queries > 4 ? 'text-signal-amber' : 'text-signal-green'} />
            <MetricBox label="Resultado" value={answer ? 'OK' : 'NXDOMAIN'} tone={answer ? 'text-signal-green' : 'text-signal-red'} />
          </div>

          <ol className="mt-4 space-y-1.5">
            {attempts.map((a, i) => (
              <li key={a.name} className="flex items-center gap-3 rounded border border-tactical-border px-3 py-1.5 font-mono text-xs">
                <span className="text-tactical-label">{i + 1}.</span>
                <span className="flex-1 break-all">{a.name}</span>
                <Badge tone={a.found ? 'green' : 'dim'}>{a.found ? 'resposta' : 'nxdomain'}</Badge>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs text-tactical-label">
            Com ndots:5 (padrão do Kubernetes), um nome externo como api.pagamentos.com.br (3 pontos) passa por todos os domínios de busca antes de ser
            consultado como está: 8 consultas em vez de 2. Termine o nome com ponto ou use dnsConfig com ndots menor para evitar isso.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
