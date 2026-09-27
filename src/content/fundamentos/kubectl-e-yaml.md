# kubectl e manifestos YAML

## kubectl: sua interface com o cluster

A sintaxe geral é:

```
kubectl <verbo> <tipo> [nome] [flags]
```

| Comando | O que faz |
|---------|-----------|
| `kubectl get pods` | Lista Pods do namespace atual |
| `kubectl get pods -o wide` | Inclui IP e nó |
| `kubectl get all -A` | Tudo, em todos os namespaces |
| `kubectl describe pod web-1` | Detalhes + **Events** (ótimo para debug) |
| `kubectl logs web-1 -f` | Segue os logs do container |
| `kubectl exec -it web-1 -- sh` | Abre um shell dentro do container |
| `kubectl apply -f app.yaml` | Cria/atualiza de forma declarativa |
| `kubectl delete -f app.yaml` | Remove o que o arquivo define |
| `kubectl scale deploy web --replicas=5` | Escala |
| `kubectl port-forward svc/web 8080:80` | Túnel local para testar |
| `kubectl explain deployment.spec` | Documentação do schema no terminal |

Dica: crie o alias `alias k=kubectl` e ative o autocompletar (`source <(kubectl completion zsh)`).

## Imperativo vs. declarativo

```
# Imperativo — rápido para testes
kubectl create deployment web --image=nginx:1.27 --replicas=3

# Declarativo — versionável, revisável, reprodutível
kubectl apply -f deployment.yaml
```

Em produção prefira **declarativo** e guarde os YAMLs no Git (base do **GitOps**, com Argo CD ou Flux).

Truque útil: gere o YAML a partir do comando imperativo:

```
kubectl create deployment web --image=nginx --dry-run=client -o yaml > deployment.yaml
```

## Anatomia de um manifesto

Todo objeto Kubernetes tem quatro campos de nível superior:

```yaml
apiVersion: apps/v1        # grupo/versão da API
kind: Deployment           # tipo do objeto
metadata:                  # identidade
  name: web
  namespace: default
  labels:
    app: web
spec:                      # ESTADO DESEJADO (você escreve)
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
# status:                  # ESTADO ATUAL (o cluster escreve)
```

- **spec** é o que você quer. **status** é o que o cluster observa. Os controladores trabalham para aproximar os dois.

## Labels e selectors

Labels são pares chave/valor arbitrários anexados a objetos. **Selectors** filtram por labels. É assim que tudo se conecta no Kubernetes:

- Um **Deployment** encontra seus Pods por `selector.matchLabels`.
- Um **Service** encontra os Pods para onde mandar tráfego por `selector`.

```
kubectl get pods -l app=web
kubectl get pods -l 'env in (prod,staging)'
kubectl label pod web-1 tier=frontend
```

> Labels são para **seleção**. Para metadados não usados em seleção (autor, link de doc, checksum) use **annotations**.

## YAML: armadilhas comuns

- Indentação com **espaços**, nunca tabs.
- `-` inicia um item de lista.
- `yes`, `no`, `on`, `off` podem virar booleanos — use aspas em strings ambíguas.
- Vários objetos no mesmo arquivo são separados por `---`.
