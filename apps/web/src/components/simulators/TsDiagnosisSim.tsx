import { useState } from 'react';
import { SimFrame } from './kit';

/** Árvore de diagnóstico: do STATUS do Pod às causas prováveis e aos comandos que as confirmam. */

export interface Question {
  kind: 'q';
  text: string;
  options: { label: string; next: string }[];
}
export interface Leaf {
  kind: 'leaf';
  title: string;
  causes: string[];
  commands: string[];
}
export type NodeT = Question | Leaf;

export const TREE: Record<string, NodeT> = {
  start: {
    kind: 'q',
    text: 'O que kubectl get pods mostra na coluna STATUS (ou READY)?',
    options: [
      { label: 'Pending', next: 'pending' },
      { label: 'ContainerCreating há minutos', next: 'creating' },
      { label: 'ImagePullBackOff / ErrImagePull', next: 'image' },
      { label: 'CrashLoopBackOff / Error', next: 'crash' },
      { label: 'CreateContainerConfigError', next: 'config' },
      { label: 'Running, mas READY 0/1', next: 'notready' },
      { label: 'Running e Ready, mas a aplicação falha', next: 'running' },
      { label: 'Terminating há muito tempo', next: 'terminating' },
      { label: 'Evicted', next: 'evicted' },
    ],
  },
  pending: {
    kind: 'q',
    text: 'O kubectl describe pod mostra um evento FailedScheduling?',
    options: [
      { label: 'Sim, com "Insufficient cpu/memory"', next: 'l-insufficient' },
      { label: 'Sim, com "untolerated taint" ou "didn\'t match node affinity/selector"', next: 'l-taint' },
      { label: 'Sim, com "unbound immediate PersistentVolumeClaims" ou "volume node affinity conflict"', next: 'l-pvc' },
      { label: 'Nenhum evento', next: 'l-noevent' },
    ],
  },
  creating: {
    kind: 'q',
    text: 'O que dizem os eventos do Pod?',
    options: [
      { label: 'FailedAttachVolume / FailedMount', next: 'l-mount' },
      { label: 'FailedCreatePodSandBox (CNI)', next: 'l-cni' },
      { label: 'Pulling image… há muito tempo', next: 'l-slowpull' },
    ],
  },
  image: {
    kind: 'q',
    text: 'Qual o erro no evento Failed?',
    options: [
      { label: 'not found / manifest unknown', next: 'l-tag' },
      { label: '401 / 403 Unauthorized', next: 'l-auth' },
      { label: '429 Too Many Requests', next: 'l-ratelimit' },
      { label: 'x509 / timeout / no such host', next: 'l-registrynet' },
    ],
  },
  crash: {
    kind: 'q',
    text: 'Qual o Last State do container (kubectl describe pod)?',
    options: [
      { label: 'OOMKilled, exit code 137', next: 'l-oom' },
      { label: 'Error, exit code 1 (ou outro código da app)', next: 'l-apperror' },
      { label: 'exit code 127 ou 126', next: 'l-cmd' },
      { label: 'Completed, exit code 0 (e reinicia)', next: 'l-exit0' },
      { label: 'Killed pela liveness probe (eventos Unhealthy)', next: 'l-liveness' },
    ],
  },
  config: { kind: 'leaf', title: 'Referência de configuração inexistente', causes: ['ConfigMap ou Secret referenciado não existe no namespace', 'Chave (key) inexistente dentro do ConfigMap/Secret', 'runAsNonRoot com imagem que roda como root'], commands: ['kubectl describe pod <pod>   # mostra qual referência falhou', 'kubectl get cm,secret -n <ns>'] },
  notready: {
    kind: 'q',
    text: 'Os eventos mostram "Readiness probe failed"?',
    options: [
      { label: 'Sim', next: 'l-readiness' },
      { label: 'Não; há startupProbe configurada', next: 'l-startup' },
    ],
  },
  running: {
    kind: 'q',
    text: 'Onde está o erro?',
    options: [
      { label: 'Outros serviços não conseguem chamar este (timeout/refused)', next: 'l-network' },
      { label: 'A aplicação está lenta', next: 'l-slow' },
      { label: 'A aplicação usa configuração antiga', next: 'l-oldconfig' },
    ],
  },
  terminating: {
    kind: 'q',
    text: 'O nó do Pod está saudável?',
    options: [
      { label: 'Sim (Ready)', next: 'l-finalizer' },
      { label: 'Não (NotReady / Unknown)', next: 'l-nodelost' },
    ],
  },
  evicted: { kind: 'leaf', title: 'Despejo pelo kubelet (pressão no nó)', causes: ['MemoryPressure: Pods usando mais memória que o request', 'DiskPressure/ephemeral-storage: logs ou arquivos no disco do container', 'PIDPressure: processos demais'], commands: ['kubectl describe pod <pod>   # Message diz qual recurso', 'kubectl describe node <nó> | grep -A8 Conditions', 'kubectl get pods -A --field-selector=status.phase=Failed'] },
  'l-insufficient': { kind: 'leaf', title: 'Requests maiores que o alocável livre', causes: ['Requests superdimensionados', 'Cluster realmente cheio (sem autoscaler ou no máximo)', 'ResourceQuota/LimitRange aplicando defaults altos'], commands: ['kubectl describe nodes | grep -A6 "Allocated resources"', 'kubectl top pods -n <ns>', 'kubectl get resourcequota,limitrange -n <ns>'] },
  'l-taint': { kind: 'leaf', title: 'Restrições de posicionamento', causes: ['Taint sem toleration correspondente', 'nodeSelector/nodeAffinity sem nó compatível', 'Anti-affinity ou topologySpread impossíveis de cumprir'], commands: ['kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints', 'kubectl get nodes --show-labels', 'kubectl get pod <pod> -o yaml | grep -A10 affinity'] },
  'l-pvc': { kind: 'leaf', title: 'Volume impede o agendamento', causes: ['PVC Pending (StorageClass inexistente, provisionador fora)', 'Volume em zona diferente dos nós disponíveis'], commands: ['kubectl get pvc -n <ns>', 'kubectl describe pvc <pvc>', 'kubectl get pv <pv> -o yaml | grep -A8 nodeAffinity'] },
  'l-noevent': { kind: 'leaf', title: 'Nada tentou agendar o Pod', causes: ['kube-scheduler parado', 'schedulerName aponta para um scheduler inexistente', 'Pod com scheduling gates (spec.schedulingGates)'], commands: ['kubectl get pods -n kube-system | grep scheduler', 'kubectl get pod <pod> -o jsonpath="{.spec.schedulerName}"'] },
  'l-mount': { kind: 'leaf', title: 'Falha ao anexar ou montar o volume', causes: ['Multi-Attach: volume RWO ainda preso a outro nó', 'Driver CSI com problema', 'Secret/ConfigMap do volume inexistente'], commands: ['kubectl describe pod <pod>', 'kubectl get volumeattachment', 'kubectl logs -n kube-system -l app=<csi-driver>'] },
  'l-cni': { kind: 'leaf', title: 'Rede do Pod não pôde ser criada', causes: ['Plugin CNI com falha no nó', 'IPs esgotados no pool (IPAM)', 'Limite de ENIs/IPs por nó (nuvem)'], commands: ['kubectl describe pod <pod>', 'kubectl get pods -n kube-system -o wide | grep <nó>', 'journalctl -u kubelet | grep -i cni   # no nó'] },
  'l-slowpull': { kind: 'leaf', title: 'Download de imagem lento', causes: ['Imagem muito grande', 'Registry lento ou distante', 'Pulls em série (serializeImagePulls)'], commands: ['kubectl get events --field-selector involvedObject.name=<pod>', 'crictl images   # no nó'] },
  'l-tag': { kind: 'leaf', title: 'Imagem ou tag inexistente', causes: ['Erro de digitação na tag', 'Imagem não publicada pelo CI', 'Número interpretado errado (ex.: tag numérica em values)'], commands: ['kubectl get pod <pod> -o jsonpath="{.spec.containers[*].image}"', 'crane ls <repo>   # ou a UI do registry'] },
  'l-auth': { kind: 'leaf', title: 'Falha de autenticação no registry', causes: ['imagePullSecret ausente no namespace', 'Credencial expirada', 'ServiceAccount sem imagePullSecrets'], commands: ['kubectl get secret -n <ns>', 'kubectl get sa default -n <ns> -o yaml'] },
  'l-ratelimit': { kind: 'leaf', title: 'Limite de downloads do registry', causes: ['Docker Hub anônimo', 'Muitos nós baixando a mesma imagem'], commands: ['kubectl describe pod <pod>', 'Configure um mirror/proxy cache'] },
  'l-registrynet': { kind: 'leaf', title: 'Nó não alcança o registry', causes: ['DNS ou firewall de saída', 'CA do registry interno não confiável no nó', 'Proxy corporativo'], commands: ['kubectl debug node/<nó> -it --image=busybox -- nslookup <registry>'] },
  'l-oom': { kind: 'leaf', title: 'Memória acima do limit', causes: ['Limit baixo para a carga', 'Vazamento de memória', 'Runtime (JVM, Node) com heap fixo próximo do limit'], commands: ['kubectl describe pod <pod>', 'kubectl top pod <pod> --containers', 'container_memory_working_set_bytes no Prometheus'] },
  'l-apperror': { kind: 'leaf', title: 'A aplicação encerra com erro', causes: ['Configuração faltando ou inválida', 'Dependência (banco, fila) inacessível no startup', 'Bug na versão nova'], commands: ['kubectl logs <pod> --previous', 'kubectl get pod <pod> -o yaml | grep -A5 env'] },
  'l-cmd': { kind: 'leaf', title: 'Comando do container inválido', causes: ['127: executável não encontrado (command/args errados, imagem diferente)', '126: arquivo sem permissão de execução'], commands: ['kubectl get pod <pod> -o jsonpath="{.spec.containers[0].command}"', 'kubectl debug <pod> -it --copy-to=dbg --container=app -- sh'] },
  'l-exit0': { kind: 'leaf', title: 'O processo termina com sucesso', causes: ['Processo não fica em primeiro plano (daemoniza)', 'Tarefa única rodando como Deployment (deveria ser Job)'], commands: ['kubectl logs <pod> --previous', 'Use Job/CronJob para tarefas que terminam'] },
  'l-liveness': { kind: 'leaf', title: 'Liveness reiniciando o container', causes: ['Timeout curto demais sob carga', 'Liveness checando dependências externas', 'Sem startupProbe para apps lentas no boot'], commands: ['kubectl describe pod <pod>   # eventos Unhealthy e Killing', 'kubectl get pod <pod> -o yaml | grep -A8 livenessProbe'] },
  'l-readiness': { kind: 'leaf', title: 'Readiness falhando', causes: ['Endpoint de health errado (porta/path)', 'Dependência indisponível', 'App ainda aquecendo'], commands: ['kubectl describe pod <pod>', 'kubectl port-forward pod/<pod> 8080 && curl localhost:8080/ready'] },
  'l-startup': { kind: 'leaf', title: 'Startup probe ainda não passou', causes: ['Aplicação demorando para iniciar', 'failureThreshold × periodSeconds curto demais'], commands: ['kubectl describe pod <pod>', 'kubectl logs <pod> -f'] },
  'l-network': { kind: 'leaf', title: 'Problema de rede até o Pod', causes: ['Service sem endpoints (selector/readiness)', 'targetPort errado', 'NetworkPolicy bloqueando', 'DNS'], commands: ['kubectl get endpointslices -l kubernetes.io/service-name=<svc>', 'kubectl run tmp --rm -it --image=nicolaka/netshoot -- bash'] },
  'l-slow': { kind: 'leaf', title: 'Aplicação lenta', causes: ['CPU throttling', 'Dependência lenta', 'GC/memória perto do limit', 'DNS lento'], commands: ['kubectl top pod', 'container_cpu_cfs_throttled_periods_total', 'Traces da aplicação'] },
  'l-oldconfig': { kind: 'leaf', title: 'Config nova não chegou ao processo', causes: ['env lido só na criação do container', 'subPath não recebe atualizações de ConfigMap'], commands: ['kubectl exec <pod> -- printenv', 'kubectl rollout restart deployment/<nome>'] },
  'l-finalizer': { kind: 'leaf', title: 'Finalizer ou processo que não encerra', causes: ['metadata.finalizers pendente (controller fora do ar)', 'Container ignorando SIGTERM dentro de um grace period longo'], commands: ['kubectl get pod <pod> -o jsonpath="{.metadata.finalizers}"', 'kubectl get pod <pod> -o jsonpath="{.spec.terminationGracePeriodSeconds}"'] },
  'l-nodelost': { kind: 'leaf', title: 'Nó inacessível', causes: ['O kubelet não confirma a remoção; o Pod fica Terminating até o nó voltar ou ser removido'], commands: ['kubectl get nodes', 'kubectl delete pod <pod> --grace-period=0 --force   # só se tiver certeza que o nó está morto'] },
};

