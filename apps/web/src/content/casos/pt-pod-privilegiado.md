# Avaliação: namespace sem Pod Security

## Contexto

O avaliador, partindo de um token com `create pods` no namespace `dados` (autorizado no escopo), avaliou se seria possível sair do isolamento do container e alcançar o nó.

## Sintomas

```text
$ kubectl get ns dados -o jsonpath='{.metadata.labels}'
{"kubernetes.io/metadata.name":"dados"}      # nenhum label pod-security.kubernetes.io/*

$ kubectl auth can-i create pods -n dados
yes
```

Nenhum rótulo de Pod Security no namespace — nada impediria um Pod privilegiado.

<!-- solucao -->

## Investigação

Sem Pod Security Admission, o namespace aceitaria um Pod com `privileged: true`, `hostPID` e `hostPath: /` — o que dá acesso ao sistema de arquivos e aos processos do nó. O avaliador **comprovou a ausência do controle** analisando os labels e validando, num Pod de teste **inócuo** e temporário (sem privilégios reais de dano, removido em seguida), que a admission não rejeitava campos perigosos. Não executou uma fuga real em produção; documentou o **alcance** (container → nó → outros Pods do nó).

## Causa raiz

Namespace de aplicação **sem Pod Security Admission**. Combinado com `create pods`, isso é um caminho direto do namespace para o nó — e, do nó, para credenciais de outros Pods e do kubelet.

## Correção

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

- Aplicar em todos os namespaces de aplicação (defaults do cluster via `AdmissionConfiguration`).
- Evoluir para `enforce: restricted` onde as aplicações já estejam prontas.
- Reduzir também o RBAC que concede `create pods` a quem não precisa.

## Prevenção

- kubescape/kubeaudit para listar namespaces sem Pod Security e Pods perigosos.
- Política de admission que exija os labels de Pod Security em novos namespaces.
- Diagnósticos via `kubectl debug node`, controlado por RBAC, em vez de Pods privilegiados.

No simulador de blast radius do workload, monte um Pod com esses campos e veja o alcance chegar ao cluster.
