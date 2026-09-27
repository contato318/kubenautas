# Timeouts aleatórios só nos nós do gateway

## Contexto

Depois de uma campanha que multiplicou o tráfego, clientes relatam falhas intermitentes: cerca de 3% das requisições dão timeout. As aplicações não mostram erros, a CPU está folgada e os Pods estão saudáveis. As falhas se concentram em requisições que passam por dois nós específicos, onde rodam os Pods do Ingress Controller.

## Sintomas

```text
ingress-nginx: upstream timed out (110: Connection timed out) while connecting to upstream
curl: (28) Connection timed out after 5001 milliseconds      # ~3% das tentativas
```

<!-- solucao -->

## Investigação

```text
$ kubectl debug node/worker-1 -it --image=ubuntu
# chroot /host
# dmesg -T | grep conntrack | tail -2
[… 20:41] nf_conntrack: nf_conntrack: table full, dropping packet
[… 20:41] nf_conntrack: nf_conntrack: table full, dropping packet
# cat /proc/sys/net/netfilter/nf_conntrack_count /proc/sys/net/netfilter/nf_conntrack_max
262144
262144
```

O Ingress Controller abre uma conexão nova para o backend a cada requisição (sem keep-alive para os upstreams), e cada conexão ocupa uma entrada na tabela de **conntrack** do nó por minutos (estado TIME_WAIT).

## Causa raiz

O kube-proxy (iptables/IPVS) usa o **conntrack** do kernel para o NAT dos Services. Com a tabela no limite, o kernel **descarta** pacotes de conexões novas — sem log na aplicação, só timeouts aleatórios no cliente.

## Correção

Imediata — aumentar o limite (via kube-proxy, que ajusta no boot, ou sysctl):

```yaml
# configuração do kube-proxy
conntrack:
  maxPerCore: 131072
  min: 524288
```

Definitiva — reduzir conexões curtas: habilitar keep-alive do ingress para os upstreams (`upstream-keepalive-connections`) e nas aplicações cliente.

## Prevenção

- Métricas do node-exporter: `node_nf_conntrack_entries / node_nf_conntrack_entries_limit > 0.8` como alerta.
- Pools de conexão e keep-alive em clientes HTTP, gRPC e bancos.
- CNIs baseados em eBPF (ex.: Cilium sem kube-proxy) usam tabelas próprias — monitore os mapas eBPF deles também.

Veja os sintomas de cada salto da rede no simulador de caminho da requisição.
