import type { Question } from '../types';

/**
 * Perguntas adicionais por lição (chave = "<modulo>/<slug>").
 * São somadas ao quiz de cada lição em modules.ts.
 */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const extraQuizzes: Record<string, Question[]> = {
  'fundamentos/o-que-e-kubernetes': [
    q('O que significa a abreviação K8s?', ['K + as 8 letras omitidas + s', 'Kubernetes versão 8', 'Kernel com 8 serviços', 'O 8º projeto da CNCF'], 0, 'Entre o K e o s de "Kubernetes" existem 8 letras.'),
    q('Qual fundação hospeda o projeto Kubernetes?', ['Apache Software Foundation', 'Cloud Native Computing Foundation (CNCF)', 'OpenStack Foundation', 'Eclipse Foundation'], 1, 'O Google doou o projeto para a CNCF, parte da Linux Foundation, em 2015.'),
    q('Qual sistema interno do Google inspirou o Kubernetes?', ['Borg', 'Spanner', 'MapReduce', 'Bigtable'], 0, 'O Kubernetes herdou muitas ideias do Borg e do Omega.'),
    q('O que é um controller no Kubernetes?', ['Um painel web de administração', 'Um loop que observa objetos pela API e age para levar o estado atual ao desejado', 'Um tipo de nó com mais CPU', 'O processo que baixa imagens'], 1, 'ReplicaSet, Deployment, Job e Node controller são exemplos de loops de reconciliação.'),
    q('Qual benefício NÃO é típico de adotar Kubernetes?', ['Autoescalonamento', 'Service discovery e balanceamento', 'Dispensar monitoramento das aplicações', 'Rollouts declarativos'], 2, 'Kubernetes reinicia e reagenda, mas você ainda precisa de métricas, logs e alertas.'),
  ],
  'fundamentos/arquitetura': [
    q('O que o kube-controller-manager executa?', ['O etcd', 'Vários controladores (ReplicaSet, Node, Job, EndpointSlice…) em um único processo', 'Os containers das aplicações', 'O DNS do cluster'], 1, 'Cada controlador é um loop independente, empacotado no mesmo binário.'),
    q('Em clusters kubeadm, de onde o kubelet sobe os componentes do control plane?', ['De um Deployment no namespace default', 'De manifestos de Pods estáticos em /etc/kubernetes/manifests', 'De um Helm chart', 'Do etcd diretamente'], 1, 'Pods estáticos são lidos pelo kubelet do disco local, sem depender do API server.'),
    q('Como os componentes ficam sabendo de mudanças sem consultar o API server o tempo todo?', ['Por e-mail', 'Usando watch: o API server envia os eventos de mudança', 'Lendo o etcd a cada segundo', 'Por SSH nos nós'], 1, 'Informers usam list + watch e mantêm um cache local.'),
    q('Qual a função do cloud-controller-manager?', ['Rodar containers na nuvem', 'Integrar com o provedor: criar load balancers, gerenciar nós e rotas', 'Substituir o scheduler', 'Fazer backup do etcd'], 1, 'Ele isola o código específico de cada nuvem do núcleo do Kubernetes.'),
    q('Se o control plane ficar indisponível, o que acontece com os Pods já em execução?', ['Param imediatamente', 'Continuam rodando, mas não há reagendamento, escala nem mudanças', 'São migrados para outro cluster', 'Reiniciam em loop'], 1, 'O kubelet mantém os containers; o que para é a capacidade de mudar o cluster.'),
  ],
  'fundamentos/kubectl-e-yaml': [
    q('Qual a diferença entre kubectl create e kubectl apply?', ['Nenhuma', 'create falha se o objeto existe; apply cria ou atualiza de forma declarativa', 'apply só funciona com Helm', 'create é mais novo'], 1, 'apply guarda a última configuração aplicada e calcula o patch.'),
    q('Como listar Pods de todos os namespaces?', ['kubectl get pods --all', 'kubectl get pods -A', 'kubectl get pods -n *', 'kubectl pods global'], 1, '-A é o atalho de --all-namespaces.'),
    q('Qual comando mostra a documentação dos campos de um recurso?', ['kubectl help deployment', 'kubectl explain deployment.spec.strategy', 'kubectl docs deployment', 'kubectl man deployment'], 1, 'explain lê o schema OpenAPI do próprio cluster.'),
    q('Como separar vários objetos no mesmo arquivo YAML?', ['Com uma linha contendo ---', 'Com uma linha em branco', 'Com ;', 'Não é possível'], 0, 'Cada documento YAML é separado por ---.'),
    q('Qual comando mostra o que mudaria no cluster antes de aplicar um manifesto?', ['kubectl diff -f app.yaml', 'kubectl apply --what-if', 'kubectl compare app.yaml', 'kubectl preview -f app.yaml'], 0, 'diff faz um server-side dry-run e mostra as diferenças.'),
  ],
  'fundamentos/laboratorio-kubectl': [
    q('Como abrir um shell dentro de um container?', ['kubectl ssh pod', 'kubectl exec -it pod -- sh', 'kubectl attach --shell pod', 'kubectl run shell pod'], 1, 'Tudo após -- é o comando executado no container.'),
    q('Como acessar localmente a porta 80 de um Service sem expô-lo?', ['kubectl expose --local', 'kubectl port-forward svc/web 8080:80', 'kubectl proxy svc/web', 'kubectl tunnel web 80'], 1, 'O tráfego passa pelo API server até um Pod do Service.'),
    q('Como trocar a imagem de um Deployment pela linha de comando?', ['kubectl set image deployment/web web=nginx:1.27', 'kubectl image web nginx:1.27', 'kubectl update deploy web --image', 'kubectl patch image web'], 0, 'O formato é <container>=<imagem>.'),
    q('Como listar apenas os Pods com o label app=web?', ['kubectl get pods app=web', 'kubectl get pods -l app=web', 'kubectl get pods --name web', 'kubectl find pods web'], 1, '-l aceita seletores como app=web,tier!=db.'),
    q('Como mudar o namespace padrão do contexto atual?', ['kubectl namespace loja', 'kubectl config set-context --current --namespace=loja', 'kubectl use loja', 'export NAMESPACE=loja'], 1, 'Ferramentas como kubens fazem isso por baixo.'),
  ],
  'workloads/pods': [
    q('Como se chama o padrão de um container auxiliar no mesmo Pod (proxy, coletor de logs)?', ['Sidecar', 'Daemon', 'Operator', 'Init'], 0, 'Desde a 1.29, sidecars nativos são init containers com restartPolicy: Always.'),
    q('Um Pod aparece como Completed. O que isso indica?', ['Está pronto para receber tráfego', 'Os containers terminaram com sucesso e não serão reiniciados', 'Foi despejado do nó', 'Está esperando agendamento'], 1, 'Comum em Jobs, com restartPolicy Never ou OnFailure.'),
    q('O IP de um Pod é estável?', ['Sim, para sempre', 'Não: um Pod recriado recebe outro IP; use um Service', 'Só em StatefulSets', 'Só com hostNetwork'], 1, 'Services e DNS dão um endereço estável.'),
    q('Em qual fase fica um Pod aceito pelo cluster cujo container ainda não iniciou (agendamento, download de imagem)?', ['Running', 'Pending', 'Succeeded', 'Unknown'], 1, 'Pending cobre desde a espera pelo scheduler até o pull da imagem.'),
    q('O nó onde um Pod gerenciado por Deployment roda é removido. O que acontece com o Pod?', ['Ele migra com o mesmo nome para outro nó', 'É removido; o ReplicaSet cria um Pod NOVO em outro nó', 'Fica rodando sem nó', 'O Deployment é apagado'], 1, 'Pods não migram: são substituídos.'),
  ],
  'workloads/deployments': [
    q('Como pausar um rollout para aplicar várias mudanças de uma vez?', ['kubectl rollout pause deployment/web', 'kubectl scale --replicas=0', 'kubectl stop deployment web', 'kubectl freeze web'], 0, 'Depois use kubectl rollout resume.'),
    q('Qual comando lista as revisões de um Deployment?', ['kubectl rollout history deployment/web', 'kubectl get revisions web', 'kubectl describe rs --history', 'kubectl log deployment web'], 0, 'Use --revision=N para ver o template de uma revisão.'),
    q('Para que serve o label pod-template-hash?', ['Para versionar a imagem', 'Para distinguir os Pods de cada ReplicaSet de um mesmo Deployment', 'Para o scheduler escolher o nó', 'Para criptografar o Pod'], 1, 'O Deployment adiciona esse label automaticamente.'),
    q('Como reiniciar gradualmente todos os Pods de um Deployment sem mudar a imagem?', ['kubectl delete pods --all', 'kubectl rollout restart deployment/web', 'kubectl reboot web', 'kubectl apply --force'], 1, 'Ele altera uma annotation do template e dispara um rolling update.'),
    q('Um Deployment tem HPA e o manifesto no Git define replicas: 3. O que acontece a cada kubectl apply?', ['Nada', 'O apply sobrescreve o número definido pelo HPA, derrubando réplicas', 'O HPA é desativado', 'O apply falha'], 1, 'Com HPA, remova spec.replicas do manifesto versionado.'),
  ],
  'workloads/rolling-update': [
    q('Quais são os valores padrão de maxSurge e maxUnavailable?', ['0 e 1', '25% e 25%', '1 e 0', '50% e 50%'], 1, 'Arredondamento: surge para cima, unavailable para baixo.'),
    q('Para que serve minReadySeconds?', ['Atrasar o agendamento', 'Exigir que um Pod novo fique Ready por um tempo antes de ser considerado disponível', 'Definir o timeout da readiness', 'Limitar o tempo do rollout'], 1, 'Ajuda a pegar Pods que ficam Ready e quebram logo depois.'),
    q('O que acontece quando o rollout passa de progressDeadlineSeconds sem progresso?', ['Rollback automático', 'O Deployment é marcado com Progressing=False (ProgressDeadlineExceeded)', 'Os Pods são apagados', 'O cluster reinicia'], 1, 'O padrão é 600s; o rollback continua manual (ou feito pelo seu CD).'),
    q('É possível configurar maxSurge: 0 e maxUnavailable: 0?', ['Sim, é o mais seguro', 'Não: a API rejeita, pois o rollout nunca progrediria', 'Sim, mas só com Recreate', 'Sim, em StatefulSets'], 1, 'Pelo menos um dos dois precisa ser maior que zero.'),
    q('Canary com dois Deployments atrás do mesmo Service: 9 réplicas v1 e 1 réplica v2. Quanto tráfego vai para a v2?', ['50%', 'Cerca de 10%', '1%', '0% até promover'], 1, 'O Service distribui entre todos os endpoints; a proporção vem do número de réplicas.'),
  ],
  'workloads/outros-controladores': [
    q('Em um Job, o que definem completions e parallelism?', ['CPU e memória', 'Quantas execuções com sucesso são necessárias e quantos Pods rodam ao mesmo tempo', 'Timeout e retentativas', 'Nós e zonas'], 1, 'completions: 10 e parallelism: 3 processa 10 itens, 3 por vez.'),
    q('O que backoffLimit controla em um Job?', ['O tempo máximo de execução', 'Quantas falhas são toleradas antes de marcar o Job como falho', 'O número de nós', 'O intervalo do CronJob'], 1, 'O padrão é 6, com espera exponencial entre tentativas.'),
    q('Como apagar Jobs terminados automaticamente?', ['concurrencyPolicy: Forbid', 'ttlSecondsAfterFinished', 'restartPolicy: Never', 'activeDeadlineSeconds'], 1, 'O controlador de TTL remove o Job e seus Pods após o prazo.'),
    q('StatefulSet com podManagementPolicy: OrderedReady escala de 0 para 3. Como os Pods sobem?', ['Todos ao mesmo tempo', 'web-0, espera ficar Ready, depois web-1, depois web-2', 'Em ordem aleatória', 'web-2 primeiro'], 1, 'Parallel sobe todos juntos, mantendo nomes e volumes estáveis.'),
    q('Como fazer um CronJob seguir o horário de Brasília?', ['Mudar o fuso do etcd', 'spec.timeZone: America/Sao_Paulo', 'Somar 3 horas no schedule', 'Não é possível'], 1, 'Sem timeZone, o schedule usa o fuso do kube-controller-manager (geralmente UTC).'),
  ],
  'rede/services': [
    q('Qual o intervalo padrão de portas do NodePort?', ['1–1024', '8000–9000', '30000–32767', '40000–65535'], 2, 'Configurável via --service-node-port-range no API server.'),
    q('Para que serve sessionAffinity: ClientIP?', ['Criptografar o tráfego', 'Enviar as requisições de um mesmo IP cliente sempre ao mesmo Pod', 'Balancear por CPU', 'Bloquear IPs externos'], 1, 'Útil para apps com sessão em memória, com timeout configurável.'),
    q('O que faz externalTrafficPolicy: Local?', ['Bloqueia tráfego externo', 'Preserva o IP de origem e só entrega a Pods do próprio nó que recebeu o tráfego', 'Usa só o DNS local', 'Força HTTP/2'], 1, 'Evita um salto extra e o SNAT, mas pode desbalancear.'),
    q('Qual objeto guarda a lista de endereços dos Pods de um Service nas versões atuais?', ['ConfigMap', 'EndpointSlice', 'ServiceAccount', 'NodeList'], 1, 'EndpointSlices substituíram os Endpoints para escalar melhor.'),
    q('O que faz um Service do tipo ExternalName?', ['Cria um load balancer externo', 'Responde no DNS com um CNAME para um nome externo', 'Expõe o Service na internet', 'Aponta para um IP fixo'], 1, 'Não há proxy nem endpoints: é só DNS.'),
  ],
  'rede/ingress': [
    q('Para que serve spec.ingressClassName?', ['Definir o certificado', 'Escolher qual Ingress Controller implementa aquele Ingress', 'Definir o namespace', 'Definir a porta'], 1, 'Vários controllers podem conviver no mesmo cluster.'),
    q('pathType: Exact com path /login casa com /login/?', ['Sim', 'Não: Exact exige o caminho idêntico, inclusive a barra final', 'Só em HTTPS', 'Depende do host'], 1, 'Prefix /login casaria com /login e /login/.'),
    q('Regras Prefix /api e /api/v2 no mesmo host. Para /api/v2/users, qual vence?', ['/api', '/api/v2 (o prefixo mais longo)', 'A primeira declarada', 'Nenhuma'], 1, 'O caminho mais longo tem precedência; em empate, Exact vence Prefix.'),
    q('Uma requisição não casa com nenhuma regra. O que acontece?', ['Vai para um Pod aleatório', 'Vai para o defaultBackend, se existir; senão o controller responde 404', 'O Ingress é recriado', 'É encaminhada ao API server'], 1, 'O defaultBackend também pode ser definido pelo próprio controller.'),
    q('Qual ferramenta emite e renova certificados Let’s Encrypt para Ingresses?', ['cert-manager', 'kube-proxy', 'CoreDNS', 'Helm'], 0, 'Ele cria o Secret TLS a partir de uma annotation ou de um Certificate.'),
  ],
  'rede/dns-networkpolicy': [
    q('Por que resolver api.externa.com de dentro de um Pod pode gerar várias consultas DNS?', ['Porque o CoreDNS é lento', 'Por causa do ndots:5: nomes com menos de 5 pontos passam antes pelos domínios de busca', 'Porque DNS usa TCP', 'Por causa de NetworkPolicy'], 1, 'Use FQDN com ponto final (api.externa.com.) ou reduza ndots.'),
    q('Qual servidor DNS roda por padrão na maioria dos clusters?', ['bind9', 'CoreDNS (exposto pelo Service kube-dns)', 'dnsmasq', 'Unbound'], 1, 'O Service mantém o nome kube-dns por compatibilidade.'),
    q('Como permitir tráfego vindo de outro namespace em uma NetworkPolicy?', ['Com ipBlock do namespace', 'Com namespaceSelector (ex.: kubernetes.io/metadata.name: monitoring)', 'Com hostNetwork', 'Não é possível'], 1, 'Todo namespace tem o label kubernetes.io/metadata.name automaticamente.'),
    q('Em uma regra from, namespaceSelector e podSelector no MESMO item significam…', ['OU: qualquer um dos dois', 'E: Pods com aquele label dentro dos namespaces selecionados', 'Que a regra é ignorada', 'Que só vale para egress'], 1, 'Em itens separados da lista, seria OU — um erro comum.'),
    q('NetworkPolicies são aditivas. O que isso significa?', ['A última aplicada vence', 'O que é permitido é a união das regras de todas as policies que selecionam o Pod', 'Uma policy pode negar o que outra permitiu', 'Só uma policy vale por namespace'], 1, 'Não existe regra de deny na API padrão: bloqueio vem de o Pod estar selecionado sem regra que permita.'),
  ],
  'config/configmaps-secrets': [
    q('Um ConfigMap montado como volume é atualizado dentro do Pod?', ['Nunca', 'Sim, eventualmente (sincronização do kubelet), exceto quando montado com subPath', 'Somente após reiniciar o nó', 'Imediatamente, sempre'], 1, 'A app ainda precisa reler o arquivo para usar o novo valor.'),
    q('Qual o tamanho máximo de um ConfigMap?', ['64 KiB', '1 MiB', '10 MiB', 'Ilimitado'], 1, 'O limite vem do tamanho de objetos no etcd.'),
    q('Para que serve immutable: true em ConfigMaps e Secrets?', ['Criptografar', 'Evitar mudanças acidentais e reduzir carga no API server, que não precisa de watch', 'Replicar entre namespaces', 'Aumentar o limite de tamanho'], 1, 'Para mudar, crie um objeto novo com outro nome.'),
    q('Qual ferramenta sincroniza segredos de um cofre externo (Vault, AWS Secrets Manager) para Secrets?', ['External Secrets Operator', 'Kustomize', 'kube-proxy', 'metrics-server'], 0, 'Outra opção é o Secrets Store CSI Driver, que monta direto como volume.'),
    q('Como expor apenas uma chave de um Secret como variável de ambiente?', ['envFrom.secretRef', 'env[].valueFrom.secretKeyRef', 'volumeMounts.secret', 'annotations.secret'], 1, 'envFrom importa todas as chaves de uma vez.'),
  ],
  'config/volumes': [
    q('Um PVC com volumeBindingMode: WaitForFirstConsumer fica Pending até…', ['O admin aprovar', 'Um Pod que o usa ser agendado, para o disco nascer na zona certa', 'O próximo reboot', 'Sempre'], 1, 'Evita discos criados numa zona onde o Pod não pode rodar.'),
    q('Por que evitar hostPath em aplicações?', ['É lento', 'Prende o Pod ao nó e dá acesso ao sistema de arquivos do host (risco de segurança)', 'Não suporta escrita', 'Só funciona em Windows'], 1, 'Pod Security no nível baseline/restricted bloqueia hostPath.'),
    q('Como aumentar o tamanho de um PVC existente?', ['Apagar e recriar', 'Editar spec.resources.requests.storage, se a StorageClass tiver allowVolumeExpansion: true', 'Com kubectl scale', 'Não é possível'], 1, 'Reduzir tamanho não é suportado.'),
    q('Um PV com reclaimPolicy: Retain fica Released após apagar o PVC. Outro PVC pode usá-lo automaticamente?', ['Sim, na hora', 'Não: um admin precisa limpar os dados e o claimRef antes', 'Só se for RWX', 'Só no mesmo namespace'], 1, 'Retain protege dados: reutilizar exige ação manual.'),
    q('Qual tipo de volume junta ConfigMaps, Secrets e token de ServiceAccount em um único diretório?', ['emptyDir', 'projected', 'hostPath', 'nfs'], 1, 'É assim que o token da ServiceAccount é montado nos Pods.'),
  ],
  'scheduling/recursos': [
    q('O que faz um LimitRange?', ['Limita o número de Pods do cluster', 'Define defaults e mínimos/máximos de requests e limits por container em um namespace', 'Limita a banda de rede', 'Reserva CPU para o kubelet'], 1, 'Útil para garantir que nenhum Pod suba sem requests.'),
    q('O que faz um ResourceQuota?', ['Limita o total de recursos e objetos de um namespace', 'Define a QoS dos Pods', 'Mede o uso real de CPU', 'Agenda Pods'], 0, 'Ex.: requests.cpu: 20, pods: 100, services.loadbalancers: 2.'),
    q('Todos os containers de um Pod têm requests iguais aos limits de CPU e memória. Qual a QoS?', ['BestEffort', 'Burstable', 'Guaranteed', 'Critical'], 2, 'Guaranteed é o último a ser despejado sob pressão.'),
    q('Por que muitas equipes deixam de definir limit de CPU (mas mantêm o de memória)?', ['Porque é proibido', 'Para evitar throttling desnecessário; o request já garante a fatia justa de CPU', 'Para economizar memória', 'Porque o HPA exige'], 1, 'Memória não é compressível: sem limit, um vazamento pode afetar o nó.'),
    q('O que é o "allocatable" de um nó?', ['A capacidade total de hardware', 'A capacidade menos as reservas do sistema/kubelet e o limiar de despejo', 'O uso atual', 'O limite do HPA'], 1, 'O scheduler usa allocatable, não capacity.'),
  ],
  'scheduling/probes': [
    q('A readiness falha em TODAS as réplicas. O que acontece?', ['Os Pods são reiniciados', 'O Service fica sem endpoints e a aplicação para de receber tráfego', 'O Deployment faz rollback', 'Nada'], 1, 'Readiness não reinicia nada — ela só tira o Pod do balanceamento.'),
    q('Para que serve um preStop com sleep de alguns segundos em apps web?', ['Atrasar o início da app', 'Dar tempo para endpoints e balanceadores removerem o Pod antes de a app parar de aceitar conexões', 'Esperar o banco subir', 'Evitar OOMKilled'], 1, 'Evita erros 502 durante rollouts.'),
    q('Liveness com periodSeconds: 10 e failureThreshold: 3. Quando o container é reiniciado?', ['Na primeira falha', 'Após cerca de 30s de falhas consecutivas', 'Após 3 minutos', 'Nunca'], 1, 'São 3 falhas seguidas, com 10s entre elas.'),
    q('Enquanto a startupProbe não passa, o que acontece com liveness e readiness?', ['Rodam normalmente', 'Ficam desativadas', 'Viram exec', 'São somadas'], 1, 'Assim apps lentas para iniciar não são mortas pela liveness.'),
    q('O container não termina após terminationGracePeriodSeconds. O que acontece?', ['Espera indefinidamente', 'Recebe SIGKILL', 'O nó reinicia', 'O Pod vira Unknown'], 1, 'O padrão é 30s.'),
  ],
  'scheduling/hpa': [
    q('Qual componente fornece métricas de CPU e memória ao HPA?', ['kube-proxy', 'metrics-server (API metrics.k8s.io)', 'etcd', 'CoreDNS'], 1, 'Métricas customizadas vêm de adaptadores como o Prometheus Adapter.'),
    q('O que faz o VPA (Vertical Pod Autoscaler)?', ['Adiciona nós', 'Recomenda (e opcionalmente aplica) requests e limits dos containers', 'Adiciona réplicas', 'Muda a imagem'], 1, 'No modo Auto, ele recria Pods para aplicar os novos valores.'),
    q('Por que evitar HPA e VPA agindo sobre a mesma métrica de CPU?', ['Não há problema', 'Um muda réplicas e o outro muda requests: eles brigam e oscilam', 'O VPA desativa o HPA', 'Consome mais etcd'], 1, 'Combine VPA de memória com HPA de métricas de negócio, por exemplo.'),
    q('O HPA pode escalar por requisições por segundo?', ['Não, só CPU', 'Sim, com métricas customizadas ou externas (ex.: via Prometheus Adapter ou KEDA)', 'Só com VPA', 'Só em StatefulSets'], 1, 'O autoscaling/v2 aceita métricas Pods, Object e External.'),
    q('Qual campo do autoscaling/v2 ajusta a velocidade de scale up e scale down?', ['spec.speed', 'spec.behavior (policies e stabilizationWindowSeconds)', 'spec.strategy', 'spec.rate'], 1, 'Ex.: no máximo 4 Pods a cada 60s no scale up.'),
  ],
  'scheduling/afinidade-taints': [
    q('Qual a diferença entre requiredDuringScheduling… e preferredDuringScheduling…?', ['Nenhuma', 'required é obrigatório para agendar; preferred só soma pontos na escolha do nó', 'preferred é obrigatório', 'required vale só para DaemonSets'], 1, 'Se nenhum nó satisfizer um required, o Pod fica Pending.'),
    q('O que significa o sufixo IgnoredDuringExecution?', ['A regra é ignorada sempre', 'Se os labels do nó mudarem depois, o Pod já em execução não é expulso', 'A regra só vale em execução', 'O Pod é reiniciado'], 1, 'A regra só é avaliada no momento do agendamento.'),
    q('Qual taint o control plane recebe por padrão em clusters kubeadm?', ['node.kubernetes.io/disk-pressure', 'node-role.kubernetes.io/control-plane:NoSchedule', 'dedicated=gpu:NoExecute', 'Nenhum'], 1, 'Por isso suas apps não rodam nos nós de control plane.'),
    q('Um nó fica NotReady. Quando seus Pods são expulsos?', ['Imediatamente', 'Após a tolerância padrão de 300s ao taint node.kubernetes.io/not-ready (ou unreachable)', 'Nunca', 'Após 24 horas'], 1, 'Ajuste tolerationSeconds para reagir mais rápido.'),
    q('PDB com maxUnavailable: 1 e 3 réplicas saudáveis. Quantos Pods o drain pode remover ao mesmo tempo?', ['0', '1', '2', '3'], 1, 'As próximas remoções esperam os substitutos ficarem prontos. Teste no simulador de drain.'),
  ],
  'operacao/namespaces-rbac': [
    q('Uma RoleBinding pode referenciar uma ClusterRole?', ['Não', 'Sim: as permissões valem apenas no namespace da RoleBinding', 'Sim, e valem no cluster todo', 'Só para ServiceAccounts'], 1, 'Assim uma ClusterRole genérica é reutilizada em vários namespaces.'),
    q('Qual ClusterRole padrão dá leitura à maioria dos recursos de um namespace, sem acesso a Secrets?', ['admin', 'edit', 'view', 'cluster-admin'], 2, 'edit permite alterar; admin também gerencia RBAC do namespace.'),
    q('Como testar as permissões de outra identidade?', ['kubectl auth can-i list pods --as=ana', 'kubectl login ana', 'kubectl su ana', 'kubectl rbac test ana'], 0, 'Para ServiceAccounts: --as=system:serviceaccount:<ns>:<nome>.'),
    q('Por que desativar automountServiceAccountToken em Pods que não usam a API?', ['Para economizar memória', 'Para que um invasor do container não tenha um token da API à disposição', 'Porque é obrigatório', 'Para acelerar o boot'], 1, 'Menor privilégio também vale para identidades de máquina.'),
    q('Qual mecanismo aplica os perfis privileged, baseline e restricted por namespace?', ['NetworkPolicy', 'Pod Security Admission (labels pod-security.kubernetes.io/enforce)', 'ResourceQuota', 'LimitRange'], 1, 'Substituiu as antigas PodSecurityPolicies.'),
  ],
  'operacao/troubleshooting': [
    q('Como depurar um container distroless, que não tem shell?', ['Não é possível', 'kubectl debug -it pod --image=busybox --target=app (container efêmero)', 'kubectl exec com --force', 'Reconstruir a imagem sempre'], 1, 'O container efêmero compartilha o namespace de processos do alvo.'),
    q('Pod em CreateContainerConfigError. Causa comum?', ['Falta de CPU', 'Um ConfigMap ou Secret (ou chave) referenciado não existe', 'Imagem inexistente', 'Liveness falhando'], 1, 'O describe mostra qual referência falhou.'),
    q('FailedScheduling: "3 node(s) had untolerated taint". O que fazer?', ['Aumentar memória', 'Adicionar a toleration adequada ou usar/remover o taint dos nós', 'Reiniciar o scheduler', 'Mudar a imagem'], 1, 'Taints repelem Pods sem toleration correspondente.'),
    q('Como listar eventos do namespace em ordem cronológica?', ['kubectl get events --sort-by=.metadata.creationTimestamp', 'kubectl events --order', 'kubectl logs events', 'kubectl describe events -t'], 0, 'Versões recentes também têm kubectl events.'),
    q('Um namespace fica preso em Terminating. Causa mais comum?', ['Falta de CPU', 'Objetos com finalizers que nenhum controller remove (ex.: operador já desinstalado ou APIService fora do ar)', 'O etcd cheio', 'Pods em Running'], 1, 'Investigue os recursos restantes e seus finalizers antes de removê-los manualmente.'),
  ],
  'operacao/helm': [
    q('Como desfazer um upgrade que deu errado?', ['helm undo', 'helm rollback <release> <revisão>', 'helm revert', 'helm delete --last'], 1, 'helm history mostra as revisões disponíveis.'),
    q('Onde o Helm 3 guarda o estado das releases?', ['No Tiller', 'Em Secrets no namespace da release', 'Em um arquivo local', 'No etcd diretamente, fora da API'], 1, 'Secrets do tipo helm.sh/release.v1.'),
    q('Qual flag do helm upgrade instala a release se ela ainda não existir?', ['--create', '--install', '--new', '--init'], 1, 'helm upgrade --install é idempotente, ideal para pipelines.'),
    q('O que faz --atomic em um upgrade?', ['Criptografa a release', 'Faz rollback automático se o upgrade falhar', 'Instala em todos os namespaces', 'Pula os hooks'], 1, '--atomic implica --wait.'),
    q('Como ver os valores usados por uma release instalada?', ['helm get values <release>', 'helm show values <release>', 'helm values list', 'kubectl get values'], 0, 'Use --all para incluir os valores padrão do chart; helm show values lê o chart.'),
  ],
};
