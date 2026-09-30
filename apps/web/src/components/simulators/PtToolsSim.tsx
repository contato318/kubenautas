import { useState } from 'react';
import { SimFrame } from './kit';
import { useAccount } from '../../auth/AccountProvider';
import AccountNotice from '../AccountNotice';

/** Qual ferramenta de avaliação usar em cada situação. */

export interface Mission {
  situation: string;
  options: string[];
  answer: number;
  why: string;
}
export const MISSIONS: Mission[] = [
  { situation: 'Verificar o cluster contra o CIS Benchmark (control plane e nós).', options: ['kube-hunter', 'kube-bench', 'kubectl top', 'helm lint'], answer: 1, why: 'kube-bench avalia as configurações do CIS Kubernetes Benchmark.' },
  { situation: 'Descobrir, de fora, superfícies expostas e fraquezas conhecidas do cluster.', options: ['kube-bench', 'kube-hunter', 'kustomize', 'k9s'], answer: 1, why: 'kube-hunter faz descoberta e testes de exposição (use apenas com autorização).' },
  { situation: 'Encontrar permissões RBAC arriscadas e caminhos de escalada.', options: ['rbac-tool / KubiScan', 'kubectl logs', 'trivy fs', 'cosign'], answer: 0, why: 'rbac-tool e KubiScan analisam RBAC; kubectl auth can-i --list complementa.' },
  { situation: 'Avaliar postura geral contra NSA/MITRE/CIS e gerar relatório.', options: ['kubescape', 'nginx', 'etcdctl', 'flannel'], answer: 0, why: 'kubescape roda frameworks de segurança e prioriza achados.' },
  { situation: 'Escanear uma imagem por CVEs e segredos embutidos.', options: ['trivy', 'kube-proxy', 'kubectl drain', 'helm'], answer: 0, why: 'Trivy escaneia imagens, filesystems e configs (também grype/docker scout).' },
  { situation: 'Praticar técnicas com segurança, num ambiente proposital e isolado.', options: ['produção da empresa', 'kubernetes-goat', 'o cluster de um cliente', 'qualquer cluster público'], answer: 1, why: 'kubernetes-goat é um ambiente intencionalmente vulnerável para treino autorizado.' },
  { situation: 'Verificar boas práticas de segurança nos manifests antes do deploy.', options: ['kubeaudit / Polaris / checkov', 'kubectl rollout', 'ArgoCD', 'Prometheus'], answer: 0, why: 'kubeaudit, Polaris e checkov avaliam configurações inseguras de workloads.' },
  { situation: 'Inspecionar o que uma ServiceAccount específica pode fazer.', options: ['kubectl auth can-i --list --as=…', 'kubectl top pod', 'kubectl cp', 'kubectl label'], answer: 0, why: 'Impersonação com --as revela as permissões efetivas.' },
  { situation: 'Detectar comportamento suspeito em runtime durante o teste.', options: ['Falco', 'kubectl apply', 'helm upgrade', 'kubeadm'], answer: 0, why: 'Falco/Tetragon observam syscalls e eventos do kernel.' },
  { situation: 'Registrar e priorizar os achados para o relatório final.', options: ['planilha de risco / DefectDojo', 'kubectl delete', 'crictl', 'iptables'], answer: 0, why: 'Ferramentas de gestão de vulnerabilidades organizam achados por severidade.' },
];

export default function PtToolsSim() {
  const { user, status } = useAccount();
  const canAnswer = !!user && status === 'ready';
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const m = MISSIONS[idx];
  const go = (d: number) => { setIdx((i) => Math.min(MISSIONS.length - 1, Math.max(0, i + d))); setAnswered(null); };

  return (
    <SimFrame title={`ferramentas de avaliação · ${idx + 1}/${MISSIONS.length}`} toolbar={<span className="font-mono text-xs text-signal-cyan">use sempre com autorização</span>}>
      {!canAnswer && <AccountNotice />}
      <p className="mb-3 text-sm">{m.situation}</p>
      <div className="grid gap-2">
        {m.options.map((o, i) => {
          const state = answered === null ? '' : i === m.answer ? 'border-signal-green text-signal-green' : i === answered ? 'border-signal-red text-signal-red' : 'opacity-60';
          return <button key={o} disabled={!canAnswer || answered !== null} onClick={() => { if (canAnswer) setAnswered(i); }} className={`rounded-md border border-tactical-border px-3 py-2 text-left text-sm disabled:cursor-not-allowed ${state}`}>{o}</button>;
        })}
      </div>
      {answered !== null && <div className="mt-3 rounded-md border-l-4 border-signal-cyan bg-signal-cyan/10 px-4 py-2 text-sm text-tactical-dim">{answered === m.answer ? '✔ ' : '✖ '}{m.why}</div>}
      <div className="mt-4 flex justify-between">
        <button className="btn-ghost" disabled={idx === 0} onClick={() => go(-1)}>← anterior</button>
        <button className="btn-primary" disabled={idx === MISSIONS.length - 1} onClick={() => go(1)}>próxima →</button>
      </div>
    </SimFrame>
  );
}
