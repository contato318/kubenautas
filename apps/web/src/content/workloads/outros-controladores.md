# StatefulSets, DaemonSets, Jobs e CronJobs

Deployment é ótimo para apps stateless, mas nem toda carga é igual.

## StatefulSet

Para aplicações que precisam de **identidade estável**: bancos de dados, Kafka, Zookeeper, Elasticsearch.

| Característica | Deployment | StatefulSet |
|----------------|-----------|-------------|
| Nome dos Pods | aleatório (`web-7d9c8b-x2k4`) | ordinal e fixo (`db-0`, `db-1`, `db-2`) |
| Ordem de criação | paralela | sequencial: `db-0` pronto → `db-1` … |
| Armazenamento | normalmente compartilhado ou nenhum | **um PVC por Pod** via `volumeClaimTemplates` |
| DNS | via Service | cada Pod tem DNS próprio: `db-0.db-headless.ns.svc.cluster.local` |

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db-headless     # Service headless (clusterIP: None)
  replicas: 3
  selector:
    matchLabels: { app: db }
  template:
    metadata:
      labels: { app: db }
    spec:
      containers:
        - name: postgres
          image: postgres:16
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

Se `db-1` morrer, ele volta como `db-1`, **reconectado ao mesmo PVC**. Deletar o StatefulSet **não** deleta os PVCs (proteção de dados).

> Rodar banco em Kubernetes é possível, mas considere **Operators** (CloudNativePG, Strimzi) ou serviços gerenciados.

## DaemonSet

Garante **um Pod por nó** (ou por nós selecionados). Quando um nó entra no cluster, recebe o Pod automaticamente.

Casos de uso: coletores de log (Fluent Bit), agentes de monitoramento (node-exporter, Datadog), plugins de rede (Cilium, Calico), kube-proxy.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels: { app: node-exporter }
  template:
    metadata:
      labels: { app: node-exporter }
    spec:
      tolerations:
        - operator: Exists       # roda até em nós com taint (ex.: control plane)
      containers:
        - name: exporter
          image: prom/node-exporter
```

## Job

Executa uma tarefa **até completar**. Útil para migrações, processamento em lote, backups.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
spec:
  completions: 1
  parallelism: 1
  backoffLimit: 4                 # tentativas antes de marcar como Failed
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600   # limpa o Job depois de 1h
  template:
    spec:
      restartPolicy: OnFailure    # Jobs não aceitam Always
      containers:
        - name: migrate
          image: minha-app:1.4
          command: ["./migrate", "up"]
```

## CronJob

Cria Jobs em um **agendamento cron**.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 3 * * *"           # todo dia às 03:00
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid       # não inicia se o anterior ainda roda
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: backup-tool:2.0
```

## Qual escolher?

| Preciso de… | Use |
|-------------|-----|
| API web / worker stateless | **Deployment** |
| Banco, fila, cluster com identidade | **StatefulSet** |
| Um agente em cada nó | **DaemonSet** |
| Tarefa única até terminar | **Job** |
| Tarefa recorrente | **CronJob** |
