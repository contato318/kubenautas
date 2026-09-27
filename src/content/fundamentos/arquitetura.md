# Arquitetura de um cluster

Um cluster Kubernetes é dividido em duas partes: o **Control Plane** (o cérebro) e os **Worker Nodes** (os músculos).

```
┌──────────────────────── CONTROL PLANE ────────────────────────┐
│  kube-apiserver  ◄──►  etcd                                    │
│        ▲                                                       │
│        ├── kube-scheduler                                      │
│        ├── kube-controller-manager                             │
│        └── cloud-controller-manager (opcional)                 │
└────────────────────────────┬──────────────────────────────────┘
                             │ HTTPS
        ┌────────────────────┼────────────────────┐
   ┌────▼─────┐         ┌────▼─────┐         ┌────▼─────┐
   │ worker-1 │         │ worker-2 │         │ worker-3 │
   │ kubelet  │         │ kubelet  │         │ kubelet  │
   │kube-proxy│         │kube-proxy│         │kube-proxy│
   │containerd│         │containerd│         │containerd│
   └──────────┘         └──────────┘         └──────────┘
```

## Control Plane

### kube-apiserver
A **porta de entrada** do cluster. Tudo — `kubectl`, kubelets, controladores — conversa com o API server via REST. Ele autentica, autoriza (RBAC), valida (admission controllers) e persiste os objetos no etcd. É o **único** componente que fala com o etcd.

### etcd
Banco chave-valor distribuído e consistente (usa o algoritmo de consenso **Raft**). Guarda **todo** o estado do cluster. Perdeu o etcd sem backup? Perdeu o cluster. Em produção roda com 3 ou 5 membros (número ímpar para quórum).

### kube-scheduler
Observa Pods **sem nó atribuído** e escolhe onde cada um vai rodar, em duas fases:
1. **Filtragem** — elimina nós sem recursos, com taints incompatíveis, que não batem com nodeSelector/affinity.
2. **Pontuação** — ranqueia os nós restantes (espalhamento, afinidade, uso de recursos) e escolhe o melhor.

O scheduler apenas **decide**; quem de fato inicia o container é o kubelet.

### kube-controller-manager
Um processo que roda dezenas de **controladores** — cada um um loop de reconciliação:
- **Deployment controller** — gerencia ReplicaSets.
- **ReplicaSet controller** — mantém o número de Pods.
- **Node controller** — detecta nós que pararam de responder.
- **Job controller**, **EndpointSlice controller**, **ServiceAccount controller**…

### cloud-controller-manager
Integra com o provedor de nuvem: cria Load Balancers para Services, gerencia rotas e descobre quando uma VM foi removida.

## Worker Nodes

### kubelet
Agente que roda em cada nó. Recebe as especificações dos Pods atribuídos ao seu nó, pede ao runtime para iniciar os containers, executa as **probes** e reporta o status de volta ao API server.

### kube-proxy
Programa regras de rede (iptables, IPVS ou eBPF, dependendo do CNI) para que o IP virtual de um **Service** encaminhe tráfego para os Pods certos.

### Container runtime
Quem realmente executa containers: **containerd** ou **CRI-O**, falando a interface **CRI**. (O suporte direto ao Docker Engine — dockershim — foi removido na versão 1.24; imagens Docker continuam funcionando normalmente.)

## Fluxo: o que acontece num `kubectl apply`

1. `kubectl` envia o manifesto ao **API server**.
2. API server autentica, autoriza, valida e grava o Deployment no **etcd**.
3. O **Deployment controller** percebe o novo objeto e cria um **ReplicaSet**.
4. O **ReplicaSet controller** cria 3 objetos **Pod** (ainda sem nó).
5. O **scheduler** vê Pods pendentes e grava `spec.nodeName` em cada um.
6. O **kubelet** do nó escolhido vê o Pod, chama o **containerd** para baixar a imagem e iniciar o container.
7. O kubelet reporta `Running` ao API server.

> Repare: nenhum componente chama o outro diretamente. Todos **observam** o API server (mecanismo de *watch*) e reagem. Isso torna o sistema desacoplado e resiliente.

## Addons comuns

- **CoreDNS** — DNS interno do cluster.
- **CNI plugin** (Calico, Cilium, Flannel) — rede entre Pods.
- **metrics-server** — métricas de CPU/memória para `kubectl top` e HPA.
- **Ingress controller** (NGINX, Traefik) — roteamento HTTP.
