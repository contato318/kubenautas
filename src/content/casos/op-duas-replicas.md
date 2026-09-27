# Cada banco novo aparece duas vezes na nuvem

## Contexto

Para "ter alta disponibilidade", o time aumentou o Deployment do operador de bancos (Kopf) de 1 para 2 réplicas. Na semana seguinte, o time de FinOps notou o dobro de instâncias de banco gerenciado na conta da nuvem — metade delas sem nenhum CR correspondente.

## Sintomas

```text
$ aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier'
[ "loja-pedidos-7f3a", "loja-pedidos-c91e", "loja-estoque-2b8d", "loja-estoque-e04f" ]

$ kubectl get database pedidos -n loja -o jsonpath='{.status.criar.instance}'
loja-pedidos-c91e
```

Nos logs, ambas as réplicas executam o mesmo handler para o mesmo objeto, com milissegundos de diferença.

<!-- solucao -->

## Investigação

```text
$ kubectl logs db-operator-6d8f7c9b5-a1 -n db-system | head -3
[WARNING] Default peering object is not found, falling back to the standalone mode.
$ kubectl logs db-operator-6d8f7c9b5-b2 -n db-system | head -3
[WARNING] Default peering object is not found, falling back to the standalone mode.

$ kubectl get crd | grep kopf
(nada)
```

O handler gera o identificador da instância com um sufixo aleatório.

## Causa raiz

Sem os CRDs de peering do Kopf instalados, cada réplica funciona em **modo standalone** e processa todos os eventos. As duas réplicas chamaram o `on.create` ao mesmo tempo; cada uma criou uma instância com nome aleatório diferente, e a última a gravar o status "venceu" — a outra instância ficou órfã (e sendo cobrada).

## Correção

- Instalar os CRDs de peering e rodar com `--peering` (a réplica de menor prioridade pausa: `Pausing operations in favour of …`), **ou** voltar para 1 réplica com `strategy: Recreate`.
- Identificar e remover as instâncias órfãs (as que não aparecem em nenhum `status`).
- Tornar o handler idempotente: nome **determinístico** derivado do CR (`{namespace}-{name}` ou do `uid`) e `get_or_create`.

## Prevenção

- Nunca escalar um operador sem mecanismo de eleição/peering.
- Nomes determinísticos para recursos externos: duas execuções concorrentes colidem em vez de duplicar.
- Tags nos recursos externos com o `uid` do CR, e um job que compara recursos da nuvem com os CRs existentes.

Veja no simulador "Operator em produção": 2 réplicas com peering "sem CRDs" e com "CRDs instalados".
