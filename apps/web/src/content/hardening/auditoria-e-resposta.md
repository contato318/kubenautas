# Auditoria, conformidade e resposta a incidentes

Você não consegue investigar o que não registrou, nem responder bem a um incidente que nunca ensaiou. Esta lição fecha o ciclo: registrar, verificar continuamente e reagir.

## Audit log do API server

Cada requisição ao API server pode gerar eventos de auditoria em estágios (`RequestReceived`, `ResponseStarted`, `ResponseComplete`, `Panic`), com um de quatro níveis:

| Nível | Registra |
| --- | --- |
| `None` | Nada |
| `Metadata` | Quem, o quê, quando, de onde, resultado — sem corpos |
| `Request` | Metadata + corpo da requisição |
| `RequestResponse` | Metadata + corpo da requisição e da resposta |

### A política: primeira regra que casa vence

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: [RequestReceived]
rules:
  - level: None                     # ruído de componentes
    users: ["system:kube-proxy"]
    verbs: [watch]
    resources: [{ group: "", resources: [endpoints, services] }, { group: discovery.k8s.io, resources: [endpointslices] }]
  - level: None
    nonResourceURLs: ["/healthz*", "/readyz*", "/livez*", "/version"]
  - level: Metadata                 # NUNCA registre o conteúdo de Secrets
    resources: [{ group: "", resources: [secrets, configmaps] }, { group: authentication.k8s.io, resources: [tokenreviews] }]
  - level: RequestResponse          # ações sensíveis com todos os detalhes
    resources:
      - { group: "", resources: [pods/exec, pods/attach, pods/portforward] }
      - { group: rbac.authorization.k8s.io }
  - level: Request
    verbs: [create, update, patch, delete, deletecollection]
  - level: Metadata                 # todo o resto
```

Erros comuns:

- Regra genérica **no início**: todas as regras específicas abaixo dela nunca são avaliadas.
- `RequestResponse` para tudo: o log vira uma cópia dos seus Secrets e um volume gigantesco.
- Descartar todas as leituras: `get secrets` por um invasor fica invisível.

Envie os eventos para fora do cluster (backend de webhook ou coletor de arquivos → SIEM), com retenção adequada e acesso restrito. Em clusters gerenciados, habilite os logs de auditoria do provedor.

### O que alertar

- `create` em `pods/exec` em namespaces de produção.
- Criação de ClusterRoleBindings, especialmente para `cluster-admin`.
- `get`/`list` em secrets por identidades humanas ou IPs incomuns.
- Pods privilegiados, com `hostPath` ou `hostPID` (junto com o audit do PSA).
- Uso de tokens de ServiceAccount de fora do cluster; respostas `403` em série (reconhecimento).
- Uso de identidades de emergência (break-glass).

## Postura contínua

Hardening se degrada com o tempo. Automatize a verificação:

- **kube-bench** (CIS) nos nós e no control plane.
- **kubescape**, **Trivy** (`trivy k8s`), **Polaris**: configuração de workloads, RBAC, frameworks NSA/MITRE/CIS.
- Políticas em **Audit** no admission gerando relatórios (Kyverno PolicyReports).
- Scan de manifests no CI antes do deploy — mais barato do que corrigir em produção.
- Revisão periódica de acessos (quem tem cluster-admin? tokens antigos? usuários que saíram?).

## Resposta a incidentes em Kubernetes

Tenha um runbook **antes** de precisar. Um roteiro para "Pod comprometido":

1. **Conter sem destruir evidências**
   - Isolar a rede do Pod: aplicar uma NetworkPolicy deny-all selecionando um label de quarentena e adicionar o label ao Pod.
   - Remover o Pod do Service (tirar o label do seletor) para que o ReplicaSet crie um substituto limpo, mantendo o suspeito vivo para análise.
   - `kubectl cordon` no nó, se houver suspeita de escape.
2. **Coletar evidências**
   - `kubectl get pod -o yaml`, eventos, logs (`--previous` também).
   - Sistema de arquivos e memória do container (checkpoint do container, `crictl`, ferramentas forenses) antes de apagar.
   - Audit log do período: o que a ServiceAccount do Pod fez na API?
   - Alertas de runtime (Falco) e flow logs de rede.
3. **Erradicar e recuperar**
   - Revogar e rotacionar credenciais que o Pod acessava (tokens, Secrets montados, credenciais de nuvem).
   - Corrigir a causa (imagem vulnerável, configuração) e reimplantar a partir de fonte confiável.
   - Se o nó pode ter sido comprometido: drenar e **substituir** o nó, não "limpar".
4. **Aprender**
   - Postmortem sem culpados; novos controles e alertas; atualizar o runbook.

```bash
kubectl label pod api-7d9f-x2k quarentena=true app-   # remove do Service e aplica a policy de quarentena
```

## Exercite

- Simulações de ataque em ambientes de teste (ex.: kubernetes-goat, cenários do MITRE).
- *Game days* de resposta: o time encontra o incidente pelos alertas e segue o runbook.
- Teste do acesso de emergência (break-glass) — e dos alertas quando ele é usado.

No simulador, compare políticas de auditoria e veja qual nível cada requisição recebe — e onde há ações sensíveis sem registro ou Secrets vazando para o log.
