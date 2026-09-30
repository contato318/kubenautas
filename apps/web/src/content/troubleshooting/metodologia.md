# Método: como investigar qualquer problema no Kubernetes

Troubleshooting não é adivinhação nem "reiniciar para ver se resolve". É um processo repetível: **observar, formular hipóteses, testar uma de cada vez e registrar**. Quem tem método resolve incidentes que nunca viu antes.

## 1. Defina o problema com precisão

Antes de qualquer comando, responda:

- **O que** está errado? ("o checkout retorna 503", não "o site está ruim")
- **Desde quando?** O que mudou nesse horário? (deploy, config, upgrade do cluster, pico de tráfego)
- **Qual o alcance?** Um Pod, um Deployment, um nó, um namespace, o cluster inteiro?
- **É constante ou intermitente?**

> A pergunta mais valiosa de um incidente é "o que mudou?". A maior parte dos problemas começa com uma mudança: deploy, configuração, versão, capacidade, tráfego.

## 2. Localize a camada

```
 Aplicação  →  Container  →  Pod  →  Service/Rede  →  Nó  →  Control plane  →  Infraestrutura
```

Descarte camadas rapidamente com uma pergunta cada:

| Pergunta | Se a resposta for não… |
| --- | --- |
| O Pod está `Running` e `Ready`? | Problema de Pod/container (lições 2 e 3) |
| A aplicação responde de dentro do próprio Pod? | Problema da aplicação |
| Responde pelo Service, a partir de outro Pod? | Problema de rede/DNS (lição 4) |
| Os nós estão `Ready`? | Problema de nó (lição 5) |
| `kubectl` responde normalmente? | Problema de control plane (lição 7) |

## 3. O kit básico, sempre na mesma ordem

```bash
kubectl get pods -n loja -o wide                # 1. estado: STATUS, READY, RESTARTS, NODE
kubectl describe pod api-7d9f -n loja           # 2. eventos e condições (a seção Events no final!)
kubectl logs api-7d9f -n loja --previous        # 3. o que a aplicação disse antes de morrer
kubectl get events -n loja --sort-by=.lastTimestamp   # 4. linha do tempo do namespace
kubectl get pod api-7d9f -n loja -o yaml        # 5. a especificação completa e o status detalhado
```

- `get` responde **o quê**; `describe` e eventos respondem **por quê** (do ponto de vista do Kubernetes); `logs` respondem **por quê** do ponto de vista da aplicação.
- **Eventos expiram** (1 hora por padrão). Em incidentes, salve-os cedo: `kubectl get events -A -o yaml > eventos.yaml`.
- `RESTARTS` crescendo com `Running` indica crash intermitente ou liveness matando o container.

## 4. Uma hipótese por vez

1. Formule uma hipótese baseada em evidência ("a readiness falha porque o banco está lento").
2. Defina o teste que a confirma ou descarta.
3. Mude **uma coisa só**, observe, registre.

Mudar várias coisas ao mesmo tempo pode resolver o incidente sem que ninguém saiba por quê — e ele volta.

## 5. Estabilizar primeiro, entender depois

Em produção, restaurar o serviço vem antes da causa raiz:

- `kubectl rollout undo deployment/api` se o problema começou num deploy.
- Escalar réplicas, desviar tráfego, desativar uma feature flag.
- Mas **preserve evidências** antes: logs `--previous`, eventos, `describe`, métricas do período.

## 6. Registre

Durante o incidente, mantenha uma linha do tempo (horário, observação, ação). Depois, escreva um **postmortem sem culpados**: impacto, linha do tempo, causa raiz, o que funcionou, o que não funcionou e ações preventivas com dono e prazo.

## Armadilhas comuns

- Olhar só os logs e ignorar os eventos (e vice-versa).
- Apagar o Pod problemático antes de coletar informação — o `--previous` e os eventos vão junto.
- Confiar em "uso de CPU médio" para descartar CPU (throttling!).
- Assumir que o problema é "a rede" sem testar salto a salto.
- Esquecer do namespace (`-n`) e investigar o objeto errado.

Use a árvore de diagnóstico abaixo para praticar o caminho do sintoma até a causa e os comandos de confirmação.
