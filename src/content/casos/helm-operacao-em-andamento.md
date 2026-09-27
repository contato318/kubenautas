# "another operation is in progress" em todo deploy

## Contexto

O job de deploy da `loja` foi cancelado no meio de um `helm upgrade` (alguém clicou em "cancel" no CI, que matou o processo). Desde então, **todo** deploy falha na hora, e a aplicação continua na versão anterior.

## Sintomas

```text
$ helm upgrade --install loja ./chart -n loja -f values-prod.yaml
Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress

$ helm list -n loja
NAME   NAMESPACE   REVISION   STATUS   CHART
(vazio)
```

Os Pods estão rodando normalmente.

<!-- solucao -->

## Investigação

`helm list` esconde releases pendentes por padrão. O histórico mostra o problema:

```text
$ helm history loja -n loja
REVISION  STATUS           CHART        DESCRIPTION
41        superseded       loja-1.8.0   Upgrade complete
42        deployed         loja-1.8.1   Upgrade complete
43        pending-upgrade  loja-1.9.0   Preparing upgrade
```

## Causa raiz

O Helm grava a revisão 43 como `pending-upgrade` **antes** de aplicar e só a atualiza no fim. Com o processo morto no meio, ninguém marcou o fim. Toda nova operação vê uma revisão pendente e se recusa a continuar, para não corromper o estado.

## Correção

```bash
# Volte para a última revisão boa (cria a revisão 44 com o conteúdo da 42)
helm rollback loja 42 -n loja

# Em seguida, o deploy volta a funcionar
helm upgrade --install loja ./chart -n loja -f values-prod.yaml --atomic --timeout 10m
```

Último recurso, se o rollback não for possível: apagar o Secret da revisão pendente (`sh.helm.release.v1.loja.v43`) — com cuidado e sabendo o que está fazendo.

## Prevenção

- No CI, serialize deploys por release (`concurrency` no GitHub Actions / GitLab `resource_group`).
- `--timeout` compatível com o tempo real do rollout, para o próprio Helm encerrar com limpeza.
- `--atomic` para que falhas terminem em estado consistente.
- Evite cancelar jobs de deploy; se precisar, verifique `helm history` logo depois.
- Monitore releases em `pending-*` há mais de alguns minutos.

Reproduza no simulador de ciclo de vida com o botão "upgrade interrompido".
