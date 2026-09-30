# CoreDNS em CrashLoopBackOff num cluster novo

## Contexto

Um cluster kubeadm novo, em VMs Ubuntu, foi criado para o laboratório. Os Pods sobem, mas nenhum consegue resolver nomes — e os dois Pods do CoreDNS reiniciam sem parar.

## Sintomas

```text
$ kubectl get pods -n kube-system -l k8s-app=kube-dns
NAME                       READY   STATUS             RESTARTS
coredns-7db6d8ff4d-5xk2p   0/1     CrashLoopBackOff   8
coredns-7db6d8ff4d-v9m4q   0/1     CrashLoopBackOff   8

$ kubectl run t --rm -it --image=busybox:1.36 -- nslookup kubernetes.default
;; connection timed out; no servers could be reached
```

<!-- solucao -->

## Investigação

```text
$ kubectl logs -n kube-system coredns-7db6d8ff4d-5xk2p --previous
[FATAL] plugin/loop: Loop (127.0.0.1:53712 -> :53) detected for zone ".",
see https://coredns.io/plugins/loop#troubleshooting. Query: "HINFO 4547991504243258144.3688648895315093531."
```

A configuração padrão do CoreDNS encaminha nomes externos para o resolvedor do **nó** (`forward . /etc/resolv.conf`). No nó:

```text
$ cat /etc/resolv.conf
nameserver 127.0.0.53        # systemd-resolved
```

## Causa raiz

Dentro do Pod do CoreDNS, `127.0.0.53` é o **próprio Pod** — não o systemd-resolved do nó. O CoreDNS encaminha consultas para si mesmo; o plugin `loop` detecta o laço e encerra o processo de propósito, para não consumir toda a CPU.

## Correção

Faça o kubelet entregar aos Pods o resolv.conf "real" do nó (com os servidores upstream), na configuração do kubelet:

```yaml
# /var/lib/kubelet/config.yaml
resolvConf: /run/systemd/resolve/resolv.conf
```

```bash
systemctl restart kubelet               # em todos os nós
kubectl -n kube-system rollout restart deployment/coredns
```

Alternativa: no ConfigMap do CoreDNS, `forward . 1.1.1.1 8.8.8.8` (ou os DNS corporativos).

## Prevenção

- Em distribuições com systemd-resolved, configure `resolvConf` do kubelet no provisionamento.
- Teste de fumaça pós-instalação: `nslookup kubernetes.default` e um nome externo.
