# Não consigo remover a versão v1alpha1

## Contexto

A versão `v1alpha1` do CRD `Database` foi marcada como obsoleta há seis meses; todos os manifests no Git já usam `v1`, que é a versão de storage. Na limpeza para a versão 3.0 do operador, o time removeu `v1alpha1` do CRD. O pipeline de deploy falhou.

## Sintomas

```text
$ kubectl apply -f crds/databases.yaml
The CustomResourceDefinition "databases.db.exemplo.com" is invalid:
status.storedVersions[0]: Invalid value: "v1alpha1": must appear in spec.versions
```

<!-- solucao -->

## Investigação

```text
$ kubectl get crd databases.db.exemplo.com -o jsonpath='{.status.storedVersions}'
["v1alpha1","v1"]

$ kubectl get databases -A --no-headers | wc -l
214
```

Nem todos os 214 objetos foram modificados desde que `v1` virou a versão de storage.

## Causa raiz

Mudar a versão de storage **não regrava** os objetos existentes: cada um continua no etcd na versão em que foi salvo pela última vez. Por isso o CRD mantém em `status.storedVersions` todas as versões que *podem* estar no etcd. Remover do CRD uma versão ainda listada ali tornaria esses objetos ilegíveis, e o API server recusa.

## Correção

1. Regravar todos os objetos na versão de storage atual (um update sem mudanças basta):
   ```bash
   kubectl get databases -A -o json | kubectl replace -f -
   ```
   (Em clusters grandes, use o `kube-storage-version-migrator`/`StorageVersionMigration`.)
2. Atualizar o status do CRD:
   ```bash
   kubectl patch crd databases.db.exemplo.com --subresource=status --type=merge \
     -p '{"status":{"storedVersions":["v1"]}}'
   ```
3. Aplicar o CRD sem `v1alpha1` (idealmente depois de um período com `served: false`).

## Prevenção

- Incluir a migração de storage no próprio processo de release sempre que a versão de storage mudar.
- Etapas de aposentadoria documentadas: storage na nova → migrar → storedVersions → `served: false` → remover.
- Checagem no CI que compara `status.storedVersions` com as versões presentes no CRD a ser aplicado.

Reproduza no simulador de versões: marque v1alpha1 como "removida do CRD" com e sem a migração feita.
