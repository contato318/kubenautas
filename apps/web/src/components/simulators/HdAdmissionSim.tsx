import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Políticas de admission para a cadeia de suprimentos: registries permitidos, assinatura, digest e CVEs. */

export interface ImageCandidate {
  ref: string;
  registry: string;
  signed: boolean;
  digest: boolean;
  criticalCves: number;
}
export const IMAGES: ImageCandidate[] = [
  { ref: 'registry.empresa.com/loja/api@sha256:4f1a…', registry: 'registry.empresa.com', signed: true, digest: true, criticalCves: 0 },
  { ref: 'registry.empresa.com/loja/api:latest', registry: 'registry.empresa.com', signed: false, digest: false, criticalCves: 0 },
  { ref: 'registry.empresa.com/loja/worker:2.1.0', registry: 'registry.empresa.com', signed: true, digest: false, criticalCves: 2 },
  { ref: 'docker.io/ngnix:1.27', registry: 'docker.io', signed: false, digest: false, criticalCves: 0 },
  { ref: 'ghcr.io/terceiro/ferramenta:1.0', registry: 'ghcr.io', signed: false, digest: false, criticalCves: 1 },
];
export interface Policy {
  allowedRegistries: boolean;
  requireSignature: boolean;
  requireDigest: boolean;
  blockCritical: boolean;
  mode: 'Enforce' | 'Audit';
}

export function admit(img: ImageCandidate, p: Policy): { allowed: boolean; violations: string[] } {
  const v: string[] = [];
  if (p.allowedRegistries && img.registry !== 'registry.empresa.com') v.push(`restrict-registries: a imagem "${img.ref}" não vem de registry.empresa.com`);
  if (p.requireSignature && !img.signed) v.push(`verify-images: nenhuma assinatura válida encontrada para "${img.ref}" (chave cosign da empresa)`);
  if (p.requireDigest && !img.digest) v.push('require-digest: use a imagem por digest (@sha256:…), não por tag');
  if (p.blockCritical && img.criticalCves > 0) v.push(`block-critical-cves: ${img.criticalCves} vulnerabilidade(s) crítica(s) no relatório de scan anexado`);
  return { allowed: p.mode === 'Audit' || v.length === 0, violations: v };
}

export default function HdAdmissionSim() {
  const [p, setP] = useState<Policy>({ allowedRegistries: false, requireSignature: false, requireDigest: false, blockCritical: false, mode: 'Enforce' });
  const set = (x: Partial<Policy>) => setP((s) => ({ ...s, ...x }));
  const results = IMAGES.map((i) => ({ img: i, ...admit(i, p) }));

  return (
    <SimFrame title="admission controller · políticas de imagem" toolbar={<Badge tone="blue">{`${results.filter((r) => r.allowed).length}/${IMAGES.length} admitidas`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Toggle checked={p.allowedRegistries} onChange={(x) => set({ allowedRegistries: x })}><span className="text-xs">Só registry.empresa.com</span></Toggle>
          <Toggle checked={p.requireSignature} onChange={(x) => set({ requireSignature: x })}><span className="text-xs">Exigir assinatura cosign</span></Toggle>
          <Toggle checked={p.requireDigest} onChange={(x) => set({ requireDigest: x })}><span className="text-xs">Exigir digest (proibir tags)</span></Toggle>
          <Toggle checked={p.blockCritical} onChange={(x) => set({ blockCritical: x })}><span className="text-xs">Bloquear CVEs críticas</span></Toggle>
          <Choice label="validationFailureAction" value={p.mode} onChange={(x) => set({ mode: x })} options={[{ value: 'Enforce', label: 'Enforce (bloqueia)' }, { value: 'Audit', label: 'Audit (só reporta)' }]} />
          <p className="text-xs text-tactical-label">Implante novas políticas primeiro em Audit, corrija o que aparece nos relatórios e só então mude para Enforce.</p>
        </div>
        <ul className="min-w-0 space-y-2">
          {results.map((r) => (
            <li key={r.img.ref} className="rounded-md border border-tactical-border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span className="break-all">{r.img.ref}</span>
                <Badge tone={!r.allowed ? 'red' : r.violations.length ? 'amber' : 'green'}>{!r.allowed ? 'negada' : r.violations.length ? 'admitida c/ violações' : 'admitida'}</Badge>
              </div>
              {r.violations.map((v) => <div key={v} className={`mt-1 font-mono text-[11px] ${r.allowed ? 'text-signal-amber' : 'text-signal-red'}`}>{v}</div>)}
            </li>
          ))}
        </ul>
      </div>
    </SimFrame>
  );
}
