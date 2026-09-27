# Plano de controle: API server, etcd, scheduler, controllers e admission

Quando o problema não é de um Pod, mas do **cluster**, os sintomas são estranhos: `kubectl` lento ou recusando conexões, Deployments que não criam Pods, Pods que não saem de Pending sem nenhum evento.

## Quem faz o quê — e o sintoma quando para

| Componente | Função | Sintoma quando falha |
| --- | --- | --- |
| **kube-apiserver** | Porta de entrada de tudo | `connection refused` na 6443; nada muda no cluster |
| **etcd** | Banco de dados do cluster | `etcdserver: request timed out`, API lenta, erros 500 |
| **kube-scheduler** | Escolhe nós | Pods `Pending` **sem eventos** |
| **kube-controller-manager** | Loops de reconciliação | Deployment sem ReplicaSet, Jobs parados, nós mortos continuam `Ready` |
| **CoreDNS** | DNS do cluster | `Could not resolve host` em todos os Pods |
| **Webhooks de admission** | Validam/alteram objetos | `failed calling webhook` ao criar/alterar recursos |

**Os Pods que já estão rodando continuam rodando** quando o control plane cai: o kubelet mantém os containers. O que para é a capacidade de **mudar** o cluster — deploys, escala, reagendamento.

## Checando a saúde

```bash
kubectl get --raw='/readyz?verbose'
kubectl get --raw='/livez?verbose'
kubectl get pods -n kube-system
kubectl get componentstatuses          # obsoleto, mas ainda útil em alguns clusters
kubectl get events -n kube-system --sort-by=.lastTimestamp
```

Em clusters **kubeadm**, os componentes são Pods estáticos em `/etc/kubernetes/manifests` no nó de control plane: um YAML inválido ali derruba o componente. Em clusters **gerenciados** (EKS, GKE, AKS), o control plane é do provedor — verifique a página de status e os logs de control plane (quando habilitados).

## etcd

- Latência de disco é a causa número 1: etcd precisa de disco rápido (fsync). Alertas: `etcd_disk_wal_fsync_duration_seconds` alto, "apply request took too long".
- Perda de quórum (maioria dos membros fora) torna o cluster somente-leitura ou indisponível.
- Banco cheio (`mvcc: database space exceeded`): compactação e desfragmentação.
- **Faça backup** (`etcdctl snapshot save`) — sem ele, perder o etcd é perder o cluster.

## Certificados

Clusters kubeadm emitem certificados com validade de **1 ano**. Se ninguém fizer upgrade (que renova) nem renovar:

```text
Unable to connect to the server: x509: certificate has expired or is not yet valid
```

```bash
kubeadm certs check-expiration
kubeadm certs renew all        # depois reinicie os componentes do control plane
```

Kubelets renovam os próprios certificados quando `rotateCertificates` está habilitado.

## Webhooks de admission

Kyverno, OPA Gatekeeper, cert-manager, service meshes e operadores registram webhooks. Se o serviço do webhook cai:

- `failurePolicy: Fail` → **toda** criação/alteração que o webhook intercepta é rejeitada — inclusive os Pods que o próprio webhook precisaria para voltar (deadlock).
- `failurePolicy: Ignore` → as requisições passam, mas a política deixa de ser aplicada.

```bash
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations
kubectl get validatingwebhookconfiguration <nome> -o yaml | grep -E "failurePolicy|namespaceSelector|timeoutSeconds"
```

Boas práticas: excluir `kube-system` e o próprio namespace do webhook com `namespaceSelector`, réplicas e PDB para o webhook, `timeoutSeconds` curto.

## API lenta e throttling

- `429 Too Many Requests`: **API Priority and Fairness** limitando clientes — um controller ou script em loop costuma ser o culpado.
- Clientes (`kubectl`, controllers) também têm rate limit local: "Waited for 1.2s due to client-side throttling".
- Métricas: `apiserver_request_duration_seconds`, `apiserver_flowcontrol_rejected_requests_total`.

No simulador, derrube componentes e veja exatamente quais operações falham e com qual mensagem.
