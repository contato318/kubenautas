# Avaliação encontra API respondendo sem credencial

## Contexto

Num pentest autorizado (gray box) de um cluster de homologação, o avaliador recebeu apenas a faixa de IPs em escopo e uma autorização assinada. A primeira fase — reconhecimento — buscava responder: o cluster entrega algo sem nenhuma credencial?

## Sintomas

```text
$ curl -sk https://10.20.0.10:6443/version
{"major":"1","minor":"31","gitVersion":"v1.31.4", ...}

$ curl -sk https://10.20.0.10:6443/api/v1/namespaces/loja/pods | head -c 60
{"kind":"PodList","apiVersion":"v1","items":[{"metadata":{"name":"api-...
```

A listagem de Pods respondeu **sem nenhum token**.

<!-- solucao -->

## Investigação

O avaliador confirmou, com o cliente, que estava usando uma requisição anônima. A causa apareceu nos bindings:

```text
$ kubectl get clusterrolebindings -o json | jq -r '.items[]
    | select(.subjects[]?.name=="system:anonymous") | .metadata.name + " → " + .roleRef.name'
anon-view → view
```

Alguém, ao seguir um tutorial, vinculou `system:anonymous` ao papel `view` para "facilitar um dashboard sem login". Com `--anonymous-auth=true` (padrão), qualquer requisição sem token vira `system:anonymous` — e o binding deu a ela leitura de todo o cluster.

## Causa raiz

Binding acidental de um sujeito **não autenticado** a um papel de leitura amplo. O acesso anônimo em si não concede nada; foi o binding que abriu a porta. Como `view` permite ler muitos recursos, o achado é **alto** — e seria crítico se o papel incluísse leitura de Secrets ou escrita.

## Correção

- Remover o ClusterRoleBinding `anon-view`.
- Restringir o acesso anônimo aos endpoints de saúde (`AuthenticationConfiguration`) ou desligar `--anonymous-auth`, avaliando o impacto em health checks.
- Publicar o dashboard atrás de SSO, com o token do próprio usuário.
- Colocar o API server em rede privada / lista de IPs autorizados.

## Prevenção

- Varredura periódica de bindings a `system:anonymous`, `system:unauthenticated` e papéis amplos em `system:authenticated`.
- Revisão obrigatória de qualquer `kubectl apply` que crie ClusterRoleBindings.
- Política de admission que bloqueie bindings a sujeitos anônimos.

Reproduza no simulador de acesso anônimo, ligando o binding de `system:anonymous` a um papel de leitura.
