# O Pod de "debug" que era dono do nó

## Contexto

Durante um incidente de rede meses atrás, um engenheiro criou um Pod de diagnóstico com `privileged: true`, `hostPID`, `hostNetwork` e o disco do nó montado via `hostPath: /`, para "ter todas as ferramentas". O incidente passou; o Pod ficou. Uma revisão de postura com o kubescape o encontrou — ainda rodando, com uma imagem pública sem versão fixa.

## Sintomas

```text
$ kubescape scan control C-0057,C-0038,C-0048 --include-namespaces default
C-0057  Privileged container                 failed: 1   (default/debug-tools)
C-0038  Host PID/IPC privileges              failed: 1   (default/debug-tools)
C-0048  HostPath mount                       failed: 1   (default/debug-tools)

$ kubectl get pod debug-tools -n default -o jsonpath='{.spec.containers[0].image}'
docker.io/someuser/netdebug:latest
```

O namespace `default` não tinha nenhum label de Pod Security.

<!-- solucao -->

## Investigação

A combinação de campos do Pod dá a qualquer processo dentro dele acesso irrestrito ao **nó**: todos os dispositivos (privileged), a visão e o controle de todos os processos do host (hostPID) e o sistema de arquivos inteiro (hostPath `/`) — incluindo credenciais do kubelet e dados de todos os outros Pods daquele nó. Quem comprometesse esse Pod (ou a imagem pública `:latest`, que pode mudar a qualquer momento) teria o nó, e do nó, um ponto de partida para o cluster.

O audit log confirmou que o Pod foi criado manualmente pelo usuário do engenheiro; não houve sinais de uso malicioso no período retido.

## Causa raiz

Nenhum controle impedia Pods privilegiados em namespaces de aplicação: sem Pod Security Admission configurado, o API server aceitou o Pod sem avisos. E não havia processo para remover acessos temporários de emergência.

## Correção

- Remover o Pod; por precaução, drenar e substituir o nó onde ele rodou.
- Rotular todos os namespaces de aplicação:
  ```yaml
  pod-security.kubernetes.io/enforce: baseline
  pod-security.kubernetes.io/warn: restricted
  pod-security.kubernetes.io/audit: restricted
  ```
- Para diagnósticos futuros: `kubectl debug node/<nó>` (efêmero, auditado e controlado por RBAC) ou um namespace dedicado `privileged` com acesso restrito a poucos administradores e expiração.

## Prevenção

- PSA em todos os namespaces (defaults do cluster via `AdmissionConfiguration`).
- Alertas de audit/runtime para Pods privilegiados, `hostPID` e `hostPath`.
- Scans de postura periódicos (kubescape, Trivy) com responsável e prazo.
- Acesso de emergência com prazo de validade e limpeza obrigatória no postmortem.

Avalie esse Pod no simulador de Pod Security com o preset "Pod de debug privilegiado".
