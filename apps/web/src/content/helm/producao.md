# Helm em produção

Saber usar o Helm é uma coisa; operar dezenas de releases com segurança é outra. Esta lição reúne as práticas que evitam incidentes.

## Como o upgrade trata o que mudou no cluster

Desde o Helm 3, o upgrade faz um **three-way merge** entre:

1. o manifesto da revisão atual (o que o Helm aplicou da última vez),
2. o **estado live** do objeto no cluster,
3. o manifesto novo.

Consequências práticas:

- Campos que estão no chart **são impostos**, mesmo que alguém os tenha mudado com `kubectl` — o hotfix manual é desfeito no próximo deploy.
- Campos que **saíram** do chart são **removidos** do objeto.
- Campos que o chart **nunca declarou** (um sidecar injetado pelo service mesh, annotations de outros controladores) são **preservados**.

O caso clássico: o chart define `replicas: 2` e existe um **HPA**. A cada deploy, o Helm volta o Deployment para 2 réplicas e o HPA precisa escalar de novo — no meio do pico. Solução: **não renderizar `replicas`** quando o autoscaling estiver ligado:

```yaml
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
```

> O Helm 4 pode aplicar os manifestos com **server-side apply**, em que o API server registra qual "gerente" é dono de cada campo. O princípio continua o mesmo: o que o chart declara, o chart controla.

## Upgrades seguros

```bash
helm diff upgrade loja ./loja -f values-prod.yaml     # plugin helm-diff: o que vai mudar?
helm upgrade --install loja ./loja -n loja \
  -f values.yaml -f values-prod.yaml \
  --atomic --timeout 10m --history-max 20
```

- **Veja o diff antes**, sempre. Em GitOps, o diff aparece no PR.
- `--atomic` (ou `--rollback-on-failure`, conforme a versão) desfaz automaticamente upgrades que não ficam saudáveis.
- `--timeout` compatível com o tempo real de rollout + hooks.
- Nunca rode dois upgrades da mesma release ao mesmo tempo: o Helm trava com `another operation (install/upgrade/rollback) is in progress`. Use `concurrency` no seu CI.
- Guarde histórico suficiente (`--history-max`) para rollback, mas não infinito (cada revisão é um Secret).

## CRDs

O diretório `crds/` só instala CRDs na **primeira** instalação — upgrades não as atualizam. Opções:

- Chart separado só com as CRDs em `templates/` (atualizadas normalmente, com `helm.sh/resource-policy: keep` para não serem removidas).
- Aplicar CRDs no pipeline (`kubectl apply --server-side -f crds/`) antes do `helm upgrade`.
- Operadores que gerenciam as próprias CRDs.

## Segredos

Nunca versione segredos em texto puro no `values-prod.yaml`:

- **External Secrets Operator** ou **Secrets Store CSI Driver**: o chart cria só a referência; o valor vem do cofre (Vault, AWS/GCP/Azure).
- **helm-secrets + SOPS**: arquivos de values criptografados no Git, decriptados no deploy.
- Lembre: o Helm guarda os values de cada revisão num Secret do namespace — quem pode ler Secrets ali pode ler seus values.

## GitOps e ferramentas de orquestração

| Ferramenta | Como usa o Helm |
| --- | --- |
| **Argo CD** | Renderiza com `helm template` e aplica; não cria releases do Helm (`helm list` fica vazio); mapeia hooks para sync hooks |
| **Flux** (`HelmRelease`) | Usa o SDK do Helm: releases reais, com histórico, testes e remediação automática |
| **helmfile** | Declara várias releases, values e ambientes num arquivo; `helmfile diff` / `helmfile apply` |
| **Terraform (provider helm)** | Releases como recursos de infraestrutura |

Escolha uma fonte da verdade: misturar `helm upgrade` manual com GitOps gera drift.

## Pós-renderização

`--post-renderer` passa o YAML renderizado por um programa antes de aplicar — o uso típico é o **Kustomize**, para ajustar charts de terceiros sem fork (adicionar labels, tolerations, sidecars).

## Checklist de um chart de produção

- `values.schema.json` para os values críticos.
- Probes, `resources`, `securityContext` e `PodDisruptionBudget` configuráveis, com padrões seguros.
- Selector com labels estáveis; `replicas` omitido quando há HPA.
- Checksum de ConfigMaps/Secrets na annotation do Pod.
- `helm test` significativo.
- NOTES.txt útil; README com a tabela de values (o `helm-docs` gera automaticamente).
- CI com lint, unittest, kubeconform e instalação real em kind.

No simulador, compare o resultado de um upgrade com three-way merge (Helm 3+) e two-way (Helm 2) em cenários reais de drift.
