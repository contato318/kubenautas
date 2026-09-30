import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Por onde um Secret do Kubernetes pode vazar, conforme criptografia, RBAC, backups e hábitos. */

export interface SecretsCfg {
  encryption: 'identity' | 'aescbc' | 'kms';
  backup: 'none' | 'plain-bucket' | 'encrypted';
  devsListSecrets: boolean;
  asEnv: boolean;
  appLogsEnv: boolean;
  gitPlain: boolean;
  anyoneCreatesPods: boolean;
}
export interface Vector {
  vector: string;
  exposed: boolean;
  detail: string;
}

export function secretExposure(c: SecretsCfg): Vector[] {
  const atRest = c.encryption === 'identity';
  return [
    { vector: 'Disco do etcd / acesso direto ao etcd', exposed: atRest, detail: atRest ? 'Sem criptografia, Secrets ficam em texto (base64 não é criptografia).' : c.encryption === 'aescbc' ? 'Criptografado, mas a chave fica num arquivo no próprio control plane: quem tem o host tem a chave.' : 'Criptografado com chave num KMS externo (envelope encryption): o disco sozinho não basta.' },
    { vector: 'Backups/snapshots do etcd', exposed: c.backup === 'plain-bucket' && atRest, detail: c.backup === 'none' ? 'Sem backups (outro problema: disponibilidade).' : c.backup === 'plain-bucket' ? (atRest ? 'Snapshot com Secrets em texto num bucket: quem lê o bucket lê todos os Secrets.' : 'Snapshot contém Secrets cifrados; a chave não está no backup.') : 'Backup cifrado e com acesso restrito.' },
    { vector: 'RBAC (get/list secrets)', exposed: c.devsListSecrets, detail: c.devsListSecrets ? 'O grupo de devs pode listar Secrets: list devolve o conteúdo completo.' : 'Só as ServiceAccounts que precisam leem Secrets específicos (resourceNames).' },
    { vector: 'Quem cria Pods no namespace', exposed: c.anyoneCreatesPods, detail: c.anyoneCreatesPods ? 'Criar um Pod que monta o Secret dá acesso a ele, mesmo sem permissão em secrets.' : 'Criação de workloads restrita ao pipeline de deploy.' },
    { vector: 'Variáveis de ambiente e logs', exposed: c.asEnv && c.appLogsEnv, detail: c.asEnv ? (c.appLogsEnv ? 'A aplicação imprime o ambiente ao iniciar: o segredo foi parar no sistema de logs.' : 'Env é visível em /proc/<pid>/environ, em crash dumps e para quem faz exec. Prefira arquivos montados.') : 'Montado como arquivo (tmpfs), com permissões restritas.' },
    { vector: 'Repositório Git', exposed: c.gitPlain, detail: c.gitPlain ? 'Manifests de Secret em texto no Git: o histórico guarda para sempre.' : 'Git guarda só referências (ExternalSecret) ou dados cifrados (Sealed Secrets/SOPS).' },
  ];
}

export default function HdSecretsSim() {
  const [c, setC] = useState<SecretsCfg>({ encryption: 'identity', backup: 'plain-bucket', devsListSecrets: true, asEnv: true, appLogsEnv: false, gitPlain: true, anyoneCreatesPods: true });
  const v = secretExposure(c);
  const set = (p: Partial<SecretsCfg>) => setC((x) => ({ ...x, ...p }));
  const n = v.filter((x) => x.exposed).length;

  return (
    <SimFrame title="Secret loja/db-credentials · vetores de exposição" toolbar={<Badge tone={n ? 'red' : 'green'}>{n ? `${n} vetores abertos` : 'nenhum vetor aberto'}</Badge>}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Choice label="Provider (Secrets já regravados/criptografados)" value={c.encryption} onChange={(x) => set({ encryption: x })} options={[{ value: 'identity', label: 'identity (sem criptografia)' }, { value: 'aescbc', label: 'aescbc (chave local)' }, { value: 'kms', label: 'kms v2 (chave externa)' }]} />
          <Choice label="Backups do etcd" value={c.backup} onChange={(x) => set({ backup: x })} options={[{ value: 'none', label: 'nenhum' }, { value: 'plain-bucket', label: 'snapshot num bucket' }, { value: 'encrypted', label: 'cifrado e restrito' }]} />
          <Toggle checked={c.devsListSecrets} onChange={(x) => set({ devsListSecrets: x })}><span className="text-xs">Devs podem list secrets</span></Toggle>
          <Toggle checked={c.anyoneCreatesPods} onChange={(x) => set({ anyoneCreatesPods: x })}><span className="text-xs">Devs podem criar Pods/Deployments</span></Toggle>
          <Toggle checked={c.asEnv} onChange={(x) => set({ asEnv: x })}><span className="text-xs">Secret consumido como variável de ambiente</span></Toggle>
          <Toggle checked={c.appLogsEnv} onChange={(x) => set({ appLogsEnv: x })}><span className="text-xs">App loga o ambiente ao iniciar</span></Toggle>
          <Toggle checked={c.gitPlain} onChange={(x) => set({ gitPlain: x })}><span className="text-xs">Secret YAML commitado no Git</span></Toggle>
        </div>
        <ul className="min-w-0 space-y-2">
          {v.map((x) => (
            <li key={x.vector} className={`rounded-md border p-2 text-sm ${x.exposed ? 'border-signal-red/60 bg-signal-red/5' : 'border-tactical-border'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{x.vector}</span><Badge tone={x.exposed ? 'red' : 'green'}>{x.exposed ? 'exposto' : 'protegido'}</Badge></div>
              <div className="mt-1 text-xs text-tactical-dim">{x.detail}</div>
            </li>
          ))}
        </ul>
      </div>
    </SimFrame>
  );
}
