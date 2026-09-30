import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Pod Security Admission: avalia um Pod contra os perfis baseline e restricted. */

export interface PodSec {
  privileged: boolean;
  hostNetwork: boolean;
  hostPID: boolean;
  hostPath: boolean;
  capSysAdmin: boolean;
  hostPort: boolean;
  runAsNonRoot: boolean;
  runAsUser0: boolean;
  allowPrivilegeEscalationFalse: boolean;
  dropAll: boolean;
  seccompRuntimeDefault: boolean;
}
export type PssLevel = 'privileged' | 'baseline' | 'restricted';

export function evaluatePSS(p: PodSec): { baseline: string[]; restricted: string[] } {
  const baseline: string[] = [];
  if (p.privileged) baseline.push('privileged (container "app" must not set securityContext.privileged=true)');
  const hostNs = [p.hostNetwork && 'hostNetwork=true', p.hostPID && 'hostPID=true'].filter(Boolean);
  if (hostNs.length) baseline.push(`host namespaces (${hostNs.join(', ')})`);
  if (p.hostPath) baseline.push('hostPath volumes (volume "host-root")');
  if (p.capSysAdmin) baseline.push('non-default capabilities (container "app" must not include "SYS_ADMIN" in securityContext.capabilities.add)');
  if (p.hostPort) baseline.push('hostPort (container "app" uses hostPort 80)');
  const restricted = [...baseline];
  if (!p.allowPrivilegeEscalationFalse) restricted.push('allowPrivilegeEscalation != false (container "app" must set securityContext.allowPrivilegeEscalation=false)');
  if (!p.dropAll) restricted.push('unrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"])');
  if (!p.runAsNonRoot) restricted.push('runAsNonRoot != true (pod or container "app" must set securityContext.runAsNonRoot=true)');
  if (p.runAsUser0) restricted.push('runAsUser=0 (pod must not set runAsUser=0)');
  if (!p.seccompRuntimeDefault) restricted.push('seccompProfile (pod or container "app" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")');
  if (p.hostPath) restricted.push('restricted volume types (volume "host-root" uses restricted volume type "hostPath")');
  return { baseline, restricted };
}

export function admission(p: PodSec, enforce: PssLevel, warn: PssLevel): { allowed: boolean; error?: string; warnings: string[] } {
  const r = evaluatePSS(p);
  const v = (l: PssLevel) => (l === 'privileged' ? [] : l === 'baseline' ? r.baseline : r.restricted);
  const warnings = v(warn).length ? [`Warning: would violate PodSecurity "${warn}:latest": ${v(warn).join(', ')}`] : [];
  const bad = v(enforce);
  if (bad.length) return { allowed: false, warnings, error: `Error from server (Forbidden): pods "app" is forbidden: violates PodSecurity "${enforce}:latest": ${bad.join(', ')}` };
  return { allowed: true, warnings };
}

const INSEGURO: PodSec = { privileged: true, hostNetwork: false, hostPID: true, hostPath: true, capSysAdmin: false, hostPort: false, runAsNonRoot: false, runAsUser0: true, allowPrivilegeEscalationFalse: false, dropAll: false, seccompRuntimeDefault: false };
const COMUM: PodSec = { privileged: false, hostNetwork: false, hostPID: false, hostPath: false, capSysAdmin: false, hostPort: false, runAsNonRoot: false, runAsUser0: false, allowPrivilegeEscalationFalse: false, dropAll: false, seccompRuntimeDefault: false };
const SEGURO: PodSec = { ...COMUM, runAsNonRoot: true, allowPrivilegeEscalationFalse: true, dropAll: true, seccompRuntimeDefault: true };

export default function HdPssSim() {
  const [p, setP] = useState<PodSec>(COMUM);
  const [enforce, setEnforce] = useState<PssLevel>('restricted');
  const [warn, setWarn] = useState<PssLevel>('restricted');
  const set = (x: Partial<PodSec>) => setP((s) => ({ ...s, ...x }));
  const r = evaluatePSS(p);
  const a = admission(p, enforce, warn);
  const T = (k: keyof PodSec, label: string) => <Toggle checked={p[k]} onChange={(v) => set({ [k]: v } as Partial<PodSec>)}><span className="font-mono text-[11px]">{label}</span></Toggle>;

  return (
    <SimFrame title="kubectl apply -f pod.yaml · Pod Security Admission" toolbar={<Badge tone={a.allowed ? 'green' : 'red'}>{a.allowed ? 'admitido' : 'rejeitado'}</Badge>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setP(INSEGURO)}>Pod de "debug" privilegiado</button>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setP(COMUM)}>Pod comum sem securityContext</button>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setP(SEGURO)}>Pod endurecido</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <Choice label="enforce" value={enforce} onChange={setEnforce} options={(['privileged', 'baseline', 'restricted'] as PssLevel[]).map((v) => ({ value: v, label: v }))} />
            <Choice label="warn" value={warn} onChange={setWarn} options={(['privileged', 'baseline', 'restricted'] as PssLevel[]).map((v) => ({ value: v, label: v }))} />
          </div>
          {T('privileged', 'privileged: true')}
          {T('hostPID', 'hostPID: true')}
          {T('hostNetwork', 'hostNetwork: true')}
          {T('hostPath', 'volume hostPath: /')}
          {T('capSysAdmin', 'capabilities.add: [SYS_ADMIN]')}
          {T('hostPort', 'hostPort: 80')}
          {T('runAsUser0', 'runAsUser: 0')}
          {T('runAsNonRoot', 'runAsNonRoot: true')}
          {T('allowPrivilegeEscalationFalse', 'allowPrivilegeEscalation: false')}
          {T('dropAll', 'capabilities.drop: [ALL]')}
          {T('seccompRuntimeDefault', 'seccompProfile: RuntimeDefault')}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span>baseline: <Badge tone={r.baseline.length ? 'red' : 'green'}>{r.baseline.length ? `${r.baseline.length} violações` : 'ok'}</Badge></span>
            <span>restricted: <Badge tone={r.restricted.length ? 'red' : 'green'}>{r.restricted.length ? `${r.restricted.length} violações` : 'ok'}</Badge></span>
          </div>
          {a.warnings.map((w) => <pre key={w} className="whitespace-pre-wrap rounded border border-signal-amber/60 bg-signal-amber/10 p-2 font-mono text-[11px] text-signal-amber">{w}</pre>)}
          {a.error ? <pre className="whitespace-pre-wrap rounded border border-signal-red/60 bg-signal-red/10 p-2 font-mono text-[11px] text-signal-red">{a.error}</pre> : <div className="font-mono text-xs text-signal-green">pod/app created</div>}
          <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-[11px] leading-5 text-tactical-dim">{`apiVersion: v1\nkind: Namespace\nmetadata:\n  name: loja\n  labels:\n    pod-security.kubernetes.io/enforce: ${enforce}\n    pod-security.kubernetes.io/enforce-version: latest\n    pod-security.kubernetes.io/warn: ${warn}\n    pod-security.kubernetes.io/audit: restricted`}</pre>
        </div>
      </div>
    </SimFrame>
  );
}
