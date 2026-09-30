import { describe, expect, it } from 'vitest';
import { hardeningModule } from '../content/hardeningModule';
import { hardeningCaseMeta } from '../content/hardeningCases';
import { modules } from '../content/modules';
import { simulators } from '../components/simulators/registry';
import { attackPath, CHAIN, type Defense } from '../components/simulators/HdAttackPathSim';
import { auditControlPlane, score, type CPConfig } from '../components/simulators/HdCisAuditSim';
import { analyzeRules, type RulePerm } from '../components/simulators/HdRbacRiskSim';
import { tokenExposure } from '../components/simulators/HdTokenSim';
import { admission, evaluatePSS, type PodSec } from '../components/simulators/HdPssSim';
import { GOALS, reach, type NpToggle } from '../components/simulators/HdNetpolMatrixSim';
import { secretExposure } from '../components/simulators/HdSecretsSim';
import { admit, IMAGES } from '../components/simulators/HdAdmissionSim';
import { runtimeOutcome, type Control } from '../components/simulators/HdRuntimeSim';
import { auditLevel, POLICIES, REQUESTS } from '../components/simulators/HdAuditPolicySim';

describe('módulo de hardening', () => {
  it('é o último módulo da trilha', () => {
    expect(modules[modules.length - 1].id).toBe('hardening');
    expect(modules[modules.length - 1].title).toBe('Hardening em Kubernetes');
  });
  it('10 lições com 10 perguntas e um simulador diferente cada', () => {
    const { lessons } = hardeningModule;
    expect(lessons).toHaveLength(10);
    lessons.forEach((l) => {
      expect(l.quiz).toHaveLength(10);
      expect(l.content.length, l.slug).toBeGreaterThan(3000);
      expect(simulators.some((s) => s.id === l.simulator)).toBe(true);
    });
    expect(new Set(lessons.map((l) => l.simulator)).size).toBe(10);
  });
  it('12 casos com simulador existente', () => {
    expect(hardeningCaseMeta).toHaveLength(12);
    hardeningCaseMeta.forEach((c) => expect(simulators.some((s) => s.id === c.simulator)).toBe(true));
  });
});

describe('cadeia de ataque', () => {
  it('sem defesas: comprometimento total; cada defesa para na sua etapa', () => {
    expect(attackPath(new Set()).blockedAt).toBeNull();
    CHAIN.forEach((s, i) => expect(attackPath(new Set([s.blockedBy])).blockedAt).toBe(i));
  });
  it('defesa em profundidade: sem a 1ª defesa, a próxima segura', () => {
    const r = attackPath(new Set<Defense>(['noAutomount', 'rbac']));
    expect(r.blockedAt).toBe(2);
    expect(r.steps[3].status).toBe('notReached');
  });
  it('detecção registra a primeira etapa alertada', () => {
    expect(attackPath(new Set<Defense>(['falco'])).detectedAt).toBe(1);
  });
});

describe('auditoria CIS', () => {
  const ok: CPConfig = { anonymousAuth: false, authzMode: 'Node,RBAC', profiling: false, auditLog: true, encryptionAtRest: true, nodeRestriction: true, kubeletAnonymous: false, kubeletAuthz: 'Webhook', kubeletReadOnlyPort: false, etcdClientCertAuth: true, apiPublic: false };
  it('configuração endurecida passa em tudo', () => {
    expect(auditControlPlane(ok).every((f) => f.pass)).toBe(true);
    expect(score(auditControlPlane(ok))).toBe(100);
  });
  it('kubelet anônimo é falha crítica', () => {
    const f = auditControlPlane({ ...ok, kubeletAnonymous: true }).find((x) => !x.pass)!;
    expect(f.severity).toBe('Crítica');
    expect(score(auditControlPlane({ ...ok, kubeletAnonymous: true }))).toBeLessThan(100);
  });
});

describe('risco RBAC', () => {
  it('leitura é baixo; escalate/bind e impersonate são cluster-admin', () => {
    expect(analyzeRules(new Set<RulePerm>(['read-pods'])).effective).toBe('baixo');
    expect(analyzeRules(new Set<RulePerm>(['read-pods', 'create-pods'])).effective).toBe('alto');
    expect(analyzeRules(new Set<RulePerm>(['escalate-bind'])).effective).toBe('cluster-admin');
    expect(analyzeRules(new Set<RulePerm>(['impersonate'])).effective).toBe('cluster-admin');
  });
});

describe('tokens', () => {
  it('legado com cluster-admin é crítico; projetado sem automount é baixo', () => {
    expect(tokenExposure({ kind: 'legacy', automount: true, expirationSeconds: 3600, audience: 'api', rbac: 'cluster-admin' }).risk).toBe('crítico');
    expect(tokenExposure({ kind: 'projected', automount: false, expirationSeconds: 3600, audience: 'api', rbac: 'cluster-admin' }).mounted).toBe(false);
  });
  it('audiência diferente não vale na API', () => {
    expect(tokenExposure({ kind: 'projected', automount: true, expirationSeconds: 600, audience: 'vault', rbac: 'cluster-admin' }).apiUsable).toBe(false);
  });
});

