# API lenta com CPU "sobrando"

## Contexto

A API `precos` (Go) tem p99 de latência de 900 ms nos horários de pico. O gráfico de CPU mostra uso médio de **30% do limit**. Aumentar réplicas ajudou pouco. "Não pode ser CPU", diz o time.

## Sintomas

```yaml
resources:
  requests:
    cpu: 250m
  limits:
    cpu: 500m
```

```promql
# Fração de períodos de 100ms em que o container foi estrangulado
sum(rate(container_cpu_cfs_throttled_periods_total{container="precos"}[5m]))
/
sum(rate(container_cpu_cfs_periods_total{container="precos"}[5m]))
```

Resultado: **0,62** — o container é estrangulado em 62% dos períodos, apesar do uso médio baixo.

<!-- solucao -->

## Investigação

O limit de CPU é implementado pela **CFS quota** do kernel: com `500m`, o container pode usar 50 ms de CPU a cada período de 100 ms. Se gastar a cota antes, fica **parado até o próximo período**.

Uma aplicação multithread recebe uma rajada de requisições: 8 threads rodando em paralelo consomem os 50 ms de cota em pouco mais de 6 ms. As threads ficam paradas por ~94 ms — a requisição que estava no meio sofre essa espera. A média de uso no minuto continua baixa, porque o container ficou ocioso a maior parte do tempo.

Agravante em Go: o runtime detecta **todos os núcleos do nó** (ex.: 16) para `GOMAXPROCS`, criando mais paralelismo do que a cota comporta.

## Causa raiz

**Throttling por limit de CPU** em uma carga com rajadas e muito paralelismo. A métrica de uso médio esconde o problema; a métrica de períodos estrangulados revela.

## Correção

- Aumente o limit de CPU — ou **remova-o** e mantenha um request realista (a CPU extra do nó é dividida proporcionalmente aos requests).
- Ajuste o paralelismo ao que o container pode usar: em Go, `GOMAXPROCS` alinhado à cota (a partir do Go 1.25 isso é automático; em versões anteriores use `go.uber.org/automaxprocs`); em Java, pools de threads configurados.

```yaml
resources:
  requests:
    cpu: 500m      # o que a app realmente precisa no pico
  # sem limit de CPU (mantenha o de memória)
```

## Prevenção

- Dashboards com **throttling**, não só uso de CPU.
- Política clara para limits de CPU: evite em serviços sensíveis a latência; use ResourceQuota para conter abusos.
- Teste de carga com rajadas, não apenas carga média.
