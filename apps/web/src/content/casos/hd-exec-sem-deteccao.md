# Shells em produção que ninguém via

## Contexto

Uma auditoria interna pediu a lista de todas as sessões interativas (`kubectl exec`) em Pods de produção nos últimos 90 dias. O time de plataforma descobriu que não conseguia responder: o audit log registrava `pods/exec` só em nível `Metadata`, sem alertas, e ninguém sabia quantas pessoas tinham essa permissão.

## Sintomas

```text
$ kubectl get rolebindings,clusterrolebindings -A -o json \
  | jq -r '.items[] | select(.roleRef.name=="edit" or .roleRef.name=="admin") | .metadata.namespace + "/" + .metadata.name' | wc -l
63

$ kubectl auth can-i create pods/exec -n pagamentos --as-group=devs --as=qualquer
yes
```

<!-- solucao -->

## Investigação

- As ClusterRoles padrão `edit` e `admin` incluem `pods/exec`. Elas tinham sido concedidas amplamente, inclusive em produção.
- O audit log registrava as chamadas (nível `Metadata`), mas nada era enviado ao SIEM nem gerava alerta.
- Não havia detecção de runtime: um shell aberto num container não produzia nenhum sinal.
- Ao correlacionar logs, o time encontrou centenas de sessões — quase todas de depuração legítima, mas sem registro de quem fez o quê dentro dos containers.

## Causa raiz

Permissão de **exec** amplamente distribuída via papéis padrão, sem **detecção** nem **processo** para acesso interativo em produção. Mesmo sem má-fé, isso impede provar integridade dos sistemas e esconderia um invasor usando credenciais de um dev.

## Correção

- Remover `pods/exec` de papéis permanentes em produção; criar um papel específico concedido **sob demanda** (acesso temporário, com aprovação e expiração).
- Auditoria de `pods/exec`, `pods/attach` e `pods/portforward` em `RequestResponse`, enviada ao SIEM, com alerta em tempo real.
- Detecção de runtime (Falco: *Terminal shell in container*) nos namespaces de produção.
- Imagens distroless onde possível: menos ferramentas disponíveis numa sessão.

## Prevenção

- Não usar `edit`/`admin` genéricos em produção; papéis próprios revisados.
- Preferir `kubectl debug` com containers efêmeros (visíveis na spec do Pod) e observabilidade que dispense shells.
- Revisão trimestral de acessos.

Veja no simulador de runtime como o shell passa de "despercebido" para "detectado".
