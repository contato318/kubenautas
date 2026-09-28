# As NetworkPolicies que nunca funcionaram

## Contexto

Uma auditoria de conformidade exigia segmentação entre os namespaces de pagamentos e o resto do cluster. O time escreveu NetworkPolicies de default-deny, revisou os YAMLs, aplicou com sucesso e anexou o `kubectl get networkpolicy` como evidência. No teste de invasão seguinte, o auditor alcançou o banco de pagamentos a partir de um Pod qualquer do namespace de marketing.

## Sintomas

```text
$ kubectl get networkpolicy -n pagamentos
NAME                 POD-SELECTOR   AGE
default-deny         <none>         94d
allow-api-to-db      app=db         94d

$ kubectl run teste -n marketing --rm -it --image=busybox:1.36 -- nc -zv -w3 db.pagamentos 5432
db.pagamentos (10.244.3.18:5432) open
```

Nenhum erro ao aplicar as policies, nenhum evento, nenhum aviso.

<!-- solucao -->

## Investigação

```text
$ kubectl get pods -n kube-system -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image | grep -i -E "flannel|calico|cilium"
kube-flannel-ds-8kq2m   docker.io/flannel/flannel:v0.25.1
```

O cluster usa **Flannel** como CNI, sem nenhum componente que implemente NetworkPolicy.

## Causa raiz

NetworkPolicy é só uma **API**: o API server aceita e armazena os objetos, mas quem os aplica é o **plugin de rede**. O Flannel fornece conectividade, não enforcement de políticas — as policies eram ignoradas em silêncio desde o primeiro dia. A evidência de conformidade provava apenas que os objetos existiam, não que funcionavam.

## Correção

- Migrar para um CNI com suporte a NetworkPolicy (Calico, Cilium) — ou usar o modo "Canal" (Flannel para rede + Calico para policies) como transição.
- Janela de manutenção planejada: troca de CNI afeta toda a rede do cluster.
- Validar com testes reais de conectividade (permitido e negado) após a migração.

## Prevenção

- Testes automatizados de segmentação no CI/CD e periodicamente (ex.: um Job que tenta conexões proibidas e alerta se conseguir).
- Evidências de conformidade baseadas em **comportamento** (teste negativo), não na existência de objetos.
- Checklist de criação de cluster incluindo "o CNI implementa NetworkPolicy?".
- Observabilidade de fluxos (Hubble, flow logs do Calico) para confirmar que drops acontecem.

No simulador de zero trust, lembre que a matriz só vale se o CNI aplicar as regras.
