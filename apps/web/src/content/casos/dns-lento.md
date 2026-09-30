# Latências de exatamente 5 segundos

## Contexto

O serviço `frete` chama a API externa de uma transportadora. A mediana de latência é 80 ms, mas o **p99 está cravado em ~5 s**. A transportadora mostra seus próprios gráficos: tudo abaixo de 100 ms do lado deles.

## Sintomas

Rastreamento de uma requisição lenta:

```text
span: GET https://api.transportadora.com.br/cotacao   5.08s
  └─ dns.lookup api.transportadora.com.br              5.01s
  └─ tcp.connect                                       0.02s
  └─ http.request                                      0.05s
```

Logs do CoreDNS no mesmo intervalo:

```text
[INFO] "A IN api.transportadora.com.br.frete.svc.cluster.local. udp" NXDOMAIN
[INFO] "AAAA IN api.transportadora.com.br.frete.svc.cluster.local. udp" NXDOMAIN
[INFO] "A IN api.transportadora.com.br.svc.cluster.local. udp" NXDOMAIN
...
```

<!-- solucao -->

## Investigação

Dois achados:

1. **Amplificação por ndots.** O `/etc/resolv.conf` do Pod tem `options ndots:5` e três domínios de busca. `api.transportadora.com.br` tem 3 pontos (menos que 5), então o resolver tenta **primeiro** os três sufixos do cluster e só depois o nome real: 4 tentativas × (A + AAAA) = **8 consultas** por resolução.
2. **O número 5 não é coincidência.** É o timeout padrão do resolver da glibc. Quando um pacote UDP de DNS se perde, a aplicação espera 5 s antes de tentar de novo. Em Linux com kube-proxy em iptables, consultas A e AAAA enviadas em paralelo pelo mesmo socket podem sofrer uma **condição de corrida no conntrack** e uma delas é descartada.

Mais consultas por resolução = mais chances de perder uma = p99 de 5 s.

## Causa raiz

Nome externo **não qualificado** + `ndots:5` multiplicando as consultas, combinado com **perda ocasional de pacotes UDP de DNS** (corrida no conntrack), que custa o timeout de 5 s do resolver.

## Correção

Aplique uma ou mais das medidas:

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
      - name: single-request-reopen   # A e AAAA em sockets separados (glibc)
```

- Use FQDN com ponto final na configuração: `api.transportadora.com.br.`
- Instale o **NodeLocal DNSCache**: cada nó responde localmente e as consultas ao CoreDNS usam TCP, eliminando a corrida.
- Reuse conexões HTTP (keep-alive / pool) para resolver menos vezes.

## Prevenção

- Monitore a taxa de NXDOMAIN e a latência do CoreDNS (`coredns_dns_request_duration_seconds`).
- Escale o CoreDNS com o tamanho do cluster (ex.: `cluster-proportional-autoscaler`).
- Padronize `dnsConfig` para workloads que falam muito com nomes externos.

Teste a diferença no simulador de DNS: resolva `api.pagamentos.com.br` com ndots 5 e com ndots 2.
