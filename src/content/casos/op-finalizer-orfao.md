# Bancos que não morrem

## Contexto

O time decidiu trocar o operador interno de bancos por um operador da comunidade. Numa sexta, rodaram `helm uninstall db-operator` e em seguida tentaram apagar os objetos `Database` antigos e o namespace `db-legado`. Na segunda, tudo continuava lá.

## Sintomas

```text
$ kubectl get databases -A
NAMESPACE   NAME       AGE
db-legado   pedidos    412d
db-legado   estoque    390d

$ kubectl get ns db-legado
NAME        STATUS        AGE
db-legado   Terminating   2d

$ kubectl delete database pedidos -n db-legado
database.db.exemplo.com "pedidos" deleted
^C        ← o comando fica esperando para sempre
```

<!-- solucao -->

## Investigação

```text
$ kubectl get database pedidos -n db-legado -o jsonpath='{.metadata.deletionTimestamp}{"\n"}{.metadata.finalizers}'
2026-09-25T18:40:02Z
["kopf.zalando.org/KopfFinalizerMarker"]

$ kubectl get deploy -n db-system
No resources found in db-system namespace.
```

## Causa raiz

O operador Kopf tinha um `@kopf.on.delete` (que removia backups e usuários na nuvem). Por isso, cada `Database` recebia o finalizer `kopf.zalando.org/KopfFinalizerMarker`. Com o operador desinstalado **antes** dos objetos, ninguém executa o handler nem remove o finalizer: os objetos ficam com `deletionTimestamp` para sempre, e o namespace espera por eles.

## Correção

Duas opções:

1. **Com limpeza** (preferível): reinstalar temporariamente o operador antigo, deixar os `on.delete` rodarem, e só então desinstalá-lo.
2. **Sem limpeza** (consciente de que backups e usuários externos ficarão órfãos): remover o finalizer à mão e limpar o externo manualmente.
   ```bash
   kubectl patch database pedidos -n db-legado --type=merge -p '{"metadata":{"finalizers":null}}'
   ```

## Prevenção

- Runbook de desinstalação: **CRs → operador → CRD**, nessa ordem.
- Hook `pre-delete` no chart do operador que se recusa a desinstalar enquanto existirem CRs (ou que os apaga e espera).
- Considerar `@kopf.on.delete(optional=True)` quando a limpeza externa não for crítica — sem finalizer, remoções nunca travam.

Veja no simulador de finalizers o efeito de "Operador rodando" desligado com o `on.delete` registrado.
