import type { Module, Question } from '../types';

/** Módulo completo de Troubleshooting: 8 lições, cada uma com simulador próprio e quiz de 10 perguntas. */

const files = import.meta.glob('./troubleshooting/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const md = (slug: string) => {
  const c = files[`./troubleshooting/${slug}.md`];
  if (!c) throw new Error(`Conteúdo não encontrado: troubleshooting/${slug}`);
  return c;
};
const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const troubleshootingModule: Module = {
  id: 'troubleshooting',
  title: 'Troubleshooting em Kubernetes',
  description: 'Curso completo de investigação: método, Pods, scheduler, rede, nós, armazenamento, control plane e ferramentas.',
  level: 'Avançado',
  emoji: '🧯',
  lessons: [
    {
      slug: 'metodologia', title: 'Método de investigação', summary: 'Definir o problema, localizar a camada, o kit básico e uma hipótese por vez.', minutes: 12,
      content: md('metodologia'), simulator: 'ts-diagnosis',
      quiz: [
        q('Qual a pergunta mais valiosa no início de um incidente?', ['Quem é o culpado?', 'O que mudou (deploy, config, versão, tráfego)?', 'Qual a versão do kubectl?', 'Quantos nós existem?'], 1, 'A maioria dos incidentes começa com uma mudança.'),
        q('Qual a ordem recomendada do kit básico?', ['logs → delete → get', 'get → describe (eventos) → logs --previous → eventos do namespace → -o yaml', 'delete pod → esperar → get', 'top → drain → uncordon'], 1, 'Estado, depois porquê do ponto de vista do cluster, depois da aplicação.'),
        q('Por que salvar os eventos cedo num incidente?', ['São criptografados', 'Eventos expiram (1 hora por padrão)', 'Ocupam muito espaço', 'Só o admin vê'], 1, 'Exporte-os para um sistema de logs no dia a dia.'),
        q('Qual o risco de apagar o Pod problemático logo de cara?', ['Nenhum', 'Perder logs --previous, eventos e o estado que explicariam a causa', 'Apagar o namespace', 'Perder o Deployment'], 1, 'Estabilize, mas colete evidências antes.'),
        q('RESTARTS crescendo com STATUS Running indica…', ['Tudo normal', 'Crash intermitente ou liveness reiniciando o container', 'Nó cordonado', 'Falta de RBAC'], 1, 'Olhe Last State e eventos Unhealthy.'),
        q('Por que mudar uma coisa de cada vez?', ['É mais rápido', 'Para saber qual mudança resolveu (ou piorou) e evitar recorrência', 'Exigência do Kubernetes', 'Para economizar CPU'], 1, 'Várias mudanças juntas escondem a causa.'),
        q('Em produção, o que vem primeiro?', ['Encontrar a causa raiz', 'Restaurar o serviço (rollback, escala), preservando evidências', 'Escrever o postmortem', 'Atualizar o cluster'], 1, 'Mitigar primeiro, entender depois.'),
        q('O Pod está Running e Ready, a aplicação responde dentro dele, mas não pelo Service. Qual camada investigar?', ['Aplicação', 'Rede/Service/DNS', 'Scheduler', 'etcd'], 1, 'Descarte camadas com uma pergunta por vez.'),
        q('O que caracteriza um bom postmortem?', ['Apontar o culpado', 'Sem culpados: linha do tempo, impacto, causa raiz, fatores e ações com dono e prazo', 'Só a causa técnica', 'Nenhum registro'], 1, 'O objetivo é aprender e prevenir.'),
        q('describe pod mostra informações que logs não mostram. Quais?', ['A saída da aplicação', 'Eventos do cluster: agendamento, pull de imagem, probes, OOM, mounts', 'O código-fonte', 'As métricas de CPU'], 1, 'Muitos problemas nunca chegam a gerar log da aplicação.'),
      ],
    },
    {
      slug: 'pods-e-containers', title: 'Pods e containers: estados e exit codes', summary: 'Phase × estado do container, Last State, exit codes, CrashLoopBackOff, probes e init containers.', minutes: 14,
      content: md('pods-e-containers'), simulator: 'ts-exit-code',
      quiz: [
        q('Onde ver como terminou a execução anterior de um container em loop?', ['kubectl get pods', 'Last State no kubectl describe pod', 'kubectl top', 'Nos eventos do nó'], 1, 'Mostra Reason, Exit Code e horários.'),
        q('Exit code 127 significa…', ['OOMKilled', 'Comando não encontrado (command/args ou imagem errada)', 'SIGTERM', 'Sucesso'], 1, '126 é arquivo sem permissão de execução.'),
        q('Exit code 143 significa…', ['SIGSEGV', 'SIGTERM: encerramento pedido (delete, rollout, drain)', 'Falta de memória', 'Erro de sintaxe'], 1, '128 + 15.'),
        q('Exit code 139 indica…', ['SIGSEGV: falha de segmentação', 'SIGKILL', 'Timeout', 'Sucesso'], 0, '128 + 11: bug nativo, biblioteca incompatível.'),
        q('Um container de Deployment termina com exit code 0 e reinicia sem parar. Por quê?', ['Bug do Kubernetes', 'Processos de Deployment não devem terminar; tarefas finitas devem ser Jobs', 'Falta de CPU', 'Liveness'], 1, 'restartPolicy Always reinicia qualquer término.'),
        q('Qual o teto de espera do backoff do CrashLoopBackOff?', ['30 segundos', '5 minutos', '1 hora', 'Não há teto'], 1, '10s, 20s, 40s… até 5 minutos.'),
        q('CreateContainerConfigError geralmente significa…', ['Imagem inexistente', 'ConfigMap/Secret (ou chave) referenciado não existe', 'Falta de CPU', 'Nó cheio'], 1, 'O describe mostra qual referência falhou.'),
        q('O Pod mostra Init:CrashLoopBackOff. Como ver o erro?', ['kubectl logs <pod>', 'kubectl logs <pod> -c <init-container>', 'kubectl describe node', 'kubectl top pod'], 1, 'Init containers têm logs próprios.'),
        q('Qual probe nunca reinicia o container?', ['livenessProbe', 'readinessProbe', 'startupProbe', 'Todas reiniciam'], 1, 'Readiness só remove o Pod dos endpoints.'),
        q('Em que Phase fica um Pod cujo nó parou de reportar?', ['Failed', 'Unknown', 'Succeeded', 'Pending'], 1, 'O estado real não é conhecido pelo control plane.'),
      ],
    },
    {
      slug: 'scheduling', title: 'Pods Pending e o scheduler', summary: 'Lendo FailedScheduling, requests × uso real, taints, afinidade, volumes, quotas e autoscaling.', minutes: 13,
      content: md('scheduling'), simulator: 'ts-scheduling',
      quiz: [
        q('Como saber se um Pod Pending já foi agendado para algum nó?', ['kubectl top pod', 'Verificar spec.nodeName (vazio = não agendado)', 'kubectl logs', 'Pelo IP'], 1, 'Com nodeName, o problema está no nó (imagem, volume, rede).'),
        q('"0/6 nodes are available: 6 Insufficient cpu" com o cluster a 25% de uso real. Por quê?', ['Bug do metrics-server', 'O scheduler usa requests: a soma dos requests atingiu o alocável', 'Falta de memória', 'O Pod não tem requests'], 1, 'Reveja requests superdimensionados.'),
        q('"node(s) were unschedulable" indica…', ['Nó sem CPU', 'Nó cordonado', 'Taint de GPU', 'Nó sem rede'], 1, 'kubectl uncordon depois da manutenção.'),
        q('Pod Pending, sem nodeName e sem nenhum evento. Suspeita principal?', ['Imagem errada', 'kube-scheduler fora do ar (ou schedulerName inexistente)', 'Falta de memória', 'NetworkPolicy'], 1, 'Nada tentou agendar o Pod.'),
        q('"had volume node affinity conflict" significa…', ['O PVC não existe', 'O volume está numa zona onde não há nó disponível para o Pod', 'O volume está cheio', 'Falta de permissão'], 1, 'Use WaitForFirstConsumer e nós na zona.'),
        q('Onde aparece o erro quando uma ResourceQuota impede a criação de Pods?', ['No Pod', 'No ReplicaSet/Job (evento FailedCreate), pois o Pod nem chega a existir', 'No nó', 'No Service'], 1, 'Olhe o controller dono.'),
        q('Pods de baixa prioridade somem e voltam Pending quando entra carga crítica. O que ocorre?', ['OOM', 'Preempção por PriorityClass', 'Bug', 'Drain'], 1, 'Procure eventos Preempted.'),
        q('Anti-affinity required com 5 réplicas e 3 nós. O que acontece?', ['Todas sobem', '2 réplicas ficam Pending', 'O Deployment é rejeitado', 'O scheduler ignora a regra'], 1, 'Use preferred quando a regra puder ser relaxada.'),
        q('O Cluster Autoscaler não cria nós para Pods Pending. Onde procurar o motivo?', ['Nos logs do kubelet', 'Nos eventos NotTriggerScaleUp do Pod', 'No etcd', 'No CoreDNS'], 1, 'Dizem por que nenhum grupo de nós serviria.'),
        q('Na mensagem de FailedScheduling, cada nó aparece…', ['Uma vez por filtro testado', 'Uma vez, no primeiro filtro em que falhou (recursos podem citar cpu e memória juntos)', 'Nunca', 'Só se estiver cordonado'], 1, 'Por isso a mensagem é um mapa do que mudar.'),
      ],
    },
    {
      slug: 'rede-e-dns', title: 'Rede e DNS: salto a salto', summary: 'Sintomas por camada, DNS, Service e endpoints, NetworkPolicy, processo, kube-proxy e tcpdump.', minutes: 15,
      content: md('rede-e-dns'), simulator: 'ts-network-path',
      quiz: [
        q('O cliente recebe "Connection refused" ao chamar um Service. Suspeitas principais?', ['NetworkPolicy', 'Service sem endpoints, targetPort errado ou app escutando só em 127.0.0.1', 'DNS', 'Falta de CPU'], 1, 'Refused = alguém respondeu recusando.'),
        q('"Connection timed out" costuma indicar…', ['Service sem endpoints', 'Pacotes descartados: NetworkPolicy, firewall, rotas, kube-proxy sem regras', 'Nome errado', 'App crashando'], 1, 'Nada respondeu.'),
        q('De um Pod no namespace vendas, como resolver o Service api do namespace loja?', ['api', 'api.loja (ou api.loja.svc.cluster.local)', 'loja.api', 'Não é possível'], 1, 'O nome curto só vale no mesmo namespace.'),
        q('Como separar problema de DNS de problema do Service?', ['Reiniciar o CoreDNS', 'Testar pelo IP do Service (ClusterIP); se funcionar, o problema é DNS', 'Apagar o Service', 'kubectl top'], 1, 'Isole um salto por vez.'),
        q('Com default-deny de egress, tudo falha com "Could not resolve host". Por quê?', ['CoreDNS caiu', 'Faltou liberar egress para o DNS (porta 53 do kube-dns)', 'Bug do CNI', 'Falta de CPU'], 1, 'DNS também é tráfego de saída.'),
        q('Qual comando lista os endpoints de um Service?', ['kubectl get endpointslices -l kubernetes.io/service-name=api', 'kubectl top svc', 'kubectl logs svc/api', 'kubectl describe node'], 0, 'Vazio = selector não casa ou nenhum Pod Ready.'),
        q('Qual imagem é popular para depurar rede dentro do cluster?', ['nginx', 'nicolaka/netshoot', 'busybox apenas', 'alpine com nada'], 1, 'Traz dig, curl, tcpdump, ss, mtr.'),
        q('Mensagem "nf_conntrack: table full, dropping packet" no dmesg de um nó significa…', ['Disco cheio', 'A tabela de conexões rastreadas encheu e conexões novas são descartadas', 'CoreDNS em loop', 'Falta de IPs'], 1, 'Aumente nf_conntrack_max ou reduza conexões curtas.'),
        q('O tcpdump no Pod destino não mostra o SYN chegando. Onde está o problema?', ['Na aplicação', 'No caminho até o Pod (policy, rotas, kube-proxy/CNI)', 'No banco', 'No DNS do cliente'], 1, 'Se o SYN chega e nada volta, o problema está no destino.'),
        q('Uma NetworkPolicy funciona com qualquer CNI?', ['Sim', 'Não: o CNI precisa implementar (Calico, Cilium…)', 'Só em nuvem', 'Só com IPVS'], 1, 'Sem suporte, as policies são ignoradas silenciosamente.'),
      ],
    },
    {
      slug: 'nos-e-kubelet', title: 'Nós e kubelet', summary: 'Condições, Ready Unknown × False, linha do tempo do nó perdido, logs do kubelet, pressão e despejo.', minutes: 14,
      content: md('nos-e-kubelet'), simulator: 'ts-node',
      quiz: [
        q('Qual a diferença entre Ready=Unknown e Ready=False?', ['Nenhuma', 'Unknown: o control plane não recebe heartbeats; False: o kubelet está vivo e reporta um problema', 'False é mais grave sempre', 'Unknown só em nuvem'], 1, 'Unknown = nó sumiu; False = kubelet reclama de algo.'),
        q('Por padrão, quanto tempo os Pods toleram um nó unreachable antes do despejo?', ['10 segundos', '300 segundos', '1 hora', 'Para sempre'], 1, 'tolerationSeconds padrão de not-ready/unreachable.'),
        q('Por que o Pod db-0 de um StatefulSet fica Terminating quando seu nó some?', ['Bug', 'O Kubernetes não cria outro db-0 até confirmar que o antigo parou, para evitar duas instâncias', 'Falta de PVC', 'O scheduler travou'], 1, 'Identidade única exige confirmação.'),
        q('"PLEG is not healthy" no kubelet aponta para…', ['Rede do Pod', 'Container runtime travado ou sobrecarregado', 'Disco cheio', 'Certificado expirado'], 1, 'O kubelet não consegue listar containers.'),
        q('Como acessar os logs do kubelet sem SSH?', ['kubectl logs kubelet', 'kubectl debug node/<nó> -it --image=ubuntu, chroot /host e journalctl -u kubelet', 'kubectl top node', 'Não é possível'], 1, 'O Pod de debug monta o nó em /host.'),
        q('Qual a diferença entre OOMKilled e Evicted?', ['São iguais', 'OOMKilled: o kernel mata o container acima do limit; Evicted: o kubelet remove Pods para salvar o nó', 'Evicted é causado pelo scheduler', 'OOMKilled é por disco'], 1, 'Recursos do container × recursos do nó.'),
        q('Com DiskPressure=True, qual taint o nó recebe?', ['unreachable:NoExecute', 'node.kubernetes.io/disk-pressure:NoSchedule', 'dedicated=disk', 'Nenhum'], 1, 'Pods novos não são agendados ali.'),
        q('Para que serve systemReserved/kubeReserved?', ['Aumentar Pods por nó', 'Reservar recursos para o sistema e o kubelet, evitando que Pods os sufoquem', 'Priorizar Pods', 'Configurar DNS'], 1, 'O alocável fica menor, mas o nó fica estável.'),
        q('Os Pods de um nó Unknown aparecem como Running. Isso é confiável?', ['Sim', 'Não: o status pode estar desatualizado, pois ninguém reporta', 'Só em StatefulSets', 'Só com metrics-server'], 1, 'O kubectl mostra o último estado conhecido.'),
        q('O que o node-problem-detector faz?', ['Reinicia nós', 'Transforma problemas de kernel/hardware em condições e eventos do nó', 'Faz backup do etcd', 'Agenda Pods'], 1, 'Dá visibilidade a falhas que o kubelet não vê.'),
      ],
    },
    {
      slug: 'armazenamento', title: 'Armazenamento: PVCs, attach e mount', summary: 'PVC Pending, Multi-Attach, FailedMount, permissões com fsGroup, expansão e ciclo de vida dos dados.', minutes: 12,
      content: md('armazenamento'), simulator: 'ts-volume',
      quiz: [
        q('PVC Pending com "Waiting for a volume to be created … by the external provisioner". Onde olhar?', ['No scheduler', 'No controller do driver CSI e suas credenciais/permissões', 'No CoreDNS', 'No kubelet do Pod'], 1, 'O provisionador não criou o disco.'),
        q('PVC "waiting for first consumer to be created before binding" é um problema?', ['Sim, sempre', 'Não: com WaitForFirstConsumer, o PVC espera um Pod ser agendado', 'Só em produção', 'Indica disco cheio'], 1, 'Assim o disco nasce na zona certa.'),
        q('Deployment com 3 réplicas e um único PVC RWO. O que acontece?', ['Todas usam o mesmo disco', 'Réplicas em outros nós ficam em ContainerCreating com Multi-Attach error', 'O PVC vira RWX', 'O Deployment é rejeitado'], 1, 'Use StatefulSet (um PVC por réplica) ou storage RWX.'),
        q('Rolling update com PVC RWO trava em Multi-Attach. Estratégia adequada?', ['maxSurge: 100%', 'strategy: Recreate', 'Mais réplicas', 'Apagar o PV'], 1, 'O Pod velho precisa soltar o volume antes.'),
        q('A aplicação roda como UID 1000 e recebe "Permission denied" no volume. Correção?', ['Rodar como root', 'securityContext.fsGroup: 1000', 'Mudar o access mode', 'Aumentar o PVC'], 1, 'O kubelet ajusta o grupo dos arquivos do volume.'),
        q('Como expandir um PVC?', ['Não é possível', 'Aumentar spec.resources.requests.storage se a StorageClass permitir expansão', 'Criar outro PV igual', 'Com kubectl scale'], 1, 'Reduzir não é suportado.'),
        q('FailedMount com "secret \\"tls\\" not found" significa…', ['Disco cheio', 'O Secret usado como volume não existe no namespace', 'Falta de IOPS', 'Problema de zona'], 1, 'Volumes de Secret/ConfigMap também precisam existir.'),
        q('storageClassName errado num PVC já criado. Como corrigir?', ['kubectl edit pvc', 'Apagar e recriar o PVC (o campo é imutável)', 'Reiniciar o nó', 'Mudar o PV'], 1, 'Vários campos de PVC são imutáveis.'),
        q('Depois que um nó morre, o Pod reagendado fica em Multi-Attach. Como acelerar?', ['Apagar o PVC', 'Remover o nó morto do cluster, liberando o VolumeAttachment', 'Mudar a imagem', 'Aumentar réplicas'], 1, 'Sem isso, o Kubernetes espera antes de forçar o detach.'),
        q('helm uninstall e kubectl delete statefulset apagam os PVCs de volumeClaimTemplates?', ['Sim', 'Não, por padrão os PVCs (e os dados) permanecem', 'Só com Retain', 'Só em namespaces default'], 1, 'Proteção contra perda de dados.'),
      ],
    },
    {
      slug: 'plano-de-controle', title: 'Plano de controle', summary: 'Sintomas de cada componente, saúde da API, etcd, certificados, webhooks de admission e throttling.', minutes: 14,
      content: md('plano-de-controle'), simulator: 'ts-control-plane',
      quiz: [
        q('O control plane caiu. O que acontece com os Pods que já estavam rodando?', ['Param imediatamente', 'Continuam rodando; o que para é a capacidade de mudar o cluster', 'São migrados', 'Reiniciam'], 1, 'O kubelet mantém os containers.'),
        q('Deployment criado, READY 0/3, sem ReplicaSet e sem eventos. Qual componente suspeitar?', ['kube-scheduler', 'kube-controller-manager', 'CoreDNS', 'etcd'], 1, 'Quem cria ReplicaSets e Pods são os controllers.'),
        q('Erros "etcdserver: request timed out" frequentes costumam ter qual causa?', ['CoreDNS', 'Latência de disco do etcd (fsync lento) ou problemas de quórum', 'Falta de réplicas da app', 'NetworkPolicy'], 1, 'etcd precisa de disco rápido.'),
        q('"x509: certificate has expired or is not yet valid" ao usar kubectl. Em clusters kubeadm, o que fazer?', ['Reinstalar o cluster', 'kubeadm certs check-expiration e kubeadm certs renew all, reiniciando os componentes', 'Apagar o kubeconfig', 'Ignorar'], 1, 'Os certificados valem 1 ano por padrão.'),
        q('Um webhook com failurePolicy: Fail está fora do ar. Consequência?', ['Nada', 'Toda criação/alteração interceptada por ele é rejeitada', 'Os Pods existentes param', 'O etcd corrompe'], 1, 'Pode até impedir que o próprio webhook volte (deadlock).'),
        q('Como evitar que um webhook derrube o cluster?', ['failurePolicy: Fail em tudo', 'Excluir kube-system e o próprio namespace, réplicas + PDB e timeout curto', 'Desligar o API server', 'Não usar webhooks'], 1, 'E avalie Ignore para políticas não críticas.'),
        q('Qual endpoint mostra a prontidão detalhada do API server?', ['/metrics', '/readyz?verbose', '/api/v1/pods', '/healthz/etcd-only'], 1, 'kubectl get --raw="/readyz?verbose".'),
        q('Respostas 429 Too Many Requests da API indicam…', ['Disco cheio', 'API Priority and Fairness limitando um cliente (script ou controller em loop)', 'Certificado expirado', 'Quota de CPU'], 1, 'Procure o cliente que gera volume anormal de requisições.'),
        q('Em clusters kubeadm, onde ficam os manifestos do control plane?', ['Num Deployment em kube-system', 'Pods estáticos em /etc/kubernetes/manifests no nó de control plane', 'No etcd', 'No Helm'], 1, 'Um YAML inválido ali derruba o componente.'),
        q('Por que o backup do etcd é crítico?', ['Acelera o cluster', 'O etcd guarda todo o estado do cluster; sem backup, perdê-lo é perder o cluster', 'É exigido pelo Helm', 'Guarda as imagens'], 1, 'etcdctl snapshot save, com restauração testada.'),
      ],
    },
    {
      slug: 'ferramentas', title: 'Ferramentas e observabilidade', summary: 'kubectl debug, comandos essenciais, métricas, logs, traces, auditoria, runbooks e postmortems.', minutes: 12,
      content: md('ferramentas'), simulator: 'ts-tools',
      quiz: [
        q('Como inspecionar um container distroless (sem shell)?', ['kubectl exec -- sh', 'kubectl debug -it <pod> --image=<imagem-com-ferramentas> --target=<container>', 'Reconstruir a imagem', 'kubectl attach'], 1, 'O container efêmero compartilha processos e rede.'),
        q('O que kubectl debug --copy-to faz?', ['Copia arquivos', 'Cria uma cópia do Pod, podendo trocar comando ou imagem, sem afetar o original', 'Faz backup do Pod', 'Move o Pod de nó'], 1, 'Ótimo para containers que crasham na hora.'),
        q('Como listar só os eventos de aviso de todo o cluster, em ordem?', ['kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp', 'kubectl logs -A', 'kubectl top events', 'kubectl describe cluster'], 0, 'Filtra o ruído dos eventos Normal.'),
        q('Qual ferramenta mostra logs de vários Pods ao mesmo tempo, com cores?', ['stern', 'etcdctl', 'crictl', 'kubeadm'], 0, 'kubectl logs -l também ajuda, com menos recursos.'),
        q('Qual fonte responde "quem apagou o Deployment às 3h"?', ['Eventos', 'Logs de auditoria do API server', 'Métricas', 'Logs da aplicação'], 1, 'Auditoria registra usuário, verbo e recurso.'),
        q('kube-state-metrics fornece…', ['Uso real de CPU dos containers', 'Métricas do estado dos objetos (réplicas, fases, restarts, condições)', 'Logs', 'Traces'], 1, 'O uso de CPU/memória vem do cAdvisor/kubelet.'),
        q('Para que servem traces distribuídos no troubleshooting?', ['Contar Pods', 'Mostrar onde o tempo de uma requisição foi gasto entre serviços', 'Guardar eventos', 'Fazer backup'], 1, 'OpenTelemetry + Tempo/Jaeger.'),
        q('O que deve conter um runbook de alerta?', ['Apenas o nome do alerta', 'Significado, como confirmar, como mitigar e quando escalar', 'O código da aplicação', 'A lista de nós'], 1, 'Linkado no próprio alerta.'),
        q('Para que servem game days e chaos engineering?', ['Testar o humor do time', 'Revelar lacunas de observabilidade e de resposta antes de incidentes reais', 'Aumentar custos', 'Substituir monitoramento'], 1, 'Derrube componentes em ambientes de teste.'),
        q('kubectl diff -f manifests/ ajuda a detectar…', ['Vazamento de memória', 'Drift entre o que está no Git e o que está no cluster', 'Falta de DNS', 'Imagens vulneráveis'], 1, 'Faz um dry-run no servidor.'),
      ],
    },
  ],
};
