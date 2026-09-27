# Pods

O **Pod** é a menor unidade implantável do Kubernetes. Não é um container: é um **envelope** para um ou mais containers que:

- compartilham o mesmo **IP** e espaço de portas (falam entre si via `localhost`);
- podem compartilhar **volumes**;
- são sempre agendados **juntos no mesmo nó**.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports:
        - containerPort: 80
```

## Pods são efêmeros ("gado, não pets")

Um Pod nunca é "consertado" — é **substituído**. Quando morre, o substituto tem **outro nome e outro IP**. Por isso:

- Não crie Pods "soltos" em produção: use um **Deployment** (ou outro controlador) que os recria.
- Não dependa do IP de um Pod: use um **Service**.
- Não guarde estado importante no sistema de arquivos do container: use **volumes persistentes**.

## Ciclo de vida (phase)

| Phase | Significado |
|-------|-------------|
| `Pending` | Aceito pelo cluster, mas ainda não rodando (aguardando agendamento ou download da imagem) |
| `Running` | Associado a um nó e pelo menos um container em execução |
| `Succeeded` | Todos os containers terminaram com sucesso (exit 0) e não serão reiniciados |
| `Failed` | Todos terminaram e pelo menos um falhou |
| `Unknown` | O nó parou de reportar |

Estados que você verá em `kubectl get pods` e que **não são** phases, mas motivos (reasons) de containers: `ContainerCreating`, `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled`, `Terminating`, `Completed`.

## restartPolicy

- `Always` (padrão) — reinicia sempre que o container para. Usado por Deployments.
- `OnFailure` — reinicia só se sair com erro. Usado por Jobs.
- `Never` — nunca reinicia.

Reinícios seguem **backoff exponencial** (10s, 20s, 40s… até 5 min). É daí que vem o `CrashLoopBackOff`.

## Padrões multi-container

### Init containers
Rodam **antes** dos containers principais, em sequência, e precisam terminar com sucesso. Ex.: aguardar o banco ficar disponível, rodar migrations, baixar configuração.

```yaml
spec:
  initContainers:
    - name: wait-db
      image: busybox
      command: ['sh', '-c', 'until nc -z postgres 5432; do sleep 2; done']
  containers:
    - name: app
      image: minha-app:1.0
```

### Sidecar
Container auxiliar que roda **ao lado** do principal durante toda a vida do Pod: coletor de logs, proxy de service mesh (Envoy), sincronizador de arquivos. Desde a v1.29 existem *native sidecars*: init containers com `restartPolicy: Always`.

### Ambassador / Adapter
Variações do sidecar: um proxy que abstrai o acesso a um serviço externo (ambassador) ou que padroniza a saída do principal, como métricas (adapter).

## Comandos úteis

```
kubectl run tmp --image=busybox -it --rm -- sh   # pod descartável para debug
kubectl get pod web -o yaml                      # ver spec + status completos
kubectl logs web -c nginx --previous             # logs da execução anterior (após crash)
kubectl delete pod web --grace-period=0 --force  # último recurso
```
