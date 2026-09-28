# Avaliação: a ServiceAccount default com poderes

## Contexto

Ao enumerar as permissões disponíveis a partir de vários Pods (assumed breach autorizado), o avaliador notou que todos os Pods de um namespace usavam a ServiceAccount `default` — e que ela tinha permissões inesperadas.

## Sintomas

```text
$ kubectl get pods -n loja -o custom-columns=POD:.metadata.name,SA:.spec.serviceAccountName
POD                 SA
api-7d9f-x2k        default
worker-5c7-abc      default
frontend-9b2-def    default

$ kubectl auth can-i --list --as=system:serviceaccount:loja:default -n loja | grep -i secret
secrets   []   []   [get list watch]
```

<!-- solucao -->

## Investigação

Havia um RoleBinding concedendo leitura de Secrets à SA `default`. Como **todo Pod que não especifica uma ServiceAccount usa a `default`**, todos os workloads do namespace herdaram essa permissão — inclusive um frontend que não deveria falar com a API. Qualquer Pod comprometido no namespace leria os Secrets.

O avaliador comprovou enumerando as permissões da `default` (via impersonação autorizada) e registrando os nomes dos Secrets alcançáveis, sem copiar valores.

## Causa raiz

Uso da ServiceAccount `default` para workloads, somado a um binding de permissões nela. A `default` é compartilhada por tudo no namespace; permissões nela se espalham para todos os Pods.

## Correção

- Uma **ServiceAccount por aplicação**, com o mínimo de permissões.
- Remover bindings da `default`; desativar o token dela (`automountServiceAccountToken: false` na SA `default`).
- Frontends e workers sem nenhuma permissão de API, quando não precisam.

## Prevenção

- Política de admission que exija `serviceAccountName` explícito (proibir uso implícito da `default`).
- Revisão de RBAC procurando bindings à `default`.
- rbac-tool/kubescape para mapear permissões efetivas por SA.

No simulador de enumeração com token, veja como a leitura de Secrets amplia o alcance da avaliação.
