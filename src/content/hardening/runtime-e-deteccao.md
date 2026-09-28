# Segurança em runtime: isolamento e detecção

As lições anteriores reduzem a chance de um container ser comprometido e o que ele pode fazer na API. Esta trata do que acontece **dentro** do container em execução: limitar o que o processo consegue pedir ao kernel e perceber quando algo anômalo acontece.

## Isolamento no kernel

### seccomp

Filtra **syscalls**. O perfil `RuntimeDefault` do containerd/CRI-O bloqueia dezenas de chamadas raras e perigosas (`mount`, `unshare`, `keyctl`, `bpf`, `ptrace` em alguns casos…), usadas em várias técnicas de escape.

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault          # ou Localhost com um perfil próprio
```

Para aplicar a todos os Pods por padrão, o kubelet tem `seccompDefault: true`. Perfis personalizados podem ser gerados a partir do comportamento real (Security Profiles Operator).

### Capabilities

O root do container tem um subconjunto de capabilities do Linux. Remova todas e adicione só o necessário:

```yaml
capabilities:
  drop: ["ALL"]
  add: ["NET_BIND_SERVICE"]     # só se precisar escutar abaixo de 1024
```

`SYS_ADMIN` é "quase root": permite `mount`, manipular namespaces e muito mais.

### AppArmor e SELinux

Controles de acesso obrigatórios (MAC) que restringem arquivos, rede e capacidades mesmo para root. Em distribuições com SELinux (RHEL, OpenShift), mantenha-o em `enforcing`; com AppArmor, use o perfil `runtime/default` (campo `appArmorProfile` no securityContext, GA no 1.30).

### Sistema de arquivos somente leitura

`readOnlyRootFilesystem: true` impede que o invasor grave ferramentas, altere binários ou persista. Monte `emptyDir` apenas onde a aplicação precisa escrever (`/tmp`, cache).

### Sandboxes para cargas não confiáveis

Para código de terceiros ou multi-tenant hostil, o kernel compartilhado é um risco. **RuntimeClass** permite usar:

- **gVisor** (`runsc`) — kernel em espaço de usuário que intercepta syscalls.
- **Kata Containers** — cada Pod numa micro-VM com kernel próprio.

```yaml
spec:
  runtimeClassName: gvisor
```

## Detecção em runtime

Prevenção falha. Ferramentas de detecção observam syscalls e eventos do kernel (via eBPF) e alertam sobre comportamentos suspeitos:

| Ferramenta | Destaque |
| --- | --- |
| **Falco** (CNCF) | Regras declarativas com contexto de Kubernetes (namespace, Pod, imagem) |
| **Tetragon** (Cilium) | Observabilidade e **enforcement** em eBPF (pode matar o processo) |
| **KubeArmor** | Políticas de runtime por workload com AppArmor/BPF-LSM |

Exemplos de regras do Falco:

- `Terminal shell in container` — shell interativo onde não deveria haver.
- `Write below binary dir` — escrita em `/bin`, `/usr/bin`…
- `Drop and execute new binary in container` — executar algo que não veio na imagem.
- `Contact cloud metadata service from container`.
- `Read sensitive file untrusted` — leitura de `/etc/shadow` e similares.

```yaml
- rule: Shell em produção
  desc: Shell iniciado em container do namespace loja
  condition: spawned_process and container and proc.name in (bash, sh, zsh) and k8s.ns.name = "loja"
  output: "Shell em %k8s.ns.name/%k8s.pod.name (user=%user.name cmd=%proc.cmdline image=%container.image.repository)"
  priority: WARNING
```

Encaminhe os alertas (Falcosidekick) para o SIEM, Slack ou um sistema de resposta automática (ex.: isolar o Pod com uma NetworkPolicy).

## Imagens imutáveis e drift

Um container em produção deve executar **apenas** o que veio na imagem. Qualquer binário novo (drift) é um sinal forte de comprometimento. Imagens distroless + read-only + detecção de "novo executável" tornam o drift praticamente impossível de esconder.

## Juntando tudo

```yaml
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: api
      image: registry.empresa.com/loja/api@sha256:4f1a…
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: ["ALL"] }
      volumeMounts: [{ name: tmp, mountPath: /tmp }]
  volumes: [{ name: tmp, emptyDir: { medium: Memory, sizeLimit: 64Mi } }]
```

No simulador, veja cada ação de um invasor ser prevenida, detectada ou passar despercebida conforme os controles ativos.
