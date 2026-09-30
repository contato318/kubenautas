import { useState } from 'react';
import { Badge, SimFrame } from './kit';

/** Desafio de comandos: qual ferramenta resolve cada situação real de investigação. */

export interface Mission {
  situation: string;
  options: string[];
  answer: number;
  why: string;
}

export const MISSIONS: Mission[] = [
  { situation: 'O container é distroless (sem shell) e você precisa inspecionar processos e a rede dele.', options: ['kubectl exec -it api -- sh', 'kubectl debug -it api --image=nicolaka/netshoot --target=api', 'kubectl attach api', 'kubectl cp api:/ ./'], answer: 1, why: 'O container efêmero compartilha o namespace de processos e de rede do alvo, com as ferramentas da imagem de debug.' },
  { situation: 'O Pod crasha em 1 segundo e você quer investigar o sistema de arquivos da imagem com calma.', options: ['kubectl logs api', 'kubectl debug api -it --copy-to=api-debug --container=api -- sh', 'kubectl rollout restart', 'kubectl describe node'], answer: 1, why: '--copy-to cria uma cópia do Pod trocando o comando do container por um shell, sem afetar o original.' },
  { situation: 'Você precisa ver os logs de sistema (kubelet, containerd) de um nó sem acesso SSH.', options: ['kubectl logs node/worker-2', 'kubectl debug node/worker-2 -it --image=ubuntu  (e depois chroot /host)', 'kubectl top node worker-2', 'kubectl get events -n kube-system'], answer: 1, why: 'kubectl debug node cria um Pod privilegiado com o sistema de arquivos do nó montado em /host.' },
  { situation: 'O container reiniciou; você quer ver o que ele imprimiu antes de morrer.', options: ['kubectl logs api', 'kubectl logs api --previous', 'kubectl describe api', 'kubectl get api -o yaml'], answer: 1, why: 'Sem --previous você vê a execução atual, que ainda não chegou ao erro.' },
  { situation: 'Quer os eventos do namespace em ordem cronológica para montar a linha do tempo do incidente.', options: ['kubectl get events --sort-by=.lastTimestamp', 'kubectl logs events', 'kubectl describe namespace', 'kubectl top events'], answer: 0, why: 'Eventos vêm fora de ordem por padrão. Lembre: eles expiram (1 hora por padrão).' },
  { situation: 'Você quer testar a API de um Service interno a partir do seu computador.', options: ['kubectl expose', 'kubectl port-forward svc/api 8080:80', 'kubectl proxy --port=80', 'kubectl run curl'], answer: 1, why: 'port-forward cria um túnel pelo API server até um Pod do Service.' },
  { situation: 'Quem apagou o Deployment de produção às 3h da manhã?', options: ['kubectl get events', 'Logs de auditoria do API server', 'kubectl logs deployment/api', 'kubectl describe replicaset'], answer: 1, why: 'Eventos não registram autoria nem sobrevivem muito tempo; a auditoria registra usuário, verbo, recurso e horário.' },
  { situation: 'Qual Pod está consumindo mais memória no nó agora?', options: ['kubectl top pods -A --sort-by=memory', 'kubectl describe node', 'kubectl get pods -o wide', 'kubectl logs -A'], answer: 0, why: 'Requer o metrics-server. describe node mostra requests/limits, não o uso real.' },
  { situation: 'Precisa de uma ferramenta de rede completa (dig, curl, tcpdump) dentro do cluster, temporariamente.', options: ['kubectl run tmp --rm -it --image=nicolaka/netshoot -- bash', 'Instalar pacotes no container da aplicação', 'kubectl proxy', 'kubectl cp'], answer: 0, why: 'Um Pod descartável com ferramentas evita alterar containers de produção.' },
  { situation: 'Quer comparar o que está rodando com o manifesto do Git antes de aplicar.', options: ['kubectl diff -f manifests/', 'kubectl get -o yaml > a.yaml', 'kubectl apply --dry-run=client', 'kubectl describe'], answer: 0, why: 'diff faz um dry-run no servidor e mostra exatamente o que mudaria — ótimo para detectar drift.' },
];

export default function TsToolsSim() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(MISSIONS.map(() => null));
  const m = MISSIONS[idx];
  const choice = picked[idx];
  const score = picked.filter((p, i) => p === MISSIONS[i].answer).length;

  return (
    <SimFrame title={`desafio de comandos · ${idx + 1}/${MISSIONS.length}`} toolbar={<span className="font-mono text-xs text-signal-green">acertos: {score}</span>}>
      <p className="text-lg font-semibold">{m.situation}</p>
      <div className="mt-4 space-y-2">
        {m.options.map((o, i) => {
          const answered = choice !== null;
          const style = !answered ? 'border-tactical-border hover:border-k8s-500' : i === m.answer ? 'border-signal-green bg-signal-green/10' : i === choice ? 'border-signal-red bg-signal-red/10' : 'border-tactical-border opacity-60';
          return (
            <button key={o} disabled={answered} onClick={() => setPicked((p) => p.map((x, j) => (j === idx ? i : x)))} className={`block w-full rounded-md border px-4 py-2 text-left font-mono text-xs ${style}`}>
              $ {o}
            </button>
          );
        })}
      </div>
      {choice !== null && (
        <div className="mt-3 rounded-md border-l-4 border-signal-cyan bg-signal-cyan/10 px-4 py-2 text-sm text-tactical-dim">
          <Badge tone={choice === m.answer ? 'green' : 'red'}>{choice === m.answer ? 'certo' : 'errado'}</Badge> {m.why}
        </div>
      )}
      <div className="mt-4 flex justify-between">
        <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Anterior</button>
        <button className="btn-primary" disabled={idx === MISSIONS.length - 1} onClick={() => setIdx(idx + 1)}>Próxima</button>
      </div>
    </SimFrame>
  );
}
