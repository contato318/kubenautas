# Avaliação: Dashboard publicado sem autenticação

## Contexto

O reconhecimento externo de um pentest autorizado encontrou um subdomínio `k8s.empresa.com` que servia o Kubernetes Dashboard. O avaliador foi verificar a autenticação e as permissões associadas.

## Sintomas

```text
$ curl -s -o /dev/null -w "%{http_code}\n" https://k8s.empresa.com/
200

# a tela de login oferecia a opção "Skip"; ao usá-la, a interface carregava recursos do cluster
```

<!-- solucao -->

## Investigação

O Dashboard estava exposto na internet, com o botão **"Skip"** habilitado, e sua ServiceAccount vinculada a um papel amplo. Ao "pular" o login, a interface operava com as permissões da ServiceAccount do próprio Dashboard.

```text
$ kubectl get clusterrolebinding kubernetes-dashboard -o jsonpath='{.roleRef.name}'
cluster-admin
```

O avaliador confirmou o acesso à interface e as permissões do binding (evidência), sem realizar ações administrativas — documentando o achado como **crítico**: qualquer visitante teria controle total do cluster.

## Causa raiz

Três fatores somados: Dashboard **exposto publicamente**, **sem autenticação** (skip login) e com a ServiceAccount em **cluster-admin**. É a mesma cadeia de vários incidentes reais de mineração.

## Correção

- Remover a exposição pública; acessar o Dashboard apenas via `kubectl port-forward` ou atrás de SSO.
- Usar o **token do próprio usuário** (o Dashboard não deve ter permissões próprias amplas); remover o binding `cluster-admin`.
- Revisar o cluster em busca de recursos criados por acesso indevido.

## Prevenção

- Nenhuma ferramenta administrativa exposta na internet.
- Admission bloqueando Services `LoadBalancer`/Ingress para ferramentas fora de namespaces aprovados.
- Alertas para bindings de `cluster-admin`.

Analise o binding no simulador de risco de RBAC (marque "* em *") e a exposição no de recon externo.
