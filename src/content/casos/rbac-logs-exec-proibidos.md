# O suporte vê os Pods, mas não consegue ler logs

## Contexto

O time de suporte ganhou acesso de leitura ao namespace `loja` para investigar chamados sem depender dos desenvolvedores. `kubectl get pods` funciona, mas os comandos que eles mais precisam falham.

## Sintomas

```text
$ kubectl get pods -n loja
NAME                       READY   STATUS    RESTARTS   AGE
pedidos-6d5f7c8b9-4kx2m    1/1     Running   0          2h

$ kubectl logs pedidos-6d5f7c8b9-4kx2m -n loja
Error from server (Forbidden): pods "pedidos-6d5f7c8b9-4kx2m" is forbidden:
User "suporte@empresa.com" cannot get resource "pods/log" in API group "" in the namespace "loja"
```

A Role:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

Na mesma semana, alguém sugeriu resolver com `resources: ["*"]`.

<!-- solucao -->

## Investigação

A mensagem aponta o recurso `pods/log`, não `pods`. Logs, exec, port-forward e outros são **subrecursos**, com autorização própria:

| Comando | Recurso | Verbo |
| --- | --- | --- |
| `kubectl logs` | `pods/log` | `get` |
| `kubectl exec` | `pods/exec` | `create` |
| `kubectl port-forward` | `pods/portforward` | `create` |
| `kubectl scale` | `deployments/scale` | `update` / `patch` |

```text
$ kubectl auth can-i get pods/log -n loja --as=suporte@empresa.com
no
```

## Causa raiz

Permissão em `pods` **não inclui** os subrecursos. Isso é intencional: ler logs expõe dados, e `exec` dá um shell dentro do container — permissões bem mais sensíveis que listar Pods.

## Correção

Conceda exatamente o que o suporte precisa:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
```

E **não** use `resources: ["*"]`: isso incluiria `secrets`, `pods/exec` e tudo mais do grupo core no namespace.

## Prevenção

- Monte Roles a partir das **tarefas** do time ("ler logs", "abrir shell") e mapeie cada uma para recurso + verbo.
- `exec` em produção: conceda de forma temporária (acesso just-in-time) e auditada.
- Revise periodicamente com `kubectl auth can-i --list --as=<usuário> -n <ns>`.

Pratique no laboratório de RBAC com as missões "Suporte lê logs" e "Debug em produção".
