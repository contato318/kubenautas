# DNS e NetworkPolicy

## DNS interno (CoreDNS)

Todo Service ganha um registro DNS:

```
<service>.<namespace>.svc.cluster.local
```

| De onde você chama | Nome que funciona |
|--------------------|-------------------|
| Mesmo namespace | `web` |
| Outro namespace | `web.loja` ou `web.loja.svc.cluster.local` |
| Pod de StatefulSet | `db-0.db-headless.loja.svc.cluster.local` |

O arquivo `/etc/resolv.conf` de cada Pod aponta para o CoreDNS e tem `search` domains que permitem usar nomes curtos. A opção `ndots:5` faz nomes com menos de 5 pontos passarem primeiro pelos search domains — por isso, para chamar domínios externos com muita frequência, use o FQDN com ponto final (`api.github.com.`) para evitar consultas extras.

Debug:

```
kubectl run dns --image=busybox:1.36 -it --rm -- nslookup web.loja
kubectl -n kube-system logs -l k8s-app=kube-dns
```

## O modelo de rede do Kubernetes

1. Todo Pod tem um IP próprio.
2. Todo Pod alcança qualquer outro Pod **sem NAT**, em qualquer nó.
3. Agentes de um nó alcançam todos os Pods daquele nó.

Quem implementa isso é o **plugin CNI** (Calico, Cilium, Flannel, AWS VPC CNI…).

> Consequência: **por padrão, tudo fala com tudo.** Um Pod comprometido pode acessar o banco de dados de outro time.

## NetworkPolicy

Um firewall declarativo **por Pod**, baseado em labels. Regras importantes:

- Policies são **aditivas** (só permitem; não existe "deny" explícito).
- Assim que um Pod é selecionado por alguma policy de `Ingress`, **todo tráfego de entrada não permitido é bloqueado** para ele. O mesmo vale para `Egress`.
- Só funcionam se o CNI suportar (Calico e Cilium suportam; Flannel puro não).

### 1. Default deny no namespace

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: loja
spec:
  podSelector: {}          # todos os Pods do namespace
  policyTypes: [Ingress, Egress]
```

### 2. Liberar só o que é necessário

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-para-db
  namespace: loja
spec:
  podSelector:
    matchLabels: { app: postgres }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: api }
      ports:
        - port: 5432
```

### 3. Não esqueça o DNS no egress

Com default-deny de egress, os Pods não conseguem nem resolver nomes. Libere a porta 53 para o CoreDNS:

```yaml
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - { port: 53, protocol: UDP }
        - { port: 53, protocol: TCP }
```

> Cuidado: dentro de um mesmo item de `from`, `namespaceSelector` e `podSelector` juntos significam **E**. Em itens separados (dois `-`), significam **OU**.
