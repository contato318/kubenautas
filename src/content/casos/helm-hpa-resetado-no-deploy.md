# Cada deploy derruba a capacidade durante o pico

## Contexto

A `vitrine` usa HPA (mínimo 2, máximo 20 réplicas). Nos horários de pico ela roda com 15–18 réplicas. O time faz deploys várias vezes por dia e percebeu um padrão: **logo após cada deploy no horário de pico**, a latência dispara e aparecem erros 503 por alguns minutos.

## Sintomas

```text
14:02  HPA vitrine: 17 réplicas (CPU 62%)
14:05  helm upgrade vitrine ./chart --set image.tag=4.12.1
14:05  deployment/vitrine: replicas 17 → 2
14:05  HPA vitrine: CPU 390% — escalando 2 → 8
14:06  HPA vitrine: escalando 8 → 16
```

```yaml
# templates/deployment.yaml
spec:
  replicas: {{ .Values.replicaCount }}   # replicaCount: 2
```

<!-- solucao -->

## Investigação

O chart **declara** `spec.replicas: 2`. O HPA muda `spec.replicas` no cluster (live) para 17. No upgrade, o Helm 3 faz o merge em três vias entre o manifesto antigo (2), o estado live (17) e o manifesto novo (2): como o campo está declarado no chart, **o valor do chart é imposto**.

## Causa raiz

Dois donos para o mesmo campo: o chart e o HPA. A cada upgrade, o Helm "corrige" o que o HPA fez, derrubando a capacidade para 2 réplicas em pleno pico.

## Correção

Não renderizar `replicas` quando o autoscaling estiver ligado:

```yaml
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
```

Na primeira instalação sem o campo, o Deployment nasce com 1 réplica e o HPA ajusta para o mínimo em segundos. Após o upgrade que remove o campo, ele sai do manifesto e o HPA passa a ser o único dono.

## Prevenção

- Todo campo que outro controlador gerencia (replicas com HPA/KEDA, resources com VPA em modo Auto) deve ficar **fora** do chart.
- Revise o `helm diff` de deploys: uma linha `replicas: 17 → 2` é um alerta.
- O `helm create` já gera o template com esse `if` — mantenha-o.

Compare Helm 3 (3-way) e Helm 2 (2-way) no simulador de upgrade, cenário "HPA escalou".
