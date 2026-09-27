# Pico de 502 a cada deploy

## Contexto

O e-commerce faz de 10 a 15 deploys por dia. Toda vez, o monitoramento do Ingress registra uma rajada de **502 Bad Gateway** e alguns **503** por 10 a 20 segundos. O time passou a evitar deploys em horário comercial.

## Sintomas

```text
# logs do ingress-nginx durante o rollout
upstream prematurely closed connection while reading response header from upstream
connect() failed (111: Connection refused) while connecting to upstream, upstream: "10.42.3.17:8080"
```

```yaml
# trecho do Deployment
spec:
  strategy:
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    spec:
      containers:
        - name: vitrine
          image: vitrine:4.12.0
          ports:
            - containerPort: 8080
          # sem readinessProbe, sem preStop
```

<!-- solucao -->

## Investigação

Dois problemas diferentes aparecem no mesmo sintoma:

1. **Tráfego chegando cedo demais.** Sem readiness probe, o Pod novo entra nos endpoints assim que o container inicia — antes de a aplicação abrir a porta 8080. Resultado: `Connection refused` (502).
2. **Tráfego chegando tarde demais.** Ao remover um Pod antigo, o Kubernetes faz duas coisas **em paralelo**: envia SIGTERM ao container e o remove dos endpoints. O Ingress Controller e o kube-proxy levam alguns segundos para perceber a remoção. Nesse intervalo, requisições ainda são enviadas a um Pod que já encerrou as conexões: `upstream prematurely closed` (502).

## Causa raiz

Ausência de **readiness probe** e de um **encerramento gracioso** que considere a propagação eventual dos endpoints.

## Correção

```yaml
spec:
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: vitrine
          readinessProbe:
            httpGet: { path: /healthz/ready, port: 8080 }
            periodSeconds: 5
          lifecycle:
            preStop:
              sleep:
                seconds: 10   # (1.30+) ou exec: ["sleep", "10"]
```

- O `preStop` segura o SIGTERM por 10 s enquanto os endpoints são atualizados em todo o cluster.
- A aplicação deve tratar o SIGTERM: parar de aceitar conexões novas e terminar as que estão em andamento.
- `terminationGracePeriodSeconds` precisa cobrir o `preStop` **mais** o tempo de drenagem da aplicação.

## Prevenção

- Readiness probe obrigatória (política via admission, ex.: Kyverno).
- Teste de carga contínuo durante um rollout em homologação: 0 erros é o critério.
- SLO de erros por deploy acompanhado no painel do CD.

Veja o efeito da readiness e do `maxUnavailable` no simulador de rolling update.
