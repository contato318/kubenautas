import { useState } from 'react';
import { Badge, Choice, SimFrame, Tone, Toggle, RangeField } from './kit';

/**
 * Gateway API (gateway.networking.k8s.io/v1) segundo a especificação:
 * - rota anexa a um listener se o namespace é permitido (allowedRoutes) e algum hostname intersecta;
 * - curinga de hostname é sufixo: *.loja.com casa a.loja.com e a.b.loja.com, mas não loja.com;
 * - listener mais específico vence (hostname exato > curinga);
 * - precedência entre regras: Exact > PathPrefix, prefixo mais longo, método, nº de headers, rota mais antiga;
 * - backendRef inválido (inexistente ou entre namespaces sem ReferenceGrant) → ResolvedRefs=False e HTTP 500.
 */

export type AllowedFrom = 'Same' | 'All' | 'Selector';

export interface Listener {
  name: string;
  port: number;
  protocol: 'HTTP' | 'HTTPS';
  hostname?: string;
  allowedFrom: AllowedFrom;
}

export interface BackendRef {
  name: string;
  namespace?: string;
  port: number;
  weight: number;
}

export interface Match {
  pathType: 'PathPrefix' | 'Exact';
  path: string;
  headers?: Record<string, string>;
  method?: string;
}

export type Filter =
  | { type: 'RequestRedirect'; scheme?: 'https'; replacePrefix?: string; statusCode: 301 | 302 }
  | { type: 'RequestHeaderModifier'; set: Record<string, string> };

export interface Rule {
  matches: Match[];
  backendRefs: BackendRef[];
  filters?: Filter[];
}

export interface Route {
  name: string;
  namespace: string;
  sectionName?: string;
  hostnames: string[];
  rules: Rule[];
  /** ordem de criação (a mais antiga vence empates) */
  created: number;
}

export interface GatewayConfig {
  namespace: string;
  listeners: Listener[];
  namespaceLabels: Record<string, Record<string, string>>;
  selector: Record<string, string>;
  services: string[];
  referenceGrant: boolean;
  routes: Route[];
}

export interface Condition {
  type: 'Accepted' | 'ResolvedRefs';
  status: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Regras da especificação
// ---------------------------------------------------------------------------

/** pattern pode ser curinga (*.x) — casa como sufixo. */
export function hostMatches(pattern: string | undefined, host: string): boolean {
  if (!pattern) return true;
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1)) && host.length > pattern.length - 1;
  return pattern === host;
}

export function hostnamesIntersect(listenerHost: string | undefined, routeHosts: string[]) {
  if (!listenerHost || routeHosts.length === 0) return true;
  return routeHosts.some((h) => hostMatches(listenerHost, h) || hostMatches(h, listenerHost));
}

export function namespaceAllowed(cfg: GatewayConfig, listener: Listener, ns: string) {
  if (listener.allowedFrom === 'All') return true;
  if (listener.allowedFrom === 'Same') return ns === cfg.namespace;
  const labels = cfg.namespaceLabels[ns] ?? {};
  return Object.entries(cfg.selector).every(([k, v]) => labels[k] === v);
}

const targetListeners = (cfg: GatewayConfig, r: Route) => cfg.listeners.filter((l) => !r.sectionName || l.name === r.sectionName);

export function attachedListeners(cfg: GatewayConfig, r: Route): Listener[] {
  return targetListeners(cfg, r).filter((l) => namespaceAllowed(cfg, l, r.namespace) && hostnamesIntersect(l.hostname, r.hostnames));
}

export function backendProblem(cfg: GatewayConfig, r: Route, b: BackendRef): string | null {
  const ns = b.namespace ?? r.namespace;
  if (!cfg.services.includes(`${ns}/${b.name}`)) return 'BackendNotFound';
  if (ns !== r.namespace && !cfg.referenceGrant) return 'RefNotPermitted';
  return null;
}

