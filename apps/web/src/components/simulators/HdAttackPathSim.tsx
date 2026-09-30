import { useState } from 'react';
import { Badge, SimFrame, Toggle } from './kit';

/** Cadeia de ataque típica num cluster e as defesas em profundidade que a interrompem ou a detectam. */

export type Defense = 'scan' | 'distroless' | 'noAutomount' | 'rbac' | 'pss' | 'egress' | 'falco' | 'audit';
export const DEFENSES: { id: Defense; label: string; kind: 'prevent' | 'detect' }[] = [
  { id: 'scan', label: 'Vulnerabilidade de RCE deste cenário corrigida após scan', kind: 'prevent' },
  { id: 'distroless', label: 'Imagem distroless (sem shell) + readOnlyRootFilesystem', kind: 'prevent' },
  { id: 'noAutomount', label: 'automountServiceAccountToken: false', kind: 'prevent' },
  { id: 'rbac', label: 'RBAC de menor privilégio para a ServiceAccount', kind: 'prevent' },
  { id: 'pss', label: 'Pod Security "restricted" no namespace', kind: 'prevent' },
  { id: 'egress', label: 'Firewall do host bloqueia metadata + IAM de menor privilégio', kind: 'prevent' },
  { id: 'falco', label: 'Detecção em runtime (Falco)', kind: 'detect' },
  { id: 'audit', label: 'Audit log do API server com alertas', kind: 'detect' },
];

export interface Step {
  id: string;
  tactic: string;
  action: string;
  blockedBy: Defense;
  detectedBy?: Defense;
}
export const CHAIN: Step[] = [
  { id: 'rce', tactic: 'Acesso inicial', action: 'Explora uma dependência vulnerável da aplicação (RCE)', blockedBy: 'scan' },
  { id: 'shell', tactic: 'Execução', action: 'Abre um shell dentro do container e baixa ferramentas', blockedBy: 'distroless', detectedBy: 'falco' },
  { id: 'token', tactic: 'Acesso a credenciais', action: 'Lê o token em /var/run/secrets/kubernetes.io/serviceaccount/token', blockedBy: 'noAutomount' },
  { id: 'api', tactic: 'Descoberta / credenciais', action: 'Usa o token na API: lista Secrets e Pods do cluster', blockedBy: 'rbac', detectedBy: 'audit' },
  { id: 'priv', tactic: 'Escalada de privilégio', action: 'Cria um Pod privilegiado com hostPID e hostPath: /', blockedBy: 'pss', detectedBy: 'audit' },
  { id: 'cloud', tactic: 'Movimento lateral', action: 'Do nó, consulta 169.254.169.254 e rouba as credenciais de nuvem do nó', blockedBy: 'egress', detectedBy: 'falco' },
];

export type StepStatus = 'done' | 'blocked' | 'notReached';
export interface PathResult {
  steps: (Step & { status: StepStatus; detected: boolean })[];
  blockedAt: number | null;
  detectedAt: number | null;
  impact: string;
}

export function attackPath(d: Set<Defense>): PathResult {
  let blockedAt: number | null = null;
  let detectedAt: number | null = null;
  const steps = CHAIN.map((s, i) => {
    if (blockedAt !== null) return { ...s, status: 'notReached' as const, detected: false };
    const blocked = d.has(s.blockedBy);
    const detected = !!s.detectedBy && d.has(s.detectedBy);
    if (detected && detectedAt === null) detectedAt = i;
    if (blocked) blockedAt = i;
    return { ...s, status: blocked ? ('blocked' as const) : ('done' as const), detected };
  });
  const impacts = [
    'Nenhum: o atacante não entrou.',
    'Execução limitada ao processo da aplicação, sem ferramentas nem persistência.',
    'Atacante preso no container, sem credenciais do cluster.',
    'Token obtido, mas sem permissões úteis na API.',
    'Leitura de Secrets do cluster, mas sem conseguir sair do container.',
    'Controle do nó, mas sem credenciais da conta de nuvem.',
    'Comprometimento total: cluster, nó e conta de nuvem.',
  ];
  return { steps, blockedAt, detectedAt, impact: impacts[blockedAt ?? CHAIN.length] };
}

export default function HdAttackPathSim() {
  const [d, setD] = useState<Set<Defense>>(new Set(['scan']));
  const r = attackPath(d);
  const toggle = (k: Defense, v: boolean) => setD((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });

  return (
    <SimFrame title="cadeia de ataque · defesa em profundidade" toolbar={<Badge tone={r.blockedAt === null ? 'red' : r.blockedAt <= 2 ? 'green' : 'amber'}>{r.blockedAt === null ? 'comprometido' : `parado na etapa ${r.blockedAt + 1}`}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <div className="label">Controles ativos</div>
          {DEFENSES.map((x) => (
            <Toggle key={x.id} checked={d.has(x.id)} onChange={(v) => toggle(x.id, v)}>
              <span className="text-xs">{x.label} <Badge tone={x.kind === 'prevent' ? 'blue' : 'cyan'}>{x.kind === 'prevent' ? 'prevenir' : 'detectar'}</Badge></span>
            </Toggle>
          ))}
        </div>
        <div className="min-w-0">
          <ol className="space-y-2">
            {r.steps.map((s, i) => (
              <li key={s.id} className={`rounded-md border p-3 ${s.status === 'done' ? 'border-signal-red/60 bg-signal-red/5' : s.status === 'blocked' ? 'border-signal-green/60 bg-signal-green/5' : 'border-tactical-border opacity-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm"><span className="font-mono text-xs text-tactical-label">{i + 1}. {s.tactic}</span><br />{s.action}</span>
                  <span className="flex gap-1">
                    {s.detected && <Badge tone="cyan">detectado</Badge>}
                    <Badge tone={s.status === 'done' ? 'red' : s.status === 'blocked' ? 'green' : 'dim'}>{s.status === 'done' ? 'sucesso do atacante' : s.status === 'blocked' ? 'bloqueado' : 'não alcançado'}</Badge>
                  </span>
                </div>
                {s.status === 'blocked' && <div className="mt-1 text-xs text-signal-green">Barrado por: {DEFENSES.find((x) => x.id === s.blockedBy)!.label}</div>}
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-md border-l-4 border-signal-amber bg-signal-amber/10 px-4 py-2 text-sm text-tactical-dim"><strong>Impacto:</strong> {r.impact}</div>
          <p className="mt-2 text-xs text-tactical-label">
            {r.detectedAt === null ? 'Nenhuma etapa gerou alerta: você só saberia pelo prejuízo.' : `Primeiro alerta na etapa ${r.detectedAt + 1}.`} Desligue a primeira defesa e veja a próxima segurar o ataque: é a ideia de defesa em profundidade — nenhum controle sozinho é suficiente.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
