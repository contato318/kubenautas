# Ferramentas e observabilidade para troubleshooting

Os comandos básicos resolvem a maioria dos casos. Os demais exigem ferramentas certas — e dados que precisam existir **antes** do incidente.

## kubectl debug

```bash
# Container efêmero no Pod (compartilha processos e rede com o container alvo)
kubectl debug -it api-7d9f -n loja --image=nicolaka/netshoot --target=api

# Cópia do Pod com o comando trocado — para investigar um container que crasha na hora
kubectl debug api-7d9f -n loja -it --copy-to=api-debug --container=api -- sh

# Cópia do Pod com outra imagem (ex.: a mesma aplicação com ferramentas)
kubectl debug api-7d9f -n loja --copy-to=api-debug --set-image=api=loja/api:debug

# Pod privilegiado num nó, com o sistema de arquivos do nó em /host
kubectl debug node/worker-2 -it --image=ubuntu
```

Imagens distroless não têm shell: o container efêmero é o jeito certo de inspecioná-las. Perfis (`--profile=netadmin`, `sysadmin`) dão as capabilities necessárias para `tcpdump` e afins.

## Comandos que economizam tempo

```bash
kubectl get pods -A --field-selector=status.phase!=Running         # tudo que não está rodando
kubectl get pods -A -o wide | grep -v Running
kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp
kubectl top pods -A --sort-by=memory
kubectl top nodes
kubectl logs -l app=api -n loja --all-containers --prefix --since=10m
kubectl get pod api-7d9f -o jsonpath='{.status.containerStatuses[*].lastState}'
kubectl auth can-i --list --as=system:serviceaccount:loja:api
kubectl diff -f manifests/                                          # drift entre Git e cluster
kubectl port-forward svc/api 8080:80 -n loja
```

Plugins úteis (via krew): `stern` (logs de vários Pods), `kubectl-tree` (donos e filhos de um objeto), `neat` (YAML limpo), `ktop`, `view-secret`.

## As três fontes de telemetria

| Fonte | Responde | Exemplos |
| --- | --- | --- |
| **Métricas** | "O quê e quanto?" ao longo do tempo | Prometheus + kube-state-metrics + node-exporter + cAdvisor |
| **Logs** | "O que a aplicação disse?" | Loki, Elasticsearch/OpenSearch, CloudWatch |
| **Traces** | "Onde o tempo foi gasto?" | OpenTelemetry + Tempo/Jaeger |

Consultas PromQL que todo SRE de Kubernetes deveria ter salvas:

```promql
# Reinícios nas últimas 1h
increase(kube_pod_container_status_restarts_total[1h]) > 0
# Pods fora de Running/Succeeded
sum by (namespace, phase) (kube_pod_status_phase{phase=~"Pending|Failed|Unknown"})
# Memória perto do limit
container_memory_working_set_bytes / on(namespace,pod,container) kube_pod_container_resource_limits{resource="memory"} > 0.9
# CPU throttling
rate(container_cpu_cfs_throttled_periods_total[5m]) / rate(container_cpu_cfs_periods_total[5m]) > 0.25
# Deployments sem réplicas disponíveis
kube_deployment_status_replicas_available == 0
```

## Eventos e auditoria

- **Eventos** somem em 1 hora: exporte-os (event-exporter, Kubernetes Event Router) para o seu sistema de logs.
- **Logs de auditoria** do API server respondem "quem fez o quê e quando" — indispensáveis para investigar mudanças inesperadas e incidentes de segurança.

## Runbooks e postmortems

- **Runbook** por alerta: o que significa, como confirmar, como mitigar, quando escalar. Link no próprio alerta.
- **Postmortem sem culpados** após cada incidente relevante: linha do tempo, impacto, causa raiz, fatores contribuintes e ações com dono e prazo.
- Pratique: *game days* e chaos engineering (derrubar um nó, o CoreDNS, um webhook) em ambientes de teste revelam lacunas de observabilidade antes do incidente real.

Teste suas escolhas no desafio de comandos abaixo.
