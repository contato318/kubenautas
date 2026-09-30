# Depois de reinstalar, a aplicação não autentica no PostgreSQL

## Contexto

No ambiente de homologação, alguém rodou `helm uninstall loja` e `helm install loja` para "começar do zero". O chart inclui o PostgreSQL como dependência, com senha gerada automaticamente. A aplicação agora não conecta ao banco.

## Sintomas

```text
$ kubectl logs deploy/loja-api -n loja-hml
FATAL: password authentication failed for user "loja"

$ kubectl get pvc -n loja-hml
NAME                          STATUS   VOLUME        CAPACITY   AGE
data-loja-postgresql-0        Bound    pvc-7f3a…     8Gi        94d
```

O Secret do banco foi recriado há 10 minutos; o PVC tem 94 dias.

<!-- solucao -->

## Investigação

```text
$ kubectl get secret loja-postgresql -n loja-hml -o jsonpath='{.metadata.creationTimestamp}'
2026-09-27T14:02:11Z

$ kubectl logs loja-postgresql-0 -n loja-hml | head -3
PostgreSQL Database directory appears to contain a database; Skipping initialization
```

## Causa raiz

1. `helm uninstall` **não apaga os PVCs** criados por `volumeClaimTemplates` de StatefulSets — os dados (e a senha antiga, gravada dentro do banco) sobreviveram.
2. O `helm install` gerou uma **senha nova** e a gravou no Secret.
3. O PostgreSQL encontrou o diretório de dados existente, **pulou a inicialização** e manteve a senha antiga. Secret e banco agora discordam.

## Correção

Escolha uma:

- **Manter os dados**: coloque a senha antiga no Secret (recuperando-a de um backup ou do cofre) ou altere a senha do usuário dentro do banco para a nova.
- **Começar do zero de verdade**: apague também o PVC (`kubectl delete pvc data-loja-postgresql-0 -n loja-hml`) e reinstale.

## Prevenção

- **Nunca** deixe senhas de banco serem geradas aleatoriamente a cada instalação: defina-as explicitamente ou use um Secret existente (`auth.existingSecret`) gerenciado por External Secrets.
- Documente que `helm uninstall` preserva PVCs (e recursos com `helm.sh/resource-policy: keep`).
- Charts que geram senhas deveriam reaproveitar o Secret existente via `lookup` — verifique o comportamento do chart que você usa.
