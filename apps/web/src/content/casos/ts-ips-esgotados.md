# Pods novos presos em ContainerCreating com o cluster "vazio"

## Contexto

Num cluster EKS, o time de dados passou a rodar centenas de Jobs curtos por hora. Numa manhã, Pods de todos os times ficaram presos em `ContainerCreating`, mesmo com CPU e memória sobrando nos nós.

## Sintomas

```text
$ kubectl describe pod api-7d9f8c6b5-x2k4p -n loja
  Warning  FailedCreatePodSandBox  kubelet  Failed to create pod sandbox: rpc error: code = Unknown desc = failed to
  setup network for sandbox "…": plugin type="aws-cni" name="aws-cni" failed (add): add cmd: failed to assign an IP address to container
```

<!-- solucao -->

## Investigação

O Pod já foi **agendado** (tem nó), então não é problema de scheduler: a falha é na criação da **rede do Pod** (sandbox) pelo plugin CNI.

```text
$ kubectl logs -n kube-system -l k8s-app=aws-node --tail=5 | grep -i ip
… InsufficientFreeAddressesInSubnet: The specified subnet does not have enough free addresses to satisfy the request.

$ aws ec2 describe-subnets --subnet-ids subnet-0a1… --query 'Subnets[].AvailableIpAddressCount'
[ 3 ]
```

## Causa raiz

No AWS VPC CNI, cada Pod recebe um IP **real da subnet** da VPC, e cada nó reserva IPs antecipadamente ("warm pool"). As subnets `/24` (≈250 IPs) foram dimensionadas para poucos Pods por nó; com centenas de Jobs e nós novos reservando IPs, a subnet **esgotou**. Sem IP, o CNI não consegue criar a rede do Pod.

(Em outros CNIs, o equivalente é o pool de IPs do nó — ex.: `podCIDR` /24 com mais Pods que endereços, ou o IPAM do Calico sem blocos livres.)

## Correção

Imediata: limpar Pods de Jobs terminados (`ttlSecondsAfterFinished`) e reduzir o warm pool (`WARM_IP_TARGET`/`MINIMUM_IP_TARGET`) para liberar IPs reservados e ociosos.

Definitiva: adicionar CIDRs secundários à VPC com subnets maiores para os Pods (custom networking) ou habilitar **prefix delegation**, que atribui blocos `/28` aos nós e aumenta muito a densidade.

## Prevenção

- Planeje o endereçamento de Pods junto com a capacidade do cluster (Pods por nó × nós máximos).
- Métricas do CNI (IPs disponíveis por subnet/nó) com alerta.
- `ttlSecondsAfterFinished` em Jobs para não acumular Pods terminados.

Na árvore de diagnóstico, siga "ContainerCreating há minutos" → "FailedCreatePodSandBox".
