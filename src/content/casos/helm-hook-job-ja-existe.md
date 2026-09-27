# Deploy bloqueado por um Job de migração que "já existe"

## Contexto

A `loja` roda migrações de banco num hook `pre-upgrade`. Na terça, uma migração falhou (lock no banco) e o deploy foi abortado. O DBA liberou o lock, mas agora **nenhum** deploy passa — nem os que não têm migração nova.

## Sintomas

```text
$ helm upgrade loja ./chart -n loja -f values-prod.yaml
Error: UPGRADE FAILED: pre-upgrade hooks failed: 1 error occurred:
	* jobs.batch "loja-migrate" already exists
```

```yaml
# templates/migrate-job.yaml
metadata:
  name: loja-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-delete-policy": hook-succeeded
```

<!-- solucao -->

## Investigação

```text
$ kubectl get jobs -n loja
NAME           COMPLETIONS   DURATION   AGE
loja-migrate   0/1           10m        2d

$ kubectl logs job/loja-migrate -n loja | tail -1
ERROR: could not obtain lock on relation "pedidos"
```

## Causa raiz

A política `hook-succeeded` apaga o Job **só quando ele tem sucesso**. O Job de terça falhou e **ficou no cluster**. A cada novo deploy, o Helm tenta criar um Job com o mesmo nome e a API recusa: *already exists*. A anotação personalizada também substituiu o padrão (`before-hook-creation`), que teria apagado o Job antigo antes de criar o novo.

## Correção

```bash
kubectl delete job loja-migrate -n loja       # destrava agora
```

E no chart, a combinação recomendada:

```yaml
annotations:
  "helm.sh/hook": pre-install,pre-upgrade
  "helm.sh/hook-weight": "-5"
  "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```

Assim o Job falho fica disponível para investigação, mas não bloqueia a próxima execução.

## Prevenção

- Sempre inclua `before-hook-creation` em hooks que rodam mais de uma vez.
- `backoffLimit` e `activeDeadlineSeconds` explícitos para falhar rápido.
- Migrações idempotentes e com timeout de lock no próprio banco.

Reproduza no simulador de hooks com a política "hook-succeeded (apenas)".
