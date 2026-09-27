# Anatomia de um CRD

Um CRD é ele mesmo um objeto da API (`apiextensions.k8s.io/v1`). Ao aplicá-lo, o API server passa a servir endpoints REST para o novo tipo — sem reiniciar nada.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.db.exemplo.com      # obrigatoriamente <plural>.<group>
spec:
  group: db.exemplo.com
  scope: Namespaced                   # ou Cluster
  names:
    kind: Database                    # CamelCase, usado no YAML dos objetos
    listKind: DatabaseList
    plural: databases                 # usado na URL e no kubectl
    singular: database
    shortNames: [db]
    categories: [all]                 # aparece em kubectl get all
  versions:
    - name: v1
      served: true                    # a API responde nessa versão
      storage: true                   # é a versão gravada no etcd (exatamente uma)
      schema:
        openAPIV3Schema: { ... }
      subresources:
        status: {}
      additionalPrinterColumns: [ ... ]
```

## Grupo, versão e nomes

- **group** — um domínio que você controla (`db.exemplo.com`). Precisa ter pelo menos um ponto. Grupos terminados em `k8s.io` e `kubernetes.io` são protegidos e exigem aprovação da comunidade.
- **version** — `v1alpha1`, `v1beta1`, `v1`… O kubectl ordena por estabilidade (GA > beta > alpha).
- **plural / singular / shortNames** — em minúsculas; é o que você digita: `kubectl get databases`, `kubectl get database`, `kubectl get db`.
- **kind** — o nome do tipo em CamelCase, que aparece em `kind: Database`.

Os objetos ficam em:

```
/apis/db.exemplo.com/v1/namespaces/loja/databases/pedidos     (Namespaced)
/apis/db.exemplo.com/v1/databases                              (lista em todos os namespaces)
```

## Namespaced ou Cluster?

| Namespaced | Cluster |
| --- | --- |
| Pertence a um time/aplicação (`Database`, `KafkaTopic`) | Recurso de infraestrutura compartilhado (`StoragePool`, `ClusterIssuer`) |
| RBAC com Role por namespace | Só ClusterRole |
| Dono (ownerReference) de filhos no mesmo namespace | Pode ser dono de objetos namespaced; o contrário (namespaced dono de cluster-scoped) não é permitido |

O escopo **não pode ser mudado** depois de criado. Escolha com cuidado.

## Colunas no kubectl get

Sem configuração, `kubectl get databases` mostra só `NAME` e `AGE`. `additionalPrinterColumns` usa JSONPath:

```yaml
additionalPrinterColumns:
  - name: Engine
    type: string
    jsonPath: .spec.engine
  - name: Ready
    type: string
    jsonPath: .status.conditions[?(@.type=="Ready")].status
  - name: Age
    type: date
    jsonPath: .metadata.creationTimestamp
```

```text
$ kubectl get db
NAME      ENGINE     READY   AGE
pedidos   postgres   True    3d
```

`priority: 1` esconde a coluna, exibindo-a só com `-o wide`.

## Ciclo de vida do CRD

```bash
kubectl apply -f crd.yaml
kubectl wait --for condition=established crd/databases.db.exemplo.com
kubectl api-resources --api-group=db.exemplo.com
kubectl explain databases.spec            # documentação a partir do schema
```

Aplicar um objeto logo após o CRD pode falhar com `no matches for kind "Database"` até a condição `Established` ficar `True` — por isso o `kubectl wait`.

⚠️ **Apagar um CRD apaga todos os objetos daquele tipo**, em todos os namespaces, sem confirmação. Trate CRDs como schema de banco de dados: versionados, aplicados com cuidado, nunca removidos por acidente (veja o caso "a CRD foi apagada").

## Onde versionar o CRD

- Em Helm, a pasta `crds/` instala CRDs só na primeira vez e **nunca** os atualiza ou remove. Muitos projetos preferem um chart separado só de CRDs, ou templates com `helm.sh/resource-policy: keep`.
- Em GitOps, aplique CRDs numa "onda" anterior aos objetos que dependem deles (ex.: sync-wave no Argo CD).
- Ferramentas como Kubebuilder geram o CRD a partir do código; com Kopf você escreve o YAML (ou gera com a biblioteca que preferir).

No simulador, monte o CRD e veja o nome, os endpoints e os erros que o API server devolve para grupos sem ponto e nomes em maiúsculas.
