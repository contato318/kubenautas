import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** O que um token de ServiceAccount roubado permite, e por quanto tempo. */

export interface TokenCfg {
  kind: 'legacy' | 'projected';
  automount: boolean;
  expirationSeconds: number;
  audience: 'api' | 'vault';
  rbac: 'none' | 'ns-read' | 'cluster-admin';
}
export interface TokenExposure {
  mounted: boolean;
  validity: string;
  invalidatedBy: string[];
  apiUsable: boolean;
  blast: string;
  risk: 'baixo' | 'médio' | 'alto' | 'crítico';
}

export function tokenExposure(c: TokenCfg): TokenExposure {
  const mounted = c.kind === 'legacy' ? true : c.automount;
  const validity =
    c.kind === 'legacy'
      ? 'Não expira'
      : `${c.expirationSeconds / 60} min solicitados (o servidor pode limitar o TTL; o kubelet rotaciona a projeção, mas não renova uma cópia roubada)`;
  const invalidatedBy = c.kind === 'legacy' ? ['Apagar o Secret do token (ou a ServiceAccount)'] : ['Expiração', 'Remoção do Pod ao qual o token está vinculado', 'Remoção da ServiceAccount'];
  const apiUsable = mounted && (c.kind === 'legacy' || c.audience === 'api');
  const blast = !mounted
    ? 'Nada: não há token no container.'
    : !apiUsable
      ? 'O API server rejeita o token (audiência diferente); só serve para o serviço externo daquela audiência.'
      : c.rbac === 'none'
        ? 'Autentica, mas sem permissões além das de descoberta.'
        : c.rbac === 'ns-read'
          ? 'Leitura de recursos do namespace.'
          : 'Controle total do cluster.';
  let risk: TokenExposure['risk'] = !apiUsable || c.rbac === 'none' ? 'baixo' : c.rbac === 'ns-read' ? 'médio' : 'alto';
  if (c.kind === 'legacy' && apiUsable && c.rbac !== 'none') risk = c.rbac === 'cluster-admin' ? 'crítico' : 'alto';
  return { mounted, validity, invalidatedBy, apiUsable, blast, risk };
}

/** Explicit projection: disable admission automount so a Vault token cannot hide a second API token. */
export function tokenYaml(c: TokenCfg): string {
  if (c.kind === 'legacy') return `apiVersion: v1
kind: Secret
metadata:
  name: ci-token
  annotations:
    kubernetes.io/service-account.name: ci
type: kubernetes.io/service-account-token
# Cenário: Secret montado manualmente no Pod; não é o padrão atual.`;
  return `spec:
  serviceAccountName: api
  automountServiceAccountToken: false${c.automount ? `
  containers:
    - name: app
      image: nginx:1.27
      volumeMounts:
        - name: token
          mountPath: /var/run/tokens
          readOnly: true
  volumes:
    - name: token
      projected:
        sources:
          - serviceAccountToken:
              path: token${c.audience === 'vault' ? '\n              audience: vault' : ''}
              expirationSeconds: ${c.expirationSeconds}` : '\n  # Nenhum volume de token projetado neste cenário.'}`;
}

export default function HdTokenSim() {
  const [c, setC] = useState<TokenCfg>({ kind: 'legacy', automount: true, expirationSeconds: 3600, audience: 'api', rbac: 'cluster-admin' });
  const r = tokenExposure(c);
  const set = (p: Partial<TokenCfg>) => setC((x) => ({ ...x, ...p }));
  const tone = r.risk === 'crítico' || r.risk === 'alto' ? 'red' : r.risk === 'médio' ? 'amber' : 'green';

  const yaml = tokenYaml(c);

  return (
    <SimFrame title="token roubado · o que o atacante consegue" toolbar={<Badge tone={tone}>{`risco ${r.risk}`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Choice label="Tipo de token" value={c.kind} onChange={(v) => set({ kind: v })} options={[{ value: 'legacy', label: 'Secret legado (service-account-token)' }, { value: 'projected', label: 'Projetado (TokenRequest)' }]} />
          {c.kind === 'projected' && (
            <>
              <Toggle checked={c.automount} onChange={(v) => set({ automount: v })}><span className="text-xs">Token montado no Pod</span></Toggle>
              <Choice label="expirationSeconds" value={String(c.expirationSeconds)} onChange={(v) => set({ expirationSeconds: Number(v) })} options={[{ value: '600', label: '600 (10 min)' }, { value: '3600', label: '3600 (1 h)' }, { value: '86400', label: '86400 (24 h)' }]} />
              <Choice label="audience" value={c.audience} onChange={(v) => set({ audience: v })} options={[{ value: 'api', label: 'API server (padrão)' }, { value: 'vault', label: 'vault (serviço externo)' }]} />
            </>
          )}
          <Choice label="Permissões da ServiceAccount" value={c.rbac} onChange={(v) => set({ rbac: v })} options={[{ value: 'none', label: 'nenhuma' }, { value: 'ns-read', label: 'leitura no namespace' }, { value: 'cluster-admin', label: 'cluster-admin' }]} />
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <div className="rounded border border-tactical-border p-2"><span className="label">Validade</span><div>{r.validity}</div></div>
          <div className="rounded border border-tactical-border p-2"><span className="label">Deixa de valer quando</span><ul className="list-disc pl-5">{r.invalidatedBy.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="rounded border border-tactical-border p-2"><span className="label">Com o token em mãos</span><div className={tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : 'text-signal-green'}>{r.blast}</div></div>
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{yaml}</pre>
        </div>
      </div>
    </SimFrame>
  );
}
