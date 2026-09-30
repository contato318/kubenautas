# Nós e kubelet

Quando o problema atinge vários Pods ao mesmo tempo — e todos estão no mesmo nó — a investigação muda de nível.

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide --field-selector spec.nodeName=worker-2
kubectl describe node worker-2
```

## Condições do nó

| Condição | `True` significa |
| --- | --- |
| `Ready` | kubelet saudável e aceitando Pods (`False` = problema reportado; `Unknown` = sem notícias) |
| `MemoryPressure` | Memória disponível abaixo do limiar de despejo |
| `DiskPressure` | Disco (nodefs/imagefs) abaixo do limiar |
| `PIDPressure` | Processos demais |
| `NetworkUnavailable` | Rede do nó não configurada (CNI) |

`Ready=Unknown` quer dizer que o **control plane parou de receber heartbeats** — o nó pode estar desligado, sem rede, ou com o kubelet parado. `Ready=False` quer dizer que o kubelet está vivo e **reporta** um problema (ex.: runtime fora do ar, "PLEG is not healthy").

## A linha do tempo de um nó perdido (padrões)

1. O kubelet para de renovar seu *Lease* (heartbeat).
2. Após o `node-monitor-grace-period` (dezenas de segundos), o nó vira `Ready=Unknown` e recebe os taints `node.kubernetes.io/unreachable` (`NoSchedule` e `NoExecute`).
3. Os Pods toleram esse taint por **300 s** (`tolerationSeconds` padrão). Depois, são despejados e os controllers criam substitutos em outros nós.
4. Pods de **StatefulSet** ficam `Terminating` até o nó confirmar ou ser removido — o Kubernetes não arrisca ter dois `db-0` ao mesmo tempo.

Atenção: `Running` na saída do kubectl pode estar **desatualizado** — ninguém está reportando o estado real daquele nó.

## Investigando dentro do nó

Sem SSH, use um Pod de debug no nó:

```bash
kubectl debug node/worker-2 -it --image=ubuntu
chroot /host
systemctl status kubelet containerd
journalctl -u kubelet --since "30 min ago" | tail -100
crictl ps -a              # containers vistos pelo runtime
crictl pods
df -h ; df -i             # espaço e inodes
free -m ; dmesg -T | tail # OOM do kernel, erros de disco, conntrack
```

Mensagens do kubelet que você vai encontrar:

| Mensagem | Significado |
| --- | --- |
| `PLEG is not healthy: pleg was last seen active 3m0s ago` | O kubelet não consegue listar containers: runtime travado ou sobrecarregado |
| `container runtime is down` | containerd/CRI-O não responde |
| `failed to garbage collect required amount of images` | Disco cheio mesmo após limpar imagens |
| `node has insufficient PID` | Limite de processos |
| `Unable to update cni config` | Rede do Pod não configurada |

## Pressão e despejo

O kubelet protege o nó despejando Pods quando um recurso fica abaixo do limiar (`evictionHard`, ex.: `memory.available<100Mi`, `nodefs.available<10%`):

- Adiciona a condição (`DiskPressure=True`) e o taint `NoSchedule` correspondente.
- Tenta recuperar sozinho (coleta de imagens e containers mortos).
- Despeja Pods — primeiro os que mais excedem seus **requests**, depois por prioridade.
- Pods despejados ficam como `Evicted` (fase `Failed`) para registro.

Diferença importante: **OOMKilled** é o kernel matando um container que passou do **limit**; **Evicted** é o kubelet removendo um Pod para salvar o **nó**.

## Recuperação

```bash
kubectl cordon worker-2                            # não receber Pods novos
kubectl drain worker-2 --ignore-daemonsets --delete-emptydir-data
# … corrigir (reiniciar kubelet/containerd, liberar disco, trocar o nó)
kubectl uncordon worker-2
```

Em nuvem, muitas vezes o caminho mais rápido é **substituir** o nó (o grupo de nós cria outro) e investigar depois com os logs coletados.

## Prevenção

- Reserve recursos para o sistema (`systemReserved`, `kubeReserved`) — sem isso, Pods podem sufocar o kubelet.
- Alerte em `kube_node_status_condition{condition="Ready",status!="true"}` e em pressão de disco/memória.
- `node-problem-detector` transforma problemas do kernel/hardware em condições e eventos do nó.

No simulador, escolha o tipo de falha e avance no tempo para ver condições, taints e o destino dos Pods.
