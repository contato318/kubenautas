# Versionamento e conversão de CRDs

Seu CRD vai mudar. O desafio é mudar o schema **sem quebrar** quem já usa a versão antiga — manifests em Git, pipelines, outros operadores — e sem perder dados no etcd.

## Versões servidas e versão de armazenamento

```yaml
versions:
  - name: v1alpha1
    served: true          # ainda responde em /apis/db.exemplo.com/v1alpha1
    storage: false
    deprecated: true
    deprecationWarning: "db.exemplo.com/v1alpha1 Database está obsoleta; use v1"
    schema: { ... spec.size ... }
  - name: v1
    served: true
    storage: true         # exatamente UMA versão grava no etcd
    schema: { ... spec.storage.size ... }
```

- **served** — a API aceita leituras e escritas nessa versão.
- **storage** — a versão em que novos objetos (e objetos atualizados) são gravados no etcd.
- Um cliente pede qualquer versão servida; o API server **converte** entre a versão armazenada e a pedida.
- `deprecationWarning` aparece como aviso no kubectl de quem usa a versão antiga.

## Estratégias de conversão

### `None`

O API server só troca o `apiVersion`; os campos ficam como estão. Serve apenas quando os schemas são **idênticos** (ex.: promover v1beta1 para v1 sem mudanças).

### `Webhook`

Para mudanças de estrutura (renomear `spec.size` → `spec.storage.size`), você implementa um serviço de conversão:

```yaml
conversion:
  strategy: Webhook
  webhook:
    conversionReviewVersions: [v1]
    clientConfig:
      service: { namespace: db-system, name: db-operator-webhook, path: /convert }
      caBundle: LS0t...
```

O API server envia uma `ConversionReview` com objetos e a versão desejada; o webhook devolve os objetos convertidos. Regras:

- Conversão **sem perdas** nos dois sentidos (round-trip). Campos que não existem na outra versão podem ser guardados em anotações.
- O webhook está no **caminho crítico de leitura**: se cair, `kubectl get` falha para objetos que precisam de conversão — inclusive para o próprio operador e para o garbage collector.
- Trate-o como componente crítico: réplicas, PDB, certificados com renovação automática, alertas.

O Kopf pode servir webhooks de **admission** (`@kopf.on.validate`, `@kopf.on.mutate`), mas **não** implementa webhooks de conversão; para isso, use um pequeno serviço HTTP (FastAPI, aiohttp) ou evite a necessidade de conversão com mudanças aditivas.

## `status.storedVersions` e a migração

O CRD registra em `status.storedVersions` todas as versões que **podem** existir no etcd. Mudar a versão de storage não regrava objetos antigos — eles continuam na versão em que foram salvos até alguém atualizá-los.

Por isso você **não pode remover** uma versão do CRD enquanto ela estiver em `storedVersions`:

```text
The CustomResourceDefinition "databases.db.exemplo.com" is invalid:
status.storedVersions[0]: Invalid value: "v1alpha1": must appear in spec.versions
```

Processo seguro para aposentar uma versão:

1. Adicione a nova versão e torne-a `storage: true` (a antiga continua `served`).
2. Regrave todos os objetos na versão nova — um no-op update basta:
   ```bash
   kubectl get databases -A -o json | kubectl replace -f -
   ```
   (ou use o `kube-storage-version-migrator` / `StorageVersionMigration`).
3. Atualize `status.storedVersions` para conter só a versão nova:
   ```bash
   kubectl patch crd databases.db.exemplo.com --subresource=status --type=merge \
     -p '{"status":{"storedVersions":["v1"]}}'
   ```
4. Marque a antiga como `served: false` e observe por um ciclo de releases.
5. Remova-a do CRD.

## Mudanças compatíveis sem nova versão

Nem toda mudança exige versão nova. São seguras dentro da mesma versão:

- Adicionar campos **opcionais** (com ou sem `default`).
- Relaxar validações (aumentar `maximum`, adicionar valores ao `enum`).

Exigem nova versão (ou planejamento): renomear/remover campos, mudar tipos, tornar campos obrigatórios, restringir validações (objetos existentes podem ficar impossíveis de atualizar).

## Operador e versões

Seu operador deve observar **uma** versão (normalmente a mais nova). O API server converte o resto. Com Kopf:

```python
@kopf.on.update('db.exemplo.com', 'v1', 'databases')
```

No simulador, mude versões servidas, a de storage e a estratégia de conversão; derrube o webhook; tente remover v1alpha1 antes e depois da migração.
