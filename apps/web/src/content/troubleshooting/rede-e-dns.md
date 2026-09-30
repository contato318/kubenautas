# Rede e DNS: salto a salto

"É a rede" é o diagnóstico mais comum e menos útil. Uma requisição entre dois Pods passa por vários componentes; o trabalho é descobrir **em qual salto** ela quebra.

```
 Pod cliente → DNS (CoreDNS) → ClusterIP do Service → kube-proxy/CNI → Endpoints → NetworkPolicy → Pod destino → processo na porta
```

## O sintoma já diz muito

| O cliente vê | Onde procurar |
| --- | --- |
| `Could not resolve host` / `NXDOMAIN` | DNS: nome errado, namespace errado, CoreDNS fora |
| `Connection refused` | Service **sem endpoints**, `targetPort` errado ou app escutando em `127.0.0.1` |
| `Connection timed out` | Pacotes descartados: NetworkPolicy, firewall, rotas, kube-proxy/CNI sem regras |
| `503` do Ingress/Gateway | Backend sem endpoints ou todos não prontos |
| `502` do Ingress/Gateway | Backend fechou a conexão (Pod encerrando, app crashou) |
| Lento só às vezes (5 s) | DNS: timeouts do resolver, `ndots:5`, conntrack |

## Ferramentas

Tenha um Pod de depuração à mão:

```bash
kubectl run tmp -n loja --rm -it --image=nicolaka/netshoot -- bash
# dentro: dig, nslookup, curl, nc, tcpdump, ss, mtr, iperf3
```

## Salto 1 — DNS

```bash
nslookup api                     # mesmo namespace
nslookup api.loja.svc.cluster.local
cat /etc/resolv.conf             # search domains e ndots
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

- Nome curto só resolve **no mesmo namespace**; de outro, use `api.loja`.
- `ndots:5` faz nomes externos passarem pelos domínios de busca primeiro (mais consultas).
- Se só DNS falha, teste com o IP do Service: isola o problema.

## Salto 2 e 3 — Service e endpoints

```bash
kubectl get svc api -n loja -o wide
kubectl get endpointslices -n loja -l kubernetes.io/service-name=api
kubectl get pods -n loja -l app=api --show-labels
```

- **Sem endpoints** = selector não casa com os labels dos Pods, ou nenhum Pod está `Ready`.
- `port` é a porta do Service; `targetPort` precisa ser a porta em que o container **escuta**.
- Teste o Pod direto pelo IP (`curl 10.244.1.7:8080`) para separar Service de aplicação.

## Salto 4 — NetworkPolicy

```bash
kubectl get networkpolicy -n loja
kubectl describe networkpolicy -n loja
```

- Basta uma policy selecionar o Pod para que tudo não permitido seja bloqueado — em **silêncio** (timeout).
- Com default-deny de **egress**, lembre de liberar o DNS (UDP/TCP 53 para o kube-dns).
- O CNI precisa suportar NetworkPolicy (Calico, Cilium…); com Cilium, `hubble observe` mostra os drops.

## Salto 5 — O processo

```bash
kubectl exec api-7d9f -n loja -- ss -lntp
```

Uma aplicação escutando em `127.0.0.1:8080` funciona no seu notebook e recusa conexões no cluster. Ela precisa escutar em `0.0.0.0`.

## kube-proxy e o nó

- `kubectl get pods -n kube-system -l k8s-app=kube-proxy -o wide` — o do nó do cliente está saudável?
- Em modo iptables: `iptables-save | grep <ClusterIP>` no nó (via `kubectl debug node/…`).
- Tabela de **conntrack** cheia (`nf_conntrack: table full, dropping packet` no `dmesg`) derruba conexões novas aleatoriamente sob muito tráfego.

## tcpdump: a prova final

```bash
kubectl debug -it api-7d9f -n loja --image=nicolaka/netshoot --target=api -- tcpdump -ni any port 8080
```

Se o SYN chega e nada volta, o problema está no destino; se o SYN nunca chega, está no caminho.

No simulador, injete falhas e veja o sintoma que cada uma produz e o salto em que o caminho quebra.
