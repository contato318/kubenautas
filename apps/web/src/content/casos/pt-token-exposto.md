# Avaliação: token de aplicação com permissões amplas

## Contexto

No modelo *assumed breach*, o cliente autorizou o avaliador a partir de um Pod de uma aplicação web (simulando um RCE já explorado). A tarefa: medir até onde a identidade daquele Pod alcança.

## Sintomas

```text
# dentro do Pod autorizado para o teste
$ ls /var/run/secrets/kubernetes.io/serviceaccount/
ca.crt  namespace  token

$ kubectl auth can-i --list 2>/dev/null | head
Resources        Non-Resource URLs   Resource Names   Verbs
secrets          []                  []               [get list]
pods             []                  []               [get list create]
serviceaccounts/token  []            []               [create]
```

<!-- solucao -->

## Investigação

O token da ServiceAccount `web` estava montado (automount não desativado) e a SA tinha permissões muito além do necessário para um frontend: `list secrets`, `create pods` e `create serviceaccounts/token`. O avaliador **enumerou** as permissões e comprovou o impacto de forma mínima — registrou o **nome** dos Secrets acessíveis, sem copiar conteúdo, e não criou Pods em produção.

Cada permissão foi documentada como um caminho:

- `list secrets` → leitura de credenciais do namespace (alto impacto).
- `create pods` → montar qualquer Secret / usar qualquer SA do namespace.
- `create serviceaccounts/token` → emitir tokens de SAs mais privilegiadas.

## Causa raiz

RBAC excessivo numa ServiceAccount de aplicação, combinado com o token montado por padrão. Um frontend não precisa falar com a API do Kubernetes — muito menos ler Secrets ou criar Pods.

## Correção

- **Desativar o token**: `automountServiceAccountToken: false` na SA e no Pod.
- Reduzir o Role ao mínimo (idealmente, nenhuma permissão na API para um frontend).
- Uma ServiceAccount **por aplicação**, nunca a `default`.
- Se a app precisa de um segredo, montá-lo como arquivo, sem permissão de API.

## Prevenção

- rbac-tool/KubiScan para encontrar SAs com permissões arriscadas.
- Revisão de RBAC de novas aplicações no pipeline.
- Alertas para `create serviceaccounts/token` e leitura de Secrets por SAs de aplicação.

No simulador de enumeração com token, marque essas permissões e veja o alcance da avaliação.
