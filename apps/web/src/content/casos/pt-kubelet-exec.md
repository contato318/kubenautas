# Avaliação: kubelet aceita acesso não autenticado

## Contexto

Durante um pentest autorizado, o recon apontou a porta 10250 aberta nos nós, acessível a partir da rede de aplicações. O objetivo do teste era verificar se a API do kubelet estava protegida.

## Sintomas

```text
$ curl -sk https://10.20.1.5:10250/pods | head -c 80
{"kind":"PodList","apiVersion":"v1","metadata":{},"items":[{"metadata":{"name":...
```

A API do kubelet respondeu a uma requisição **sem autenticação**, listando os Pods do nó.

<!-- solucao -->

## Investigação

O avaliador validou a configuração do kubelet junto ao cliente:

```text
authentication:
  anonymous:
    enabled: true
authorization:
  mode: AlwaysAllow
```

Com `anonymous.enabled: true` e `authorization.mode: AlwaysAllow`, qualquer requisição que alcance a porta 10250 é aceita e autorizada — sem passar pelo API server, portanto **sem RBAC e sem registro no audit log**. O avaliador documentou o achado listando os Pods (evidência mínima) e **não** executou comandos nos containers, embora a configuração permitisse.

## Causa raiz

Kubelet configurado para aceitar acesso anônimo e autorizar tudo — uma das falhas mais graves de configuração de cluster, e o vetor de campanhas conhecidas de mineração. A porta alcançável a partir da rede de aplicações amplia muito o impacto.

## Correção

```yaml
authentication:
  anonymous: { enabled: false }
  webhook: { enabled: true }
authorization:
  mode: Webhook
readOnlyPort: 0
```

- Reiniciar os kubelets após a mudança.
- Restringir a porta 10250 por firewall/security group: acessível apenas pelo control plane.
- Tratar permissões RBAC em `nodes/proxy` como equivalentes a acesso amplo aos Pods do nó.

## Prevenção

- kube-bench nos nós no provisionamento e periodicamente.
- Nós em sub-redes privadas, com as portas de gerenciamento fechadas para as aplicações.
- Detecção em runtime de execução inesperada em containers.

Explore os controles no simulador de auditoria CIS (do módulo de Hardening) e o impacto no de recon externo.
