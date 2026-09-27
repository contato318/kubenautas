# Status, subrecursos e condições

A convenção do Kubernetes separa **spec** (o que o usuário quer) de **status** (o que o controller observou). Usuários escrevem a spec; o operador escreve o status. Um bom status é o que torna o seu operador operável: `kubectl get`, alertas, pipelines e ferramentas GitOps dependem dele.

## O subrecurso `/status`

```yaml
versions:
  - name: v1
    subresources:
      status: {}
```

Com o subrecurso habilitado:

- `PUT/PATCH /databases/pedidos` **ignora** mudanças em `.status`.
- `PUT/PATCH /databases/pedidos/status` **ignora** tudo que não seja `.status`.
- Escritas no status **não** incrementam `metadata.generation`.
- O RBAC pode separar quem edita spec (`databases`) de quem edita status (`databases/status`).

Sem o subrecurso, o status é só mais um campo: qualquer um pode editá-lo e **toda escrita nele incrementa `generation`** — o operador passa a ver cada atualização de status como "mudança de spec". Sempre habilite.

```bash
kubectl patch database pedidos --subresource=status --type=merge -p '{"status":{"phase":"Ready"}}'
```

## `generation` e `observedGeneration`

- `metadata.generation` — contador que o API server incrementa a cada mudança na spec (não em labels, anotações ou status, com o subrecurso ligado).
- `status.observedGeneration` — o operador grava aqui qual `generation` ele acabou de processar.

```yaml
metadata:
  generation: 7
status:
  observedGeneration: 6       # ainda trabalhando na mudança mais recente
```

Sem `observedGeneration`, ninguém sabe se `Ready=True` se refere à spec atual ou a uma anterior. Um pipeline que faz `kubectl wait --for=condition=Ready` logo após o `apply` pode concluir "deploy ok" olhando o status **velho**. Ferramentas como Argo CD, Flux e `kstatus` usam `observedGeneration` para decidir se o recurso está `Current` ou `InProgress`.

## Condições

Condições são a forma padronizada de expor estado:

```yaml
status:
  observedGeneration: 7
  conditions:
    - type: Ready
      status: "False"                   # "True" | "False" | "Unknown"
      reason: MigrationFailed           # CamelCase, para máquinas
      message: "migração 0042 falhou: coluna duplicada"   # para humanos
      lastTransitionTime: "2026-09-27T14:03:11Z"          # só muda quando status muda
      observedGeneration: 7
```

Boas práticas:

- Uma condição resumo (`Ready` ou `Available`) que ferramentas genéricas entendem, mais condições específicas (`BackupSucceeded`, `Degraded`).
- **Polaridade consistente**: prefira tipos em que `True` é o estado bom (ou documente o contrário, como `Degraded`).
- `lastTransitionTime` muda apenas quando o `status` da condição muda, não a cada reconcile.
- `reason` curto e estável (vira alerta e filtro); `message` com detalhes.
- Status deve ser **reconstruível** a partir do mundo real: nunca use o status como única fonte de verdade para decisões.

```bash
kubectl wait database/pedidos --for=condition=Ready --timeout=5m
kubectl get database pedidos -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'
```

## O subrecurso `/scale`

Para que `kubectl scale` e o HPA funcionem com o seu tipo:

```yaml
subresources:
  scale:
    specReplicasPath: .spec.replicas
    statusReplicasPath: .status.replicas
    labelSelectorPath: .status.selector     # string no formato de seletor, exigido pelo HPA
```

```bash
kubectl scale database pedidos --replicas=3
```

## Status com Kopf

O Kopf oferece três formas de escrever status:

```python
@kopf.on.create('databases')
def criar(spec, patch, meta, **_):
    patch.status['observedGeneration'] = meta['generation']          # 1. via patch
    patch.status['conditions'] = [ready_condition(True, 'Provisioned')]
    return {'endpoint': 'pedidos.loja.svc:5432'}                     # 2. retorno → status.criar
```

1. `patch.status[...]` — aplicado pelo Kopf depois do handler (via `/status`, quando o subrecurso existe).
2. O **valor de retorno** do handler vai para `status.<id_do_handler>`.
3. Chamadas diretas à API com o cliente Kubernetes, para casos especiais.

Mudanças de status **não** disparam `on.update` no Kopf (status não faz parte da "essência" do objeto), o que evita loops.

No simulador, desligue o subrecurso e veja cada escrita de status mudar `generation`; depois ligue `observedGeneration` e compare o que um `kubectl wait` conclui.
