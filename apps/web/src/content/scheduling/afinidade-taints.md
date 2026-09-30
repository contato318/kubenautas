# Afinidade, taints e tolerations

Por padrão o scheduler escolhe o "melhor" nó sozinho. Você pode influenciar essa decisão.

## nodeSelector (o mais simples)

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

O Pod só vai para nós com o label `disktype=ssd` (`kubectl label node worker-2 disktype=ssd`).

## Node affinity

Versão expressiva do nodeSelector, com operadores (`In`, `NotIn`, `Exists`, `Gt`…) e regras **obrigatórias** ou **preferenciais**:

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values: [us-east-1a, us-east-1b]
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
            - key: node.kubernetes.io/instance-type
              operator: In
              values: [m6i.large]
```

*IgnoredDuringExecution* = se o label do nó mudar depois, o Pod já agendado **não** é removido.

## Pod affinity e anti-affinity

Regras em relação a **outros Pods**:

- **podAffinity** — "coloque-me perto de Pods X" (ex.: cache junto da API, menor latência).
- **podAntiAffinity** — "coloque-me longe de Pods X" (ex.: réplicas em nós diferentes, para alta disponibilidade).

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          topologyKey: kubernetes.io/hostname
          labelSelector:
            matchLabels: { app: web }
```

## Topology spread constraints

Forma moderna e mais precisa de espalhar réplicas por zonas/nós:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels: { app: web }
```

## Taints e tolerations

Affinity **atrai** Pods para nós. Taints fazem o contrário: **repelem** Pods de um nó, exceto os que **toleram** o taint.

```
kubectl taint nodes gpu-1 dedicated=gpu:NoSchedule
```

```yaml
tolerations:
  - key: dedicated
    operator: Equal
    value: gpu
    effect: NoSchedule
```

| Efeito | Comportamento |
|--------|---------------|
| `NoSchedule` | Novos Pods sem toleration não são agendados |
| `PreferNoSchedule` | Evita, mas permite se não houver alternativa |
| `NoExecute` | Além de não agendar, **expulsa** Pods já rodando sem toleration |

> Toleration **permite**, mas não **obriga**. Para dedicar nós de GPU a um workload, combine **taint** (afasta os outros) + **nodeAffinity** (atrai o seu).

Exemplos no dia a dia: nós do control plane têm o taint `node-role.kubernetes.io/control-plane:NoSchedule`; nós com problema recebem automaticamente `node.kubernetes.io/not-ready:NoExecute`.

## PriorityClass e preempção

Pods com `priorityClassName` mais alta podem **expulsar** Pods de menor prioridade quando o cluster está cheio. Use para garantir que workloads críticos sempre tenham espaço.

## PodDisruptionBudget

Protege a disponibilidade durante interrupções **voluntárias** (drenagem de nó, upgrade):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web
spec:
  minAvailable: 2
  selector:
    matchLabels: { app: web }
```

`kubectl drain` respeita o PDB e espera, em vez de derrubar todas as réplicas de uma vez.
