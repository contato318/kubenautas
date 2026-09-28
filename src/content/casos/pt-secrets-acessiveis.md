# Avaliação: credenciais de banco a um curl de distância

## Contexto

Num pentest de aplicação, o avaliador partiu de um Pod de frontend comprometido (autorizado). O objetivo: verificar se dados sensíveis estavam ao alcance daquele Pod.

## Sintomas

```text
# dentro do Pod autorizado
$ env | grep -i -E "pass|secret|key" | sed 's/=.*/=<oculto>/'
DB_PASSWORD=<oculto>
STRIPE_KEY=<oculto>

$ kubectl get configmap app-config -n loja -o yaml | grep -i url
  DATABASE_URL: postgres://app:<oculto>@db.loja:5432/app
```

<!-- solucao -->

## Investigação

Duas fontes de credenciais expostas:

1. **Variáveis de ambiente** com a senha do banco e a chave de um gateway, visíveis no ambiente do processo (`/proc/1/environ`), em dumps e para quem faz exec.
2. **ConfigMap** com a `DATABASE_URL` completa, incluindo a senha — um ConfigMap não é feito para segredos e é legível por qualquer identidade com `get configmaps`.

O avaliador registrou **os nomes** das credenciais e um hash parcial como evidência, **sem** copiar os valores nem acessar o banco, e comprovou que o frontend tinha as credenciais do banco de produção ao seu alcance.

## Causa raiz

Credenciais consumidas como variável de ambiente e guardadas em ConfigMap. Ambos deixam segredos legíveis em vários pontos, muito além de quem deveria.

## Correção

- Mover credenciais para **Secrets** e consumi-las como **arquivo montado** (tmpfs, `defaultMode: 0400`), não como env.
- Nunca guardar segredo em ConfigMap.
- Melhor: cofre externo (External Secrets/CSI) com credenciais dinâmicas e curtas.
- Como a exposição ocorreu durante o teste, **rotacionar** a senha do banco e a chave do gateway.

## Prevenção

- Scanners de segredos (Trivy, gitleaks) em imagens, repositórios e manifests.
- Regra de revisão: sem segredos em `env` literal nem em ConfigMap.
- RBAC restrito a `secrets` e `configmaps` sensíveis.

No simulador de descoberta de dados, veja cada esconderijo e a correção correspondente.
