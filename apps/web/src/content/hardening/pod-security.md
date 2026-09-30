# Pod Security: Standards, Admission e securityContext

Um Pod mal configurado transforma a invasão de um container em invasão do **nó** — e, do nó, do cluster. Pod Security é o controle que impede isso em escala.

## Os três perfis (Pod Security Standards)

| Perfil | Para quem | Resumo |
| --- | --- | --- |
| **privileged** | Componentes de sistema confiáveis (CNI, CSI, agentes de monitoramento) | Sem restrições |
| **baseline** | Mínimo aceitável para qualquer workload | Bloqueia escaladas conhecidas: privileged, namespaces do host, hostPath, capabilities extras, hostPort |
| **restricted** | Aplicações em geral (meta) | Baseline + não-root, sem escalada de privilégio, `drop: [ALL]`, seccomp obrigatório, tipos de volume limitados |

### O que o baseline proíbe

- `privileged: true` — acesso a todos os dispositivos do host, praticamente root no nó.
- `hostPID`, `hostIPC`, `hostNetwork` — ver processos do host (e usar `nsenter`), memória compartilhada, rede do nó.
- `hostPath` — montar diretórios do nó (montar `/` é acesso total ao host).
- Capabilities além do conjunto padrão (ex.: `SYS_ADMIN`, `NET_ADMIN`, `SYS_PTRACE`).
- `hostPort`, sysctls inseguros, `procMount: Unmasked`, perfis seccomp/AppArmor/SELinux desativados.

### O que o restricted exige a mais

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]          # só NET_BIND_SERVICE pode ser adicionada
        readOnlyRootFilesystem: true   # não exigido pelo perfil, mas recomendado
```

## Pod Security Admission (PSA)

O controller embutido (substituto da antiga PodSecurityPolicy, removida no 1.25) aplica os perfis por **namespace**, com labels:

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.31
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

| Modo | Efeito |
| --- | --- |
| `enforce` | Rejeita Pods que violam o perfil |
| `warn` | Aceita, mas devolve um aviso ao usuário (`kubectl`) |
| `audit` | Aceita, mas anota o evento no audit log |

Pontos importantes:

- O `enforce` avalia **Pods**; um Deployment inválido é aceito, mas o ReplicaSet não consegue criar os Pods (`FailedCreate` nos eventos). O `warn` e o `audit` avaliam também os templates de workloads — por isso ajudam a descobrir problemas antes.
- Fixe `enforce-version` para não mudar de comportamento a cada upgrade do cluster sem revisão.
- Defaults do cluster via `AdmissionConfiguration` (`defaults` e `exemptions`) — isentar usernames, runtimeClasses ou namespaces, com parcimônia.

### Estratégia de adoção

1. Todos os namespaces com `warn` e `audit` em `restricted`.
2. Colete as violações (avisos no CI, audit log), corrija os manifests.
3. `enforce: baseline` em todos os namespaces de aplicação — ganho grande com pouco atrito.
4. `enforce: restricted` onde as aplicações já estão prontas.
5. Namespaces de sistema com `privileged`, com acesso de escrita restrito a poucos administradores.

```bash
kubectl label --dry-run=server --overwrite ns --all pod-security.kubernetes.io/enforce=restricted
```

O `--dry-run=server` mostra quais Pods existentes violariam o perfil, sem aplicar nada.

## Além do PSA

O PSA é propositalmente simples (três perfis, por namespace). Para regras próprias — registries permitidos, labels obrigatórios, limites de recursos — use **ValidatingAdmissionPolicy** (CEL, nativo), **Kyverno** ou **OPA Gatekeeper**.

## Escolhendo o que colocar no securityContext

| Campo | Protege contra |
| --- | --- |
| `runAsNonRoot`, `runAsUser` | Root dentro do container (mais fácil escapar e alterar arquivos) |
| `allowPrivilegeEscalation: false` | Binários setuid e `no_new_privs` |
| `capabilities.drop: [ALL]` | Chamadas privilegiadas do kernel |
| `seccompProfile: RuntimeDefault` | Syscalls raras usadas em exploits (mount, unshare, keyctl…) |
| `readOnlyRootFilesystem: true` | Persistência e download de ferramentas |
| `automountServiceAccountToken: false` | Roubo do token |

No simulador, avalie Pods contra os perfis e veja as mensagens exatas que o PSA devolve.
