# Rede: segmentação e zero trust

Por padrão, a rede do Kubernetes é **plana**: qualquer Pod fala com qualquer Pod, em qualquer namespace, e com qualquer destino na internet. Para um invasor que comprometeu um container, isso é um convite ao movimento lateral e à exfiltração.

## NetworkPolicy em uma página

- Uma policy **seleciona** Pods (`podSelector`) e declara o que eles podem receber (`ingress`) e/ou enviar (`egress`).
- Pods **não selecionados** por nenhuma policy de um tipo ficam abertos naquele sentido.
- Policies são **aditivas**: não existe "negar"; o isolamento vem de um Pod ser selecionado sem regra que permita o tráfego.
- Só funcionam se o **CNI** as implementa (Calico, Cilium, Antrea, a maioria dos CNIs gerenciados). Flannel puro ignora as policies em silêncio.

## Passo 1: default-deny

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: loja }
spec:
  podSelector: {}               # todos os Pods do namespace
  policyTypes: [Ingress, Egress]
```

## Passo 2: liberar o DNS

Com egress negado, nada resolve nomes. Libere o kube-dns explicitamente:

```yaml
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
          podSelector:
            matchLabels: { k8s-app: kube-dns }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
```

## Passo 3: abrir só os fluxos necessários

```yaml
# api aceita apenas do frontend (namespace web), na porta 8080
spec:
  podSelector: { matchLabels: { app: api } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: web } }
          podSelector: { matchLabels: { app: frontend } }
      ports: [{ port: 8080 }]
```

Atenção à armadilha clássica: `namespaceSelector` e `podSelector` **no mesmo item** da lista significam "E"; em **itens separados** (`- namespaceSelector` / `- podSelector`), significam "OU" — e abrem muito mais do que parece.

## O endpoint de metadata da nuvem

`169.254.169.254` entrega credenciais do papel IAM do **nó**. Um Pod com SSRF ou RCE que o alcance pode sair do cluster para a conta de nuvem. Proteções complementares:

1. Egress para a internet com exceção explícita:
   ```yaml
   egress:
     - to:
         - ipBlock:
             cidr: 0.0.0.0/0
             except: [169.254.169.254/32, 10.0.0.0/8]
   ```
2. **IMDSv2** obrigatório com **hop limit 1** (AWS): a resposta não atravessa o salto extra da rede do container.
3. Identidade por workload (IRSA/Pod Identity/Workload Identity) e papel do nó com o mínimo de permissões.

## Egress: o controle esquecido

Muitas equipes aplicam só ingress. Sem egress restrito:

- dados exfiltrados saem direto para servidores do atacante;
- mineradores baixam binários e conectam a pools;
- um Pod comprometido varre a rede interna da empresa.

Para destinos externos por **nome** (ex.: `api.stripe.com`), a NetworkPolicy padrão só entende IPs. Use recursos do CNI (Cilium `toFQDNs`, Calico `domains`) ou um **egress gateway**/proxy com lista de domínios permitidos.

## Além do L3/L4

- **Service mesh** (Istio, Linkerd, Cilium) com **mTLS** entre serviços: criptografia em trânsito e identidade forte (SPIFFE), com autorização por identidade em vez de IP.
- Policies de camada 7 (métodos e caminhos HTTP) com Cilium ou o mesh.
- **AdminNetworkPolicy** (API em evolução) para regras de cluster que times de aplicação não podem sobrescrever.

## Testando e observando

```bash
kubectl run t --rm -it -n web --image=nicolaka/netshoot -l app=frontend -- curl -m3 api.loja:8080/health
kubectl run t --rm -it -n loja --image=nicolaka/netshoot -- curl -m3 http://169.254.169.254/   # deve dar timeout
```

Ferramentas como Hubble (Cilium), Calico flow logs e o editor visual de policies ajudam a descobrir fluxos reais antes de fechar tudo.

No simulador, parta de uma rede totalmente aberta e alcance os seis objetivos de segmentação — inclusive bloquear o metadata.