export function routeConditions(cfg: GatewayConfig, r: Route): Condition[] {
  const targets = targetListeners(cfg, r);
  let accepted: Condition;
  if (targets.length === 0) accepted = { type: 'Accepted', status: false, reason: 'NoMatchingParent' };
  else if (!targets.some((l) => namespaceAllowed(cfg, l, r.namespace))) accepted = { type: 'Accepted', status: false, reason: 'NotAllowedByListeners' };
  else if (attachedListeners(cfg, r).length === 0) accepted = { type: 'Accepted', status: false, reason: 'NoMatchingListenerHostname' };
  else accepted = { type: 'Accepted', status: true, reason: 'Accepted' };

  const problems = r.rules.flatMap((rule) => rule.backendRefs.map((b) => backendProblem(cfg, r, b))).filter(Boolean) as string[];
  const resolved: Condition = problems.length ? { type: 'ResolvedRefs', status: false, reason: problems[0] } : { type: 'ResolvedRefs', status: true, reason: 'ResolvedRefs' };
  return [accepted, resolved];
}

export interface Request {
  port: number;
  host: string;
  path: string;
  method: string;
  search?: string;
  scheme?: 'http' | 'https';
  headers: Record<string, string>;
}

export interface Split {
  backend: string;
  percent: number;
  ok: boolean;
  reason?: string;
}

export interface RouteResult {
  status: number;
  listener?: Listener;
  route?: Route;
  ruleIndex?: number;
  location?: string;
  split?: Split[];
  explanation: string;
}

function pathMatches(m: Match, path: string) {
  if (m.pathType === 'Exact') return m.path === path;
  const seg = (p: string) => p.replace(/\/+$/, '').split('/');
  const a = seg(m.path);
  const b = seg(path);
  return a.length <= b.length && a.every((s, i) => s === b[i]);
}

function matchApplies(m: Match, req: Request) {
  return (
    pathMatches(m, req.path) &&
    (!m.method || m.method === req.method) &&
    Object.entries(m.headers ?? {}).every(([k, v]) => req.headers[k.toLowerCase()] === v)
  );
}

const hostSpecificity = (pattern: string | undefined, host: string) => (!pattern ? 0 : pattern === host ? 10000 : hostMatches(pattern, host) ? pattern.length : -1);

