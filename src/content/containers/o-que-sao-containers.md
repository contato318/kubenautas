# O que são containers (e o que o Docker faz)

Antes de orquestrar containers com Kubernetes, você precisa entender o que um container **é**. Spoiler: não é uma máquina virtual pequena. É um **processo comum do Linux**, isolado por recursos do próprio kernel.

## O problema que containers resolvem

"Funciona na minha máquina" acontece porque aplicações dependem de muita coisa além do código: versão da linguagem, bibliotecas do sistema, variáveis de ambiente, arquivos de configuração. Um container empacota a aplicação **com** o sistema de arquivos de que ela precisa, e a executa isolada — igual no notebook, no CI e em produção.

## Container × máquina virtual

| | Máquina virtual | Container |
| --- | --- | --- |
| O que é | Um computador inteiro emulado, com kernel próprio | Um processo do host, isolado |
| Kernel | Um por VM | Compartilhado com o host |
| Tempo para iniciar | Dezenas de segundos | Milissegundos |
| Tamanho típico | Gigabytes | Megabytes |
| Isolamento | Forte (hipervisor) | Bom, mas o kernel é compartilhado |

Consequência importante: um container Linux precisa de um kernel Linux. No Mac e no Windows, o Docker Desktop roda uma **VM Linux leve** por baixo — seus containers rodam nela.

## As peças do kernel

Três mecanismos do Linux fazem a mágica:

### Namespaces — o que o processo **vê**

| Namespace | Isola |
| --- | --- |
| `pid` | Árvore de processos (o processo principal é o PID 1 dentro do container) |
| `net` | Interfaces de rede, IPs, portas, tabelas de rota |
| `mnt` | Pontos de montagem (o sistema de arquivos do container) |
| `uts` | Hostname |
| `ipc` | Memória compartilhada, filas |
| `user` | Mapeamento de UIDs (root dentro ≠ root fora, quando usado) |

### cgroups — o que o processo pode **usar**

Control groups limitam e contabilizam CPU, memória, I/O e número de processos. `docker run --memory=512m` vira um limite de cgroup — e é o kernel que mata o processo (OOM) quando ele passa do limite.

### Sistema de arquivos em camadas (union filesystem)

A imagem é uma pilha de camadas **somente leitura**; o container ganha uma camada fina **gravável** por cima (overlayfs). Por isso iniciar é instantâneo e dez containers da mesma imagem não copiam os arquivos dez vezes.

```bash
# um container é só um processo — veja-o no host (Linux):
docker run -d --name web nginx:1.27
ps aux | grep "nginx: master"      # aparece na lista de processos do host
```

## O padrão OCI e os runtimes

A **Open Container Initiative (OCI)** padronizou três coisas: o formato da **imagem**, a especificação do **runtime** e a **distribuição** (como registries servem imagens). Graças a isso, uma imagem construída com Docker roda em containerd, CRI-O, Podman ou Kubernetes.

A pilha do Docker:

```
docker (CLI)  →  dockerd (Docker Engine, API)  →  containerd (ciclo de vida, imagens)  →  runc (cria o processo com namespaces e cgroups)
```

- **runc** — runtime de baixo nível: recebe um bundle OCI e cria o processo isolado.
- **containerd** — gerencia imagens, snapshots e containers; é o que o Kubernetes usa na maioria dos clusters.
- **Docker Engine** — acrescenta a experiência do desenvolvedor: build, redes, volumes, Compose, CLI amigável.
- Alternativas: **Podman** (sem daemon, rootless), **nerdctl** (CLI parecida com a do Docker sobre containerd), **CRI-O** (runtime focado em Kubernetes).

## Primeiros comandos

```bash
docker version                     # cliente e servidor (daemon) respondendo?
docker info                        # runtime, storage driver, cgroups
docker run --rm hello-world        # baixa a imagem, cria, executa e remove o container
docker run --rm -it alpine:3.20 sh # um shell dentro de um container Alpine
```

Dentro do shell do Alpine, experimente `ps`, `hostname` e `cat /etc/os-release`: você verá só o seu processo, um hostname aleatório e outro "sistema operacional" — mas `uname -r` mostra o **kernel do host**.

## Imagem × container

- **Imagem** — o molde: sistema de arquivos + metadados (comando padrão, variáveis, usuário). Imutável.
- **Container** — uma instância em execução (ou parada) de uma imagem, com sua camada gravável própria.

A relação é a de uma **classe** com seus **objetos**: de uma imagem, quantos containers você quiser.
