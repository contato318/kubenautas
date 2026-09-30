# Um nó NotReady que "está ligado"

## Contexto

Às 10h12 o alerta `KubeNodeNotReady` disparou para `worker-5`. A equipe de infraestrutura garante que a VM está ligada, com rede e respondendo a ping. Cinco minutos depois, os Pods do nó começam a ser recriados em outros nós, e a carga nos demais sobe.

## Sintomas

```text
$ kubectl get node worker-5
NAME       STATUS     ROLES    AGE   VERSION
worker-5   NotReady   <none>   61d   v1.31.4

$ kubectl describe node worker-5 | grep -A3 "Ready "
  Ready   False   …   KubeletNotReady   PLEG is not healthy: pleg was last seen active 3m12s ago; threshold is 3m0s
```

<!-- solucao -->

## Investigação

O status é `False` (e não `Unknown`): o kubelet **está vivo** e reportando um problema. PLEG (Pod Lifecycle Event Generator) é o loop do kubelet que consulta o runtime. Ele não recebe resposta há mais de 3 minutos.

```text
$ kubectl debug node/worker-5 -it --image=ubuntu
# chroot /host
# crictl ps
FATA[0010] … context deadline exceeded
# journalctl -u containerd --since "20 min ago" | tail -3
containerd[812]: … failed to handle container TaskExit event … context deadline exceeded
# dmesg -T | grep -i "blocked for more than"
[… 10:09] INFO: task containerd:812 blocked for more than 120 seconds.
# iostat -x 1 3   → disco raiz com %util 100 e await de segundos
```

## Causa raiz

O **containerd travou** esperando I/O: um Pod de ETL gravando muito em `emptyDir` (disco raiz do nó) saturou o disco. Sem o runtime, o kubelet não consegue ver os containers, reporta `NotReady`, o nó recebe o taint `not-ready:NoExecute` e, após 300 s, os Pods são despejados.

## Correção

```bash
kubectl cordon worker-5
kubectl delete pod etl-noturno-… -n dados       # alivia o disco
# no nó: systemctl restart containerd && systemctl restart kubelet
kubectl get node worker-5 -w                    # volta para Ready
kubectl uncordon worker-5
```

## Prevenção

- Limite `ephemeral-storage` e use volumes dedicados para cargas com muito I/O.
- Disco separado para `/var/lib/containerd` (imagefs) em nós de carga pesada.
- Alertas de latência de disco do nó, não só de espaço.
- `node-problem-detector` para transformar "task blocked" do kernel em condição do nó.

No simulador de nós, escolha "containerd travou" e avance no tempo.