export function routeRequest(cfg: GatewayConfig, req: Request): RouteResult {
  // 1. Listener: mesma porta, hostname mais específico
  const listener = cfg.listeners
    .filter((l) => l.port === req.port && hostSpecificity(l.hostname, req.host) >= 0)
    .sort((a, b) => hostSpecificity(b.hostname, req.host) - hostSpecificity(a.hostname, req.host))[0];
  if (!listener) return { status: 0, explanation: `Nenhum listener na porta ${req.port} aceita o hostname ${req.host}.` };

  // 2. Rotas anexadas a esse listener e que atendem o hostname
  const routes = cfg.routes.filter(
    (r) => attachedListeners(cfg, r).some((l) => l.name === listener.name) && (r.hostnames.length === 0 || r.hostnames.some((h) => hostMatches(h, req.host))),
  );
  const bestHost = Math.max(-1, ...routes.map((r) => Math.max(0, ...r.hostnames.map((h) => hostSpecificity(h, req.host)))));
  const hostRoutes = routes.filter((r) => Math.max(0, ...r.hostnames.map((h) => hostSpecificity(h, req.host))) === bestHost);

  // 3. Candidatos (regra sem matches = PathPrefix /)
  const candidates = hostRoutes.flatMap((r) =>
    r.rules.flatMap((rule, ruleIndex) => {
      const matches = rule.matches.length ? rule.matches : [{ pathType: 'PathPrefix', path: '/' } as Match];
      return matches.filter((m) => matchApplies(m, req)).map((m) => ({ r, rule, ruleIndex, m }));
    }),
  );
  candidates.sort(
    (a, b) =>
      (a.m.pathType === 'Exact' ? 0 : 1) - (b.m.pathType === 'Exact' ? 0 : 1) ||
      b.m.path.length - a.m.path.length ||
      (b.m.method ? 1 : 0) - (a.m.method ? 1 : 0) ||
      Object.keys(b.m.headers ?? {}).length - Object.keys(a.m.headers ?? {}).length ||
      a.r.created - b.r.created ||
      `${a.r.namespace}/${a.r.name}`.localeCompare(`${b.r.namespace}/${b.r.name}`),
  );
  const win = candidates[0];
  if (!win) return { status: 404, listener, explanation: `Listener ${listener.name} aceitou, mas nenhuma regra de rota casou com ${req.path}.` };

  const where = `${win.r.namespace}/${win.r.name} · regra ${win.ruleIndex + 1} (${win.m.pathType} ${win.m.path}${win.m.headers ? ` + headers ${Object.keys(win.m.headers).join(',')}` : ''})`;
  const redirect = win.rule.filters?.find((f): f is Extract<Filter, { type: 'RequestRedirect' }> => f.type === 'RequestRedirect');
  if (redirect) {
    const path = redirect.replacePrefix !== undefined && win.m.pathType === 'PathPrefix' ? (redirect.replacePrefix.replace(/\/$/, '') + req.path.slice(win.m.path.replace(/\/$/, '').length) || '/') : req.path;
    const scheme = redirect.scheme ?? req.scheme ?? (req.port === 443 ? 'https' : 'http');
    const port = redirect.scheme ? 443 : req.port;
    const authority = req.host + (port === (scheme === 'https' ? 443 : 80) ? '' : `:${port}`);
    return { status: redirect.statusCode, listener, route: win.r, ruleIndex: win.ruleIndex, location: `${scheme}://${authority}${path}${req.search ?? ''}`, explanation: `${where} → filtro RequestRedirect` };
  }

  const total = win.rule.backendRefs.reduce((a, b) => a + b.weight, 0);
  if (total === 0) return { status: 500, listener, route: win.r, ruleIndex: win.ruleIndex, explanation: `${where}: todos os backends com peso 0` };
  const split = win.rule.backendRefs
    .filter((b) => b.weight > 0)
    .map((b) => {
      const problem = backendProblem(cfg, win.r, b);
      return { backend: `${b.namespace ?? win.r.namespace}/${b.name}:${b.port}`, percent: Math.round((b.weight / total) * 100), ok: !problem, reason: problem ?? undefined };
    });
  const allBad = split.every((s) => !s.ok);
  return { status: allBad ? 500 : 200, listener, route: win.r, ruleIndex: win.ruleIndex, split, explanation: where };
}

// ---------------------------------------------------------------------------
// Cenário
// ---------------------------------------------------------------------------

export function buildConfig(opts: { allowedFrom: AllowedFrom; referenceGrant: boolean; canary: number }): GatewayConfig {
  return {
    namespace: 'infra',
    listeners: [
      // Listener HTTP só serve o redirecionamento da própria plataforma
      { name: 'web', port: 80, protocol: 'HTTP', hostname: '*.loja.com', allowedFrom: 'Same' },
      { name: 'https', port: 443, protocol: 'HTTPS', hostname: '*.loja.com', allowedFrom: opts.allowedFrom },
      { name: 'admin', port: 443, protocol: 'HTTPS', hostname: 'admin.loja.com', allowedFrom: 'Same' },
    ],
    namespaceLabels: { infra: {}, loja: { 'gateway-access': 'true' }, pagamentos: {} },
    selector: { 'gateway-access': 'true' },
    services: ['loja/vitrine', 'loja/api-v1', 'loja/api-v2', 'pagamentos-core/checkout', 'infra/grafana', 'loja/legado'],
    referenceGrant: opts.referenceGrant,
    routes: [
      { name: 'http-para-https', namespace: 'infra', sectionName: 'web', hostnames: [], created: 1, rules: [{ matches: [], backendRefs: [], filters: [{ type: 'RequestRedirect', scheme: 'https', statusCode: 301 }] }] },
      {
        name: 'vitrine', namespace: 'loja', sectionName: 'https', hostnames: ['www.loja.com'], created: 2,
        rules: [
          { matches: [{ pathType: 'PathPrefix', path: '/promo' }], backendRefs: [], filters: [{ type: 'RequestRedirect', replacePrefix: '/ofertas', statusCode: 301 }] },
          { matches: [{ pathType: 'PathPrefix', path: '/' }], backendRefs: [{ name: 'vitrine', port: 80, weight: 1 }] },
        ],
      },
      {
        name: 'api', namespace: 'loja', sectionName: 'https', hostnames: ['api.loja.com'], created: 3,
        rules: [
          { matches: [{ pathType: 'PathPrefix', path: '/v2', headers: { 'x-canary': 'true' } }], backendRefs: [{ name: 'api-v2', port: 8080, weight: 1 }] },
          { matches: [{ pathType: 'PathPrefix', path: '/' }], backendRefs: [{ name: 'api-v1', port: 8080, weight: 100 - opts.canary }, { name: 'api-v2', port: 8080, weight: opts.canary }] },
        ],
      },
      { name: 'checkout', namespace: 'pagamentos', sectionName: 'https', hostnames: ['pay.loja.com'], created: 4, rules: [{ matches: [], backendRefs: [{ name: 'checkout', namespace: 'pagamentos-core', port: 80, weight: 1 }] }] },
      { name: 'legado', namespace: 'loja', sectionName: 'https', hostnames: ['api.pagamentos.com'], created: 5, rules: [{ matches: [], backendRefs: [{ name: 'legado', port: 80, weight: 1 }] }] },
      { name: 'grafana', namespace: 'infra', sectionName: 'admin', hostnames: ['admin.loja.com'], created: 6, rules: [{ matches: [], backendRefs: [{ name: 'grafana', port: 3000, weight: 1 }] }] },
    ],
  };
}

