# Laboratório: kubectl na prática

Hora de colocar a mão na massa! O terminal abaixo simula um cluster Kubernetes com 3 nós. Ele entende os comandos mais comuns do `kubectl` — o estado é mantido enquanto você estiver na página.

## Missões

Complete as missões na ordem. Elas são verificadas automaticamente olhando o estado do cluster simulado.

1. Liste os nós do cluster.
2. Crie um Deployment chamado `web` com a imagem `nginx:1.27` e 3 réplicas.
3. Liste os Pods e veja em quais nós eles caíram (`-o wide`).
4. Exponha o Deployment `web` na porta 80.
5. Escale o Deployment `web` para 5 réplicas.
6. Delete um dos Pods do `web` e veja o Deployment recriá-lo.
7. Atualize a imagem para `nginx:1.28` e verifique o rollout.

Comandos suportados: `get` (nodes, pods, deploy, svc, rs, all, ns), `describe`, `create deployment`, `expose`, `scale`, `delete`, `set image`, `rollout status|history|undo`, `logs`, `cordon`, `uncordon`, `run`, `top`, `clear` e `help`.

> Use `Tab` para autocompletar e as setas ↑/↓ para o histórico.
