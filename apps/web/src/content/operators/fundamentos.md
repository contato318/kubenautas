# Extensões da API e o padrão Operator

O Kubernetes não é só um orquestrador de containers: é uma **plataforma de APIs declarativas**. Deployments, Services e Jobs são tipos que já vêm com ele. **CustomResourceDefinitions (CRDs)** permitem adicionar tipos novos — `Database`, `Certificate`, `KafkaTopic` — que se comportam como os nativos: `kubectl get`, RBAC, `watch`, validação, auditoria.

Um tipo novo, sozinho, só guarda dados. Quem dá **comportamento** a ele é um **controller**. A combinação *CRD + controller que codifica o conhecimento operacional de um sistema* é o que chamamos de **Operator**.

## Controllers e o loop de reconciliação

Todo controller do Kubernetes segue o mesmo padrão:

```
observar o estado desejado (spec)  →  observar o estado real  →  agir sobre a diferença  →  registrar o resultado (status)  →  repetir
```

O controller de ReplicaSet faz isso com Pods; o seu operator fará com o que o seu CRD representa (bancos, filas, certificados, DNS, contas na nuvem…).

### Level-triggered, não edge-triggered

Um sistema **edge-triggered** reage a *eventos* ("réplicas passou de 2 para 3 → crie 1 Pod"). Se perder um evento, fica errado para sempre.

Um sistema **level-triggered** reage ao *estado* ("devem existir 3, existem 2 → crie 1"). Se perder eventos, reiniciar ou receber eventos duplicados, a próxima reconciliação corrige. Controllers do Kubernetes usam eventos apenas como **gatilho** para reconciliar — a decisão é sempre tomada comparando estados.

Consequências práticas:

- O reconcile deve ser **idempotente**: rodar duas vezes com o mesmo estado não pode criar nada em dobro.
- O operator deve tolerar reinícios a qualquer momento (inclusive no meio de uma operação).
- Não guarde estado importante só em memória: ele está no cluster (spec, status, anotações) ou no sistema externo.

## CRD × ConfigMap × API agregada

| Opção | Quando usar |
| --- | --- |
| **ConfigMap** | Configuração de uma aplicação, sem validação nem ciclo de vida próprio |
| **CRD** | Um tipo novo com schema, versões, RBAC e `kubectl` — a escolha padrão |
| **API agregada** (APIService) | Armazenamento próprio, semântica não-CRUD, subrecursos customizados (ex.: metrics-server) |

Sinais de que você quer um CRD: o objeto tem ciclo de vida, outras pessoas vão criá-lo declarativamente (GitOps), e você quer `status` observável.

## Operator: níveis de maturidade

Um jeito comum de pensar a evolução de um operator:

1. **Instalação básica** — cria os recursos a partir do CR.
2. **Upgrades** — muda versões sem perda de dados.
3. **Ciclo de vida completo** — backup, restore, recuperação de falhas.
4. **Insights** — métricas, alertas, eventos úteis.
5. **Piloto automático** — escala, ajuste e correção sem intervenção.

Comece pelo nível 1 bem feito: idempotente, com status claro e limpeza correta.

## Onde entra o Kopf

Existem vários frameworks: **controller-runtime/Kubebuilder** e **Operator SDK** (Go), **Java Operator SDK**, **kube-rs** (Rust) e **Kopf** (Python). O **Kopf** (Kubernetes Operator Pythonic Framework) deixa você escrever handlers como funções Python decoradas:

```python
import kopf

@kopf.on.create('db.exemplo.com', 'v1', 'databases')
def criar(spec, name, namespace, logger, **_):
    logger.info(f"Criando banco {name} com engine {spec['engine']}")
    return {'phase': 'Provisioning'}
```

O Kopf cuida do watch, dos retries, do registro de progresso, dos finalizers e do peering entre réplicas. Você foca na lógica. Nas próximas lições vamos desenhar o CRD `Database` e escrever o operator que o gerencia.

## Quando **não** escrever um operator

- Um Helm chart ou Kustomize resolve (só templating, sem lógica em tempo de execução).
- Um operator maduro já existe (CloudNativePG, Strimzi, cert-manager, Prometheus Operator…).
- O "controller" seria um CronJob que roda um script — às vezes isso basta.

Operators são software em produção com acesso privilegiado ao cluster: exigem testes, versionamento, observabilidade e plantão.

No simulador, pare o operador, mude a spec várias vezes, apague Pods e religue: ele converge sem precisar dos eventos que perdeu.
