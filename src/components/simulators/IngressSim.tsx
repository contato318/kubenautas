import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, SimFrame } from './kit';

/**
 * Roteamento de Ingress conforme a especificação:
 * - hosts exatos têm precedência sobre curingas (*.exemplo.com casa com um único rótulo);
 * - regra sem host casa com qualquer host;
 * - entre os paths que casam, vence o mais longo; em empate, Exact vence Prefix;
 * - Prefix compara por segmentos separados por "/" (/api casa /api/v1, mas não /apis);
 * - sem regra: defaultBackend ou 404.
 */

export type PathType = 'Prefix' | 'Exact';

export interface IngressRule {
  id: number;
  host: string;
  path: string;
  pathType: PathType;
  backend: string;
}

const segments = (p: string) => p.split('/').filter(Boolean);

export function pathMatches(rulePath: string, pathType: PathType, requestPath: string) {
  if (pathType === 'Exact') return rulePath === requestPath;
  const r = segments(rulePath);
  const q = segments(requestPath);
  return r.length <= q.length && r.every((seg, i) => seg === q[i]);
}

export function hostMatches(ruleHost: string, requestHost: string): 'exact' | 'wildcard' | 'any' | null {
  if (!ruleHost) return 'any';
  if (ruleHost === requestHost) return 'exact';
  if (ruleHost.startsWith('*.')) {
    const suffix = ruleHost.slice(1); // .exemplo.com
    const label = requestHost.slice(0, requestHost.length - suffix.length);
    if (requestHost.endsWith(suffix) && label.length > 0 && !label.includes('.')) return 'wildcard';
  }
  return null;
}

export interface RouteResult {
  backend: string | null;
  rule: IngressRule | null;
  why: string;
}

export function route(rules: IngressRule[], url: string, defaultBackend: string | null): RouteResult {
  let host = '';
  let path = '/';
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    host = u.hostname;
    path = u.pathname || '/';
  } catch {
    return { backend: null, rule: null, why: 'URL inválida' };
  }

  const rank = { exact: 3, wildcard: 2, any: 1 } as const;
  const byHost = rules
    .map((r) => ({ r, h: hostMatches(r.host.trim(), host) }))
    .filter((x): x is { r: IngressRule; h: 'exact' | 'wildcard' | 'any' } => x.h !== null);
  const bestHost = Math.max(0, ...byHost.map((x) => rank[x.h]));
  const candidates = byHost
    .filter((x) => rank[x.h] === bestHost)
    .map((x) => x.r)
    .filter((r) => pathMatches(r.path, r.pathType, path))
    .sort((a, b) => b.path.length - a.path.length || (a.pathType === 'Exact' ? -1 : 1) - (b.pathType === 'Exact' ? -1 : 1));

  const winner = candidates[0];
  if (winner) {
    const hostTxt = winner.host ? `host ${winner.host}` : 'qualquer host';
    return { backend: winner.backend, rule: winner, why: `${hostTxt} + ${winner.pathType} ${winner.path} (${candidates.length} regra(s) casaram; vence o path mais longo)` };
  }
  if (defaultBackend) return { backend: defaultBackend, rule: null, why: 'nenhuma regra casou → defaultBackend' };
  return { backend: null, rule: null, why: 'nenhuma regra casou e não há defaultBackend → 404 do controller' };
}

let seq = 100;
export const DEFAULT_RULES: IngressRule[] = [
  { id: 1, host: 'loja.exemplo.com', path: '/', pathType: 'Prefix', backend: 'frontend:80' },
  { id: 2, host: 'loja.exemplo.com', path: '/api', pathType: 'Prefix', backend: 'api-v1:8080' },
  { id: 3, host: 'loja.exemplo.com', path: '/api/v2', pathType: 'Prefix', backend: 'api-v2:8080' },
  { id: 4, host: 'loja.exemplo.com', path: '/login', pathType: 'Exact', backend: 'auth:80' },
  { id: 5, host: '*.exemplo.com', path: '/', pathType: 'Prefix', backend: 'landing:80' },
];

const SAMPLE_URLS = [
  'loja.exemplo.com/',
  'loja.exemplo.com/api/v1/produtos',
  'loja.exemplo.com/api/v2/produtos',
  'loja.exemplo.com/apis',
  'loja.exemplo.com/login',
  'loja.exemplo.com/login/',
  'blog.exemplo.com/post/1',
  'a.b.exemplo.com/',
  'outro.com/',
];

export default function IngressSim() {
  const [rules, setRules] = useState<IngressRule[]>(DEFAULT_RULES);
  const [url, setUrl] = useState(SAMPLE_URLS[2]);
  const [useDefault, setUseDefault] = useState(false);
  const result = route(rules, url, useDefault ? 'default-http-backend:80' : null);

  const update = (id: number, patch: Partial<IngressRule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <SimFrame
      title="networking.k8s.io/v1 · Ingress loja"
      toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setRules(DEFAULT_RULES)}>Reset</button>}
    >
      <div className="label mb-2">Regras</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left">
              {['host', 'path', 'pathType', 'backend (service:porta)', ''].map((h) => (
                <th key={h} className="label px-2 py-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={result.rule?.id === r.id ? 'bg-signal-green/10' : ''}>
                <td className="px-1 py-1"><input className="w-full rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" placeholder="(qualquer)" value={r.host} onChange={(e) => update(r.id, { host: e.target.value })} /></td>
                <td className="px-1 py-1"><input className="w-full rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" value={r.path} onChange={(e) => update(r.id, { path: e.target.value })} /></td>
                <td className="px-1 py-1">
                  <select className="rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" value={r.pathType} onChange={(e) => update(r.id, { pathType: e.target.value as PathType })}>
                    <option>Prefix</option>
                    <option>Exact</option>
                  </select>
                </td>
                <td className="px-1 py-1"><input className="w-full rounded border border-tactical-border bg-tactical-bg px-2 py-1 font-mono text-xs" value={r.backend} onChange={(e) => update(r.id, { backend: e.target.value })} /></td>
                <td className="px-1 py-1">
                  <button className="btn-ghost px-2 py-1" aria-label="Remover regra" onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button className="btn-ghost px-2 py-1" onClick={() => setRules((rs) => [...rs, { id: ++seq, host: '', path: '/', pathType: 'Prefix', backend: 'novo:80' }])}>+ Regra</button>
        <label className="flex items-center gap-2 text-sm text-tactical-dim">
          <input type="checkbox" className="accent-[#326ce5]" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} /> defaultBackend configurado
        </label>
      </div>

      <div className="mt-5 label mb-2">Requisição</div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-md border border-tactical-border bg-tactical-bg px-3 py-2 font-mono text-sm" />
      <div className="mt-2 flex flex-wrap gap-2">
        {SAMPLE_URLS.map((u) => (
          <button key={u} className="btn-ghost px-2 py-1 normal-case" onClick={() => setUrl(u)}>{u}</button>
        ))}
      </div>

      <div className={`mt-4 rounded-md border p-4 ${result.backend ? 'border-signal-green/50 bg-signal-green/5' : 'border-signal-red/50 bg-signal-red/5'}`}>
        <div className="flex items-center gap-3">
          <Badge tone={result.backend ? 'green' : 'red'}>{result.backend ? '200 → backend' : '404'}</Badge>
          <span className="font-mono text-lg">{result.backend ?? 'Not Found'}</span>
        </div>
        <p className="mt-1 text-sm text-tactical-dim">{result.why}</p>
      </div>
    </SimFrame>
  );
}
