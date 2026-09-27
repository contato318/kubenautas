# Probes: liveness, readiness e startup

O kubelet sabe se o **processo** está rodando, mas não se a **aplicação** está saudável. Um servidor travado em deadlock continua "Running". As probes resolvem isso.

## Os três tipos

| Probe | Pergunta | Se falhar… |
|-------|----------|-----------|
| **startupProbe** | "Já terminou de iniciar?" | Container é reiniciado. Enquanto não passa, as outras probes ficam desligadas |
| **livenessProbe** | "Está vivo ou travou?" | Container é **reiniciado** |
| **readinessProbe** | "Pode receber tráfego agora?" | Pod é **removido dos endpoints** do Service (não reinicia) |

## Mecanismos

```yaml
livenessProbe:
  httpGet:              # sucesso = HTTP 200-399
    path: /healthz
    port: 8080
readinessProbe:
  tcpSocket:            # sucesso = conexão TCP aceita
    port: 5432
startupProbe:
  exec:                 # sucesso = exit code 0
    command: ["cat", "/tmp/ready"]
# também existe: grpc: { port: 9090 }
```

## Parâmetros de tempo

```yaml
readinessProbe:
  httpGet: { path: /ready, port: 8080 }
  initialDelaySeconds: 5   # espera antes da primeira checagem
  periodSeconds: 10        # intervalo entre checagens
  timeoutSeconds: 2        # tempo máximo de resposta
  failureThreshold: 3      # falhas seguidas para considerar "falhou"
  successThreshold: 1      # sucessos seguidos para voltar a "ok"
```

Tempo até a ação ≈ `initialDelaySeconds + periodSeconds × failureThreshold`.

## Boas práticas (e armadilhas)

- **Liveness não deve checar dependências externas.** Se o banco cair e a liveness depender dele, o Kubernetes vai reiniciar **todas** as réplicas em loop — transformando um incidente em catástrofe. Liveness verifica só se o *próprio processo* responde.
- **Readiness pode checar dependências** essenciais: se não consegue atender, melhor sair do balanceamento.
- Apps de **inicialização lenta** (JVM, carregar modelo de ML): use **startupProbe** com `failureThreshold × periodSeconds` generoso, em vez de um `initialDelaySeconds` enorme na liveness.
- Sem readiness probe, o Pod recebe tráfego assim que o container inicia — causa erros 502 em rollouts.
- Endpoints de health devem ser **baratos** e rápidos.

## Encerramento gracioso

Quando um Pod é deletado:
1. Ele entra em `Terminating` e é removido dos endpoints (em paralelo!).
2. O hook `preStop` roda (se houver).
3. O container recebe **SIGTERM**.
4. Após `terminationGracePeriodSeconds` (padrão 30s), recebe **SIGKILL**.

Como a remoção dos endpoints é assíncrona, é comum adicionar um `preStop` com `sleep 5` para evitar que requisições cheguem a um Pod que já está desligando. A aplicação deve tratar SIGTERM: parar de aceitar conexões, terminar as em andamento e sair.

**No simulador**: quebre a liveness e a readiness de um Pod e observe o comportamento diferente de cada uma, incluindo o CrashLoopBackOff.