describe('Pod Security', () => {
  const base: PodSec = { privileged: false, hostNetwork: false, hostPID: false, hostPath: false, capSysAdmin: false, hostPort: false, runAsNonRoot: false, runAsUser0: false, allowPrivilegeEscalationFalse: false, dropAll: false, seccompRuntimeDefault: false };
  const hardened: PodSec = { ...base, runAsNonRoot: true, allowPrivilegeEscalationFalse: true, dropAll: true, seccompRuntimeDefault: true };
  it('Pod comum passa no baseline e falha no restricted', () => {
    const r = evaluatePSS(base);
    expect(r.baseline).toEqual([]);
    expect(r.restricted).toHaveLength(4);
  });
  it('Pod endurecido passa no restricted', () => {
    expect(evaluatePSS(hardened).restricted).toEqual([]);
    expect(admission(hardened, 'restricted', 'restricted').allowed).toBe(true);
  });
  it('privileged é rejeitado no baseline com a mensagem do PSA', () => {
    const a = admission({ ...hardened, privileged: true }, 'baseline', 'restricted');
    expect(a.allowed).toBe(false);
    expect(a.error).toContain('violates PodSecurity "baseline:latest": privileged');
  });
});

describe('zero trust', () => {
  const all = new Set<NpToggle>(['denyIngress', 'denyEgress', 'allowDns', 'allowFrontToApi', 'allowApiToDb', 'allowApiInternet', 'blockMetadata']);
  it('rede aberta falha nos objetivos de bloqueio', () => {
    expect(reach(new Set(), 'db', 'internet')).toBe(true);
    expect(reach(new Set(), 'api', 'metadata')).toBe(true);
  });
  it('configuração completa cumpre todos os objetivos', () => {
    GOALS.forEach((g) => expect(reach(all, g.src, g.dst), g.label).toBe(g.want));
  });
  it('blockMetadata sem default-deny de egress não tem efeito', () => {
    expect(reach(new Set<NpToggle>(['blockMetadata']), 'api', 'metadata')).toBe(true);
  });
});

describe('Secrets', () => {
  it('KMS, RBAC restrito, arquivo e Git cifrado fecham todos os vetores', () => {
    const v = secretExposure({ encryption: 'kms', backup: 'encrypted', devsListSecrets: false, asEnv: false, appLogsEnv: false, gitPlain: false, anyoneCreatesPods: false });
    expect(v.every((x) => !x.exposed)).toBe(true);
  });
  it('backup em bucket só expõe sem criptografia em repouso', () => {
    const cfg = { backup: 'plain-bucket' as const, devsListSecrets: false, asEnv: false, appLogsEnv: false, gitPlain: false, anyoneCreatesPods: false };
    expect(secretExposure({ ...cfg, encryption: 'identity' })[1].exposed).toBe(true);
    expect(secretExposure({ ...cfg, encryption: 'kms' })[1].exposed).toBe(false);
  });
});

describe('admission de imagens', () => {
  const strict = { allowedRegistries: true, requireSignature: true, requireDigest: true, blockCritical: true, mode: 'Enforce' as const };
  it('só a imagem assinada, por digest e sem CVEs passa em Enforce', () => {
    expect(IMAGES.filter((i) => admit(i, strict).allowed).map((i) => i.ref)).toEqual([IMAGES[0].ref]);
  });
  it('Audit admite tudo, mas reporta violações', () => {
    const r = admit(IMAGES[3], { ...strict, mode: 'Audit' });
    expect(r.allowed).toBe(true);
    expect(r.violations.length).toBeGreaterThan(0);
  });
});

describe('runtime', () => {
  it('prevenir tem precedência sobre detectar', () => {
    expect(runtimeOutcome('shell', new Set<Control>(['falco'])).outcome).toBe('detected');
    expect(runtimeOutcome('shell', new Set<Control>(['falco', 'distroless'])).outcome).toBe('prevented');
    expect(runtimeOutcome('token', new Set<Control>(['falco'])).outcome).toBe('unnoticed');
    expect(runtimeOutcome('escape', new Set<Control>(['seccomp'])).outcome).toBe('prevented');
  });
});

describe('política de auditoria', () => {
  const byId = (policy: string, id: string) => auditLevel(POLICIES[policy], REQUESTS.find((r) => r.id === id)!);
  it('recomendada: secrets em Metadata, exec em RequestResponse, healthz em None', () => {
    expect(byId('Recomendada', 'get-secret').level).toBe('Metadata');
    expect(byId('Recomendada', 'exec').level).toBe('RequestResponse');
    expect(byId('Recomendada', 'healthz').level).toBe('None');
    expect(REQUESTS.every((r) => !auditLevel(POLICIES.Recomendada, r).warning)).toBe(true);
  });
  it('ordem errada: a regra genérica engole as específicas', () => {
    expect(byId('Ordem errada', 'exec')).toMatchObject({ level: 'Metadata', rule: 0 });
  });
  it('tudo RequestResponse vaza Secrets; ruído zero perde a leitura de secrets', () => {
    expect(byId('Tudo RequestResponse', 'get-secret').warning).toContain('Secret');
    expect(byId('Ruído zero', 'get-secret').warning).toContain('sem nenhum registro');
  });
});
