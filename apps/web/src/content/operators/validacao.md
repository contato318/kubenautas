# Schemas, validação e CEL

Todo CRD `apiextensions.k8s.io/v1` precisa de um **schema estrutural** OpenAPI v3 por versão. O schema serve para quatro coisas: **validar**, **podar** campos desconhecidos (pruning), aplicar **defaults** e documentar (`kubectl explain`).

```yaml
schema:
  openAPIV3Schema:
    type: object
    properties:
      spec:
        type: object
        required: [engine, storageGB]
        properties:
          engine:    { type: string, enum: [postgres, mysql] }
          version:   { type: string, pattern: '^\d+(\.\d+)?$' }
          storageGB: { type: integer, minimum: 1, maximum: 1000 }
          replicas:  { type: integer, minimum: 1, maximum: 5, default: 1 }
          backup:
            type: object
            properties:
              enabled:       { type: boolean, default: false }
              retentionDays: { type: integer, minimum: 1, maximum: 365 }
      status:
        type: object
        x-kubernetes-preserve-unknown-fields: true
```

## Schema estrutural

"Estrutural" significa que todo campo tem `type` declarado e que não há ambiguidade (sem `anyOf` definindo tipos no topo etc.). Regras úteis:

| Palavra-chave | Efeito |
| --- | --- |
| `required` | Campo obrigatório: `spec.engine: Required value` |
| `enum` | Lista fechada: `Unsupported value: "mongo"` |
| `pattern` | Regex para strings |
| `minimum` / `maximum`, `minLength` / `maxLength`, `minItems` / `maxItems` | Limites |
| `format` | `date-time`, `int-or-string`, `byte`… |
| `nullable: true` | Aceita `null` (sem isso, `null` é podado) |
| `x-kubernetes-int-or-string` | Aceita `8080` ou `"http"` (como portas) |
| `x-kubernetes-list-type: map` + `x-kubernetes-list-map-keys` | Listas mescladas por chave no server-side apply |

## Pruning: o sumiço silencioso de campos

O API server **remove** campos que não existem no schema antes de gravar no etcd. Isso protege contra lixo, mas esconde typos: `storageGb` (com b minúsculo) é descartado e o operador nunca vê o valor.

O que você percebe depende da **validação de campos** do cliente:

| `kubectl --validate` | Campo desconhecido |
| --- | --- |
| `strict` (padrão nas versões recentes) | Erro: `strict decoding error: unknown field "spec.storageGb"` |
| `warn` | Aviso, e o campo é podado |
| `ignore` / clientes antigos / muitos SDKs | Podado em silêncio |

Operadores, controllers GitOps e scripts com clientes de API frequentemente **não** usam modo strict. Configure-os para isso quando possível, e teste manifests com `kubectl apply --dry-run=server`.

Para aceitar campos arbitrários num trecho (ex.: `config` livre repassado à aplicação), use `x-kubernetes-preserve-unknown-fields: true` só naquele nó.

## Defaults

`default` é aplicado pelo API server na leitura do etcd e na escrita, antes da validação. O operador sempre vê `replicas: 1` mesmo que o usuário omita. Vantagens sobre defaults no código: ficam visíveis em `kubectl get -o yaml` e são iguais para todos os clientes.

## Regras CEL (`x-kubernetes-validations`)

Para regras entre campos, use CEL (Common Expression Language), avaliada no API server — sem webhook:

```yaml
spec:
  type: object
  x-kubernetes-validations:
    - rule: "self.engine != 'mysql' || self.replicas <= 3"
      message: "mysql suporta no máximo 3 réplicas"
    - rule: "!has(self.backup) || !self.backup.enabled || has(self.backup.retentionDays)"
      message: "retentionDays é obrigatório quando enabled=true"
  properties:
    storageGB:
      type: integer
      x-kubernetes-validations:
        - rule: "self >= oldSelf"          # regra de transição (só em updates)
          message: "storageGB não pode diminuir"
```

- `self` é o valor do nó onde a regra está; `oldSelf` é o valor anterior (regra de **transição**, avaliada só em updates).
- `has(self.campo)` testa presença de campos opcionais.
- `messageExpression` monta mensagens dinâmicas; `reason` e `fieldPath` refinam o erro.
- Há um orçamento de custo: listas sem `maxItems` e strings sem `maxLength` podem fazer o API server rejeitar a regra por custo estimado alto.

Imutabilidade é um caso comum: `rule: "self == oldSelf"` com `message: "engine é imutável"`.

## CEL × webhook de validação

| CEL no CRD | Webhook de admission |
| --- | --- |
| Roda dentro do API server, sem rede | Serviço seu, precisa estar no ar (senão bloqueia ou deixa passar) |
| Vê só o objeto (e `oldSelf`) | Pode consultar outros objetos ou sistemas |
| Versionado junto com o CRD | Deploy e certificados separados |

Prefira CEL; use webhook só quando a regra depender de estado externo. Para políticas entre tipos diferentes, veja também `ValidatingAdmissionPolicy`.

No simulador, edite o YAML e alterne `--validate`: veja o typo sumir em silêncio, os defaults aparecerem e as regras CEL rejeitarem combinações inválidas.