const PRESETS: { label: string; url: string; canary?: boolean }[] = [
  { label: 'HTTP www', url: 'http://www.loja.com/' },
  { label: 'promo', url: 'https://www.loja.com/promo/natal' },
  { label: 'vitrine', url: 'https://www.loja.com/produtos' },
  { label: 'api canary header', url: 'https://api.loja.com/v2/pedidos', canary: true },
  { label: 'api (split)', url: 'https://api.loja.com/pedidos' },
  { label: 'checkout', url: 'https://pay.loja.com/' },
  { label: 'admin', url: 'https://admin.loja.com/' },
  { label: 'a.b.loja.com', url: 'https://a.b.loja.com/' },
  { label: 'outro domínio', url: 'https://api.pagamentos.com/' },
];

export function parseUrl(url: string): Pick<Request, 'port' | 'host' | 'path' | 'search' | 'scheme'> | null {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return { scheme: u.protocol === 'http:' ? 'http' : 'https', search: u.search, port: u.port ? Number(u.port) : u.protocol === 'http:' ? 80 : 443, host: u.hostname, path: u.pathname || '/' };
  } catch {
    return null;
  }
}

const statusTone = (s: number): Tone => (s === 0 || s >= 500 ? 'red' : s >= 400 ? 'amber' : s >= 300 ? 'cyan' : 'green');

