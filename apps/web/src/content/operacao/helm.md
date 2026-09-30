# Helm e Kustomize

Uma aplicação real tem Deployment, Service, Ingress, ConfigMap, HPA, PDB, ServiceAccount… multiplicados por ambientes. Copiar e colar YAML não escala. Duas abordagens dominam.

## Helm — o gerenciador de pacotes

Um **chart** é um pacote de templates YAML + valores padrão. Uma **release** é uma instalação de um chart no cluster.

```
meu-chart/
├── Chart.yaml          # nome, versão do chart, appVersion, dependências
├── values.yaml         # valores padrão
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl    # funções reutilizáveis
│   └── NOTES.txt       # mensagem exibida após instalar
└── charts/             # dependências (subcharts)
```

Template (sintaxe Go template):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "meu-chart.fullname" . }}
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: app
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
```

Comandos essenciais:

```
helm repo add bitnami https://charts.bitnami.com/bitnami
helm search repo redis
helm show values bitnami/redis > values.yaml
helm install cache bitnami/redis -n infra --create-namespace -f values.yaml
helm upgrade --install cache bitnami/redis -f values.yaml --set replica.replicaCount=2
helm list -A
helm history cache
helm rollback cache 1
helm uninstall cache
helm template ./meu-chart -f values-prod.yaml   # renderiza localmente, sem instalar
helm lint ./meu-chart
```

Precedência dos valores: `values.yaml` do chart < `-f arquivo` (na ordem) < `--set`.

## Kustomize — patches sem templates

Embutido no kubectl (`kubectl apply -k`). Você mantém YAML **puro** numa `base` e aplica **overlays** por ambiente.

```
app/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/kustomization.yaml
    └── prod/
        ├── kustomization.yaml
        └── replicas-patch.yaml
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: loja-prod
resources:
  - ../../base
images:
  - name: minha-app
    newTag: "2.3.1"
patches:
  - path: replicas-patch.yaml
configMapGenerator:
  - name: app-config
    literals: [LOG_LEVEL=warn]     # gera nome com hash → rollout automático
```

## Qual usar?

| | Helm | Kustomize |
|-|------|-----------|
| Modelo | Templates + valores | Base + patches |
| Distribuir software para terceiros | ✅ Excelente | ➖ |
| Versionamento / rollback de release | ✅ | Via Git |
| Curva de aprendizado | Templates podem ficar complexos | Simples, YAML puro |

Muito comum: **Helm para software de terceiros** (Prometheus, cert-manager) e **Kustomize para suas apps**, tudo sincronizado por um **GitOps** (Argo CD ou Flux) a partir do Git.