export function leaves(): string[] {
  return Object.entries(TREE).filter(([, n]) => n.kind === 'leaf').map(([id]) => id);
}

export default function TsDiagnosisSim() {
  const [path, setPath] = useState<{ id: string; choice?: string }[]>([{ id: 'start' }]);
  const cur = TREE[path[path.length - 1].id];

  return (
    <SimFrame title="árvore de diagnóstico · o que está acontecendo com o Pod?" toolbar={<button className="btn-ghost px-2 py-1" onClick={() => setPath([{ id: 'start' }])}>Recomeçar</button>}>
      <div className="mb-4 flex flex-wrap gap-1 font-mono text-[11px] text-tactical-label">
        {path.slice(1).map((p, i) => (
          <button key={i} className="rounded border border-tactical-border px-2 py-0.5 hover:text-tactical-text" onClick={() => setPath(path.slice(0, i + 1))}>
            {p.choice}
          </button>
        ))}
      </div>
      {cur.kind === 'q' ? (
        <div>
          <h3 className="mb-3 text-lg font-semibold">{cur.text}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {cur.options.map((o) => (
              <button key={o.label} className="rounded-md border border-tactical-border px-4 py-3 text-left text-sm hover:border-k8s-500 hover:bg-k8s-500/10" onClick={() => setPath([...path.slice(0, -1), { ...path[path.length - 1] }, { id: o.next, choice: o.label }])}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="label mb-1">Diagnóstico provável</div>
            <h3 className="text-lg font-semibold text-signal-amber">{cur.title}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-tactical-dim">
              {cur.causes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          <div>
            <div className="label mb-1">Comandos para confirmar</div>
            <pre className="overflow-x-auto rounded-md border border-tactical-border bg-black/60 p-3 font-mono text-xs leading-6 text-signal-green">{cur.commands.map((c) => `$ ${c}`).join('\n')}</pre>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-tactical-label">
        A ordem é sempre a mesma: observe o estado (get), leia os eventos (describe), leia os logs (logs --previous) e só então mude algo. Cada ramo mostra as causas mais
        comuns daquele sintoma.
      </p>
    </SimFrame>
  );
}
