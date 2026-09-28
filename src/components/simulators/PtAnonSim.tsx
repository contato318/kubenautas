import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Avaliação de acesso sem credenciais: o que system:anonymous / system:unauthenticated alcançam. */

export interface AnonCfg {
  anonymousAuth: boolean;
  anonBoundView: boolean;      // binding de system:anonymous a view
  unauthBoundEdit: boolean;    // system:unauthenticated a edit (erro grave)
  discoveryOpen: boolean;      // /api e /apis legíveis
}
export interface AnonProbe {
  cmd: string;
  result: string;
  ok: boolean; // ok = do ponto de vista do atacante (acesso obtido)
}

export function anonAssess(c: AnonCfg): AnonProbe[] {
  const probes: AnonProbe[] = [];
  probes.push({ cmd: 'GET /healthz', result: '200 ok (endpoint de saúde é público por padrão)', ok: false });
  probes.push({ cmd: 'GET /version', result: c.anonymousAuth ? '200 — versão do cluster exposta' : '401 Unauthorized', ok: c.anonymousAuth });
  probes.push({ cmd: 'GET /apis (descoberta)', result: c.anonymousAuth && c.discoveryOpen ? '200 — lista de grupos de API' : '403 Forbidden', ok: c.anonymousAuth && c.discoveryOpen });
  const canView = c.anonymousAuth && c.anonBoundView;
  probes.push({ cmd: 'GET /api/v1/namespaces/loja/pods', result: canView ? '200 — Pods legíveis sem autenticação (binding a system:anonymous)' : '403 Forbidden', ok: canView });
  probes.push({ cmd: 'GET .../secrets', result: canView ? '200 — Secrets legíveis! (view inclui leitura de secrets em algumas versões/roles amplas)' : '403 Forbidden', ok: canView });
  const canEdit = c.anonymousAuth && c.unauthBoundEdit;
  probes.push({ cmd: 'POST .../pods (criar Pod)', result: canEdit ? '201 — criação sem autenticação: comprometimento trivial' : '403 Forbidden', ok: canEdit });
  return probes;
}

export default function PtAnonSim() {
  const [c, setC] = useState<AnonCfg>({ anonymousAuth: true, anonBoundView: false, unauthBoundEdit: false, discoveryOpen: true });
  const set = (p: Partial<AnonCfg>) => setC((x) => ({ ...x, ...p }));
  const probes = anonAssess(c);
  const gained = probes.filter((p) => p.ok).length;

  return (
    <SimFrame title="acesso anônimo · o que se alcança sem credencial" toolbar={<Badge tone={gained > 2 ? 'red' : gained ? 'amber' : 'green'}>{`${gained} acessos sem auth`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Toggle checked={c.anonymousAuth} onChange={(v) => set({ anonymousAuth: v })}><span className="text-xs">--anonymous-auth=true</span></Toggle>
          <Toggle checked={c.discoveryOpen} onChange={(v) => set({ discoveryOpen: v })}><span className="text-xs">Descoberta de API aberta a anônimos</span></Toggle>
          <Toggle checked={c.anonBoundView} onChange={(v) => set({ anonBoundView: v })}><span className="text-xs">Binding de system:anonymous a um papel de leitura</span></Toggle>
          <Toggle checked={c.unauthBoundEdit} onChange={(v) => set({ unauthBoundEdit: v })}><span className="text-xs">Binding de system:unauthenticated a edit</span></Toggle>
          <p className="text-xs text-tactical-label">Bindings a grupos anônimos costumam entrar por acidente (tutoriais, "curl-to-apply", exemplos de chart). Procure-os com <code>kubectl get clusterrolebindings -o wide</code>.</p>
        </div>
        <ul className="min-w-0 space-y-1">
          {probes.map((p) => (
            <li key={p.cmd} className="rounded border border-tactical-border p-2 font-mono text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-tactical-text">$ {p.cmd}</span><Badge tone={p.ok ? 'red' : 'green'}>{p.ok ? 'acesso' : 'negado'}</Badge></div>
              <div className={`mt-1 ${p.ok ? 'text-signal-red' : 'text-tactical-dim'}`}>{p.result}</div>
            </li>
          ))}
        </ul>
      </div>
    </SimFrame>
  );
}
