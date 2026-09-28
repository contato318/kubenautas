# Comandos em containers sem passar pelo API server

## Contexto

Um cluster montado "na mão" em VMs de um provedor de nuvem tinha um API server bem configurado: OIDC, RBAC e audit log. Mesmo assim, containers de vários namespaces passaram a rodar processos desconhecidos — e o audit log do API server não registrava nenhum `exec`.

## Sintomas

```text
$ kubectl exec -n loja api-7d9f-x2k -- ps aux | tail -2
root   412  98.0  0.1  kdevtmpfsi
root   415   0.0  0.0  /tmp/.x/kinsing

# audit log: nenhum evento pods/exec nas últimas 72 h
```

<!-- solucao -->

## Investigação

```text
$ curl -sk https://10.0.3.21:10250/pods | head -c 120
{"kind":"PodList","apiVersion":"v1","metadata":{},"items":[{"metadata":{"name":"api-7d9f-x2k", …

$ ssh worker-1 cat /var/lib/kubelet/config.yaml | grep -A3 -E "anonymous|authorization"
  anonymous:
    enabled: true
authorization:
  mode: AlwaysAllow
```

O security group dos nós liberava a porta 10250 para `0.0.0.0/0`.

## Causa raiz

A API do **kubelet** (porta 10250) aceitava requisições **anônimas** e **autorizava tudo**. O atacante chamou diretamente os endpoints de execução do kubelet em cada nó — sem passar pelo API server, portanto sem RBAC e sem audit log. É a técnica usada por campanhas conhecidas de mineração (Kinsing, TeamTNT).

## Correção

```yaml
# /var/lib/kubelet/config.yaml em todos os nós
authentication:
  anonymous: { enabled: false }
  webhook: { enabled: true }
authorization:
  mode: Webhook
readOnlyPort: 0
```

- Reiniciar os kubelets, fechar a 10250 para fora da rede do cluster, recriar os Pods afetados a partir de imagens limpas e substituir os nós (o minerador pode ter persistido no host).

## Prevenção

- kube-bench nos nós no provisionamento e periodicamente.
- Nós em sub-redes privadas; portas do kubelet acessíveis apenas pelo control plane.
- Detecção em runtime: processos novos e conexões a pools de mineração.

Reproduza no simulador de auditoria CIS com o preset "cluster de laboratório".
