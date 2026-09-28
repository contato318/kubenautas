# Um "nginx" que não era o nginx

## Contexto

Um time criou rapidamente um proxy para testes de carga e digitou a imagem de memória: `ngnix:1.27`. O Pod subiu normalmente e serviu tráfego. Dias depois, a detecção em runtime disparou alertas de conexões para um domínio desconhecido saindo desse Pod.

## Sintomas

```text
Falco: Unexpected outbound connection destination (k8s.ns=perf k8s.pod=proxy-5c7d image=docker.io/library/ngnix)
Falco: Drop and execute new binary in container (k8s.pod=proxy-5c7d)

$ kubectl get pod proxy-5c7d -n perf -o jsonpath='{.spec.containers[0].image}'
ngnix:1.27
```

<!-- solucao -->

## Investigação

`ngnix` (com as letras trocadas) resolvia para uma imagem pública publicada por terceiros, sem relação com o projeto oficial. Ela servia o nginx normalmente — e executava, em paralelo, um processo que baixava e rodava um binário adicional. Nenhum controle verificava a origem da imagem: o cluster aceitava qualquer referência que o nó conseguisse baixar.

## Causa raiz

Ausência de controles de **cadeia de suprimentos** no admission: sem lista de registries permitidos, sem exigência de assinatura, sem digest. Um erro de digitação bastou para executar código de origem desconhecida no cluster.

## Correção

- Remover o workload, isolar e investigar o namespace; substituir o nó por precaução; rotacionar credenciais acessíveis pelo Pod.
- Política de admission em **Enforce**: apenas `registry.empresa.com`, imagens assinadas pelo pipeline oficial, por digest.
- Imagens públicas necessárias passam a ser **importadas** para o registry interno após verificação (origem, assinatura do fornecedor, scan).

## Prevenção

- Políticas de supply chain primeiro em Audit, depois Enforce, cobrindo todos os namespaces (exceções mínimas).
- Detecção em runtime de binários novos e conexões incomuns (foi o que salvou este caso).
- Egress restrito: o binário extra não teria conseguido baixar nada.

Veja a imagem `docker.io/ngnix` ser barrada no simulador de políticas de imagem.
