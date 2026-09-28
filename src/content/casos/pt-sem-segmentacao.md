# Avaliação: rede plana entre namespaces

## Contexto

Partindo de um Pod comprometido no namespace `web` (autorizado), o avaliador testou se a rede do cluster continha o comprometimento ou permitia alcançar sistemas sensíveis em outros namespaces.

## Sintomas

```text
# de um Pod de teste em web
$ nc -zv -w3 db.pagamentos 5432
db.pagamentos (10.244.7.12:5432) open

$ nc -zv -w3 169.254.169.254 80
169.254.169.254 (169.254.169.254:80) open

$ kubectl get networkpolicy -A
No resources found
```

<!-- solucao -->

## Investigação

Nenhuma NetworkPolicy no cluster: a rede é **plana**. A partir do frontend, o avaliador comprovou (checagem de conectividade, sem invadir os serviços) que era possível alcançar:

- o **banco de pagamentos** em outro namespace (sem isolamento);
- o **endpoint de metadata** da nuvem (caminho para credenciais do nó);
- qualquer destino na **internet** (egress livre).

O avaliador registrou que as portas abriam, sem explorar os serviços vizinhos, e documentou o alcance como risco de movimento lateral e exfiltração.

## Causa raiz

Ausência total de segmentação de rede. Sem NetworkPolicy (e com um CNI que a suporte), um único Pod comprometido alcança todo o cluster e sai livremente para a internet.

## Correção

- **default-deny** de ingress e egress por namespace, liberando o DNS (kube-dns).
- Abrir apenas os fluxos necessários (frontend→api, api→db).
- **Bloquear o metadata** (`ipBlock except 169.254.169.254/32`) + IMDSv2 hop limit 1.
- Egress restrito com gateway/proxy e lista de domínios.
- Confirmar que o **CNI implementa** NetworkPolicy (Calico/Cilium; Flannel puro não).

## Prevenção

- Testes automatizados de segmentação (um Job que tenta conexões proibidas e alerta se conseguir).
- Observabilidade de fluxos (Hubble, flow logs) para confirmar os drops.
- Reteste após aplicar as policies.

No simulador de movimento lateral, escolha o Pod em `web` e ligue a segmentação para ver os alvos sensíveis ficarem inalcançáveis.
