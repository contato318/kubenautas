# O que é Kubernetes?

Kubernetes (ou **k8s** — "k", 8 letras, "s") é um **orquestrador de containers** de código aberto, criado pelo Google a partir de mais de uma década de experiência com o Borg e doado à CNCF em 2015.

Em vez de você dizer *como* rodar sua aplicação ("suba o container X na máquina Y"), você declara *o que* quer ("quero 3 réplicas da imagem X, expostas na porta 80") e o Kubernetes trabalha continuamente para que a realidade corresponda a esse desejo.

## Do servidor físico ao container

| Era | Como a aplicação roda | Problema |
|-----|----------------------|----------|
| Servidores físicos | Uma app por máquina | Desperdício de recursos, provisionamento lento |
| Máquinas virtuais | Várias VMs por host | Cada VM carrega um SO inteiro — pesado |
| Containers | Processos isolados compartilhando o kernel | Leve e portátil… mas quem gerencia centenas deles? |

Containers resolveram o empacotamento ("funciona na minha máquina"). Mas em produção surgem perguntas novas:

- Em qual máquina cada container deve rodar?
- O que acontece quando um container morre às 3h da manhã?
- Como escalar de 3 para 30 instâncias na Black Friday?
- Como atualizar a versão sem downtime?
- Como um container encontra o outro na rede?

**Kubernetes responde a todas elas.**

## O modelo declarativo e o loop de reconciliação

O conceito mais importante de todo o curso:

> Você descreve o **estado desejado**. Controladores observam o **estado atual** e agem para eliminar a diferença. Para sempre.

```
loop infinito:
    desejado = ler_spec()
    atual    = observar_cluster()
    se atual != desejado:
        agir_para_convergir()
```

Se você pede 3 réplicas e um nó pega fogo levando uma delas, o controlador percebe "tenho 2, quero 3" e cria outra em um nó saudável. Isso é **self-healing**.

## O que o Kubernetes oferece

- **Service discovery e balanceamento de carga** — nomes DNS estáveis para conjuntos de containers.
- **Orquestração de armazenamento** — monta discos locais, de nuvem ou de rede.
- **Rollouts e rollbacks automatizados** — troca de versão gradual e reversível.
- **Bin packing automático** — encaixa containers nos nós conforme CPU/memória solicitados.
- **Self-healing** — reinicia, substitui e mata containers que falham nos health checks.
- **Gestão de configuração e segredos** — sem reconstruir imagens.
- **Escalonamento horizontal** — manual ou automático por métricas.

## O que o Kubernetes NÃO é

- Não é um PaaS completo: não faz build do seu código nem fornece banco de dados gerenciado.
- Não substitui o Docker/containerd: ele **usa** um container runtime por baixo.
- Não é mágico: aplicações mal projetadas (estado local, sem health check) continuam frágeis.

## Onde rodar para estudar

| Ferramenta | Ideal para |
|-----------|------------|
| **kind** (Kubernetes in Docker) | Clusters descartáveis e multi-nó no laptop |
| **minikube** | Cluster local com addons prontos (ingress, dashboard) |
| **k3d / k3s** | Distribuição leve, ótima para edge e CI |
| **Docker Desktop / Rancher Desktop** | Um clique para habilitar |
| **EKS / GKE / AKS** | Clusters gerenciados em produção |

> Neste curso você não precisa de um cluster real: os simuladores e o terminal `kubectl` interativo rodam no navegador.