export default function GatewayApiSim() {
  const [allowedFrom, setAllowedFrom] = useState<AllowedFrom>('Selector');
  const [referenceGrant, setReferenceGrant] = useState(false);
  const [canary, setCanary] = useState(10);
  const [url, setUrl] = useState(PRESETS[4].url);
  const [xCanary, setXCanary] = useState(false);
  const [method, setMethod] = useState('GET');

  const cfg = buildConfig({ allowedFrom, referenceGrant, canary });
  const parsed = parseUrl(url);
  const result = parsed ? routeRequest(cfg, { ...parsed, method, headers: xCanary ? { 'x-canary': 'true' } : {} }) : null;

  return (
    <SimFrame title="gateway.networking.k8s.io/v1 · Gateway infra/publico">
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-md border border-tactical-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-tactical-dim">
            <div className="text-signal-cyan">Gateway publico (ns infra) · listeners:</div>
            {cfg.listeners.map((l) => (
              <div key={l.name}>
                · {l.name}: {l.protocol}/{l.port} host {l.hostname ?? '*'} · allowedRoutes {l.allowedFrom}
              </div>
            ))}
            <div className="mt-1 text-tactical-label">namespaces: loja (gateway-access=true), pagamentos, infra</div>
          </div>
          <Choice
            label="allowedRoutes.namespaces.from (listener https)"
            value={allowedFrom}
            onChange={setAllowedFrom}
            options={[
              { value: 'Same', label: 'Same — só o namespace infra' },
              { value: 'Selector', label: 'Selector — gateway-access=true' },
              { value: 'All', label: 'All — qualquer namespace' },
            ]}
          />
          <Toggle checked={referenceGrant} onChange={setReferenceGrant}>
            <span className="font-mono text-xs text-k8s-400">ReferenceGrant em pagamentos-core</span>
            <span className="block text-xs text-tactical-dim">Permite HTTPRoutes de pagamentos referenciarem o Service checkout.</span>
          </Toggle>
          <RangeField label={`Canary api-v2: ${canary}% (api-v1: ${100 - canary}%)`} min={0} max={100} step={5} value={canary} onChange={setCanary} />

          <div>
            <div className="label mb-2">Status das HTTPRoutes</div>
            <div className="space-y-1.5">
              {cfg.routes.map((r) => {
                const [acc, res] = routeConditions(cfg, r);
                return (
                  <div key={r.name} className="rounded border border-tactical-border px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 font-mono text-xs">
                      <span>{r.namespace}/{r.name}</span>
                      <span className="text-tactical-label">{r.hostnames.join(', ') || '(todos os hosts)'}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={acc.status ? 'green' : 'red'}>Accepted {acc.status ? 'True' : `False · ${acc.reason}`}</Badge>
                      <Badge tone={res.status ? 'green' : 'red'}>ResolvedRefs {res.status ? 'True' : `False · ${res.reason}`}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="label mb-2">Requisição</div>
          <div className="flex flex-wrap gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-tactical-border bg-tactical-bg px-2 py-2 font-mono text-sm">
              {['GET', 'POST', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 rounded-md border border-tactical-border bg-tactical-bg px-3 py-2 font-mono text-sm" />
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-tactical-dim">
            <input type="checkbox" className="accent-[#326ce5]" checked={xCanary} onChange={(e) => setXCanary(e.target.checked)} /> header x-canary: true
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} className="btn-ghost px-2 py-1 normal-case" onClick={() => { setUrl(p.url); setXCanary(!!p.canary); }}>{p.label}</button>
            ))}
          </div>

          {result ? (
            <div className="mt-4 rounded-md border border-tactical-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={statusTone(result.status)}>{result.status === 0 ? 'Sem listener compatível' : `HTTP ${result.status}`}</Badge>
                {result.listener && <span className="font-mono text-xs text-tactical-label">listener {result.listener.name}</span>}
              </div>
              <p className="mt-2 text-sm text-tactical-dim">{result.explanation}</p>
              {result.location && <p className="mt-2 font-mono text-sm text-signal-cyan">Location: {result.location}</p>}
              {result.split && (
                <div className="mt-3 space-y-2">
                  <div className="label">Distribuição de tráfego</div>
                  <div className="flex h-5 overflow-hidden rounded">
                    {result.split.map((s, i) => (
                      <div key={s.backend} className={s.ok ? (i === 0 ? 'bg-k8s-500' : 'bg-signal-amber') : 'bg-signal-red'} style={{ width: `${s.percent}%` }} title={s.backend} />
                    ))}
                  </div>
                  {result.split.map((s) => (
                    <div key={s.backend} className="flex items-center gap-2 font-mono text-xs">
                      <span className={s.ok ? 'text-tactical-text' : 'text-signal-red'}>{s.percent}% → {s.backend}</span>
                      {!s.ok && <Badge tone="red">500 · {s.reason}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-signal-red">URL inválida.</p>
          )}

          <p className="mt-4 text-xs text-tactical-label">
            Experimente: mude allowedRoutes para Same e veja as rotas dos times caírem com NotAllowedByListeners; libere All e o checkout é aceito, mas
            ainda responde 500 até você criar o ReferenceGrant. A rota legado nunca anexa: api.pagamentos.com não intersecta com *.loja.com. E
            a.b.loja.com passa pelo listener (curinga é sufixo), mas nenhuma rota atende esse host.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
