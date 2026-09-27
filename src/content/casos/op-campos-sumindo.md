# O backup configurado que nunca rodou

## Contexto

O time de pedidos declarou seu banco via GitOps (Argo CD) com o CRD `Database` do operador interno. O YAML no Git tem retenção de backup de 30 dias. Três semanas depois, um `DELETE` sem `WHERE` exigiu restauração — e o backup mais antigo tinha 7 dias, o padrão do operador.

## Sintomas

```yaml
# no Git
spec:
  engine: postgres
  storageGB: 200
  backup:
    enabled: true
    retentionDay: 30
```

```text
$ kubectl get database pedidos -n loja -o jsonpath='{.spec.backup}'
{"enabled":true}

$ kubectl logs deploy/db-operator -n db-system | grep pedidos
Handler 'criar' succeeded. backup habilitado com retenção padrão de 7 dias
```

O Argo CD mostra o recurso como `Synced`. Nenhum erro em lugar nenhum.

<!-- solucao -->

## Investigação

O campo no Git é `retentionDay` (singular). O schema do CRD define `retentionDays`:

```text
$ kubectl explain database.spec.backup
FIELDS:
  enabled        <boolean>
  retentionDays  <integer>
```

Testando com validação estrita:

```text
$ kubectl apply --dry-run=server --validate=strict -f pedidos-db.yaml
Error from server (BadRequest): … strict decoding error: unknown field "spec.backup.retentionDay"
```

## Causa raiz

O API server faz **pruning**: remove campos que não existem no schema antes de gravar o objeto. O Argo CD aplica os manifests sem validação estrita de campos, então o typo foi descartado **em silêncio**. O objeto gravado não tinha `retentionDays`, e o operador aplicou o padrão de 7 dias. O Argo CD ignora a diferença porque compara o estado normalizado (o campo desconhecido nunca existiu no objeto vivo).

## Correção

- Corrigir o campo no Git (`retentionDays: 30`) e confirmar com `kubectl get … -o yaml`.
- Adicionar uma regra CEL que torne o problema visível:
  ```yaml
  x-kubernetes-validations:
    - rule: "!self.enabled || has(self.retentionDays)"
      message: "retentionDays é obrigatório quando enabled=true"
  ```

## Prevenção

- CI com `kubectl apply --dry-run=server --validate=strict` (ou `kubeconform` com os schemas dos CRDs) em todo PR.
- Campos importantes obrigatórios (ou com regra CEL), em vez de defaults silenciosos no operador.
- Defaults no **schema**, visíveis em `kubectl get -o yaml`, e não escondidos no código.
- O operador expõe no status a configuração efetiva (`status.backup.retentionDays: 7`), facilitando perceber a divergência.

Reproduza no simulador de schema com o exemplo "Campo com typo" e `--validate=ignore`.
