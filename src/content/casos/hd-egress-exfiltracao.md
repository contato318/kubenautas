# Dados saindo por onde ninguém olhava

## Contexto

O time de dados recebeu um alerta do provedor de nuvem sobre tráfego de saída anômalo: 40 GB enviados em uma madrugada a partir dos nós do cluster de analytics, para um destino fora das faixas de IP de parceiros conhecidos. O namespace `relatorios` tinha NetworkPolicies de **ingress** bem definidas — e nenhuma de egress.

## Sintomas

```text
Alerta de rede: 41.2 GB de egress para 203.0.113.50:443 entre 02:10 e 03:40 (nós worker-7, worker-9)

$ kubectl get networkpolicy -n relatorios -o custom-columns=NAME:.metadata.name,TYPES:.spec.policyTypes
NAME                  TYPES
default-deny-ingress  [Ingress]
allow-from-gateway    [Ingress]
```

<!-- solucao -->

## Investigação

Os flow logs do CNI atribuíram o tráfego a um Pod do serviço de geração de relatórios, que tinha acesso de leitura ao data warehouse. A investigação posterior identificou uma dependência vulnerável na biblioteca de geração de PDF como porta de entrada (corrigida numa versão já disponível). A aplicação legítima só precisava falar com o data warehouse e com o serviço de e-mail interno.

## Causa raiz

Segmentação **só de entrada**. Sem política de egress, um workload comprometido podia enviar dados para qualquer destino na internet — e a saída do cluster não era monitorada por workload, só por volume agregado.

## Correção

- Isolar o Pod (policy de quarentena), preservar evidências, corrigir a dependência e reimplantar.
- Default-deny de egress em `relatorios`, liberando apenas DNS, o data warehouse e o serviço de e-mail.
- Saídas para a internet, quando necessárias, apenas por egress gateway/proxy com lista de domínios permitidos e logs.
- Revisar e revogar credenciais do data warehouse usadas pelo serviço.

## Prevenção

- Egress restrito como padrão em todos os namespaces que acessam dados sensíveis.
- Alertas de volume de saída por workload (flow logs, Hubble) e detecção em runtime de conexões incomuns.
- Scan contínuo de dependências e atualização rápida de bibliotecas com CVEs exploráveis.

Atinja o objetivo "banco NÃO sai para a internet" no simulador de zero trust.
