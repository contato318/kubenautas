# Hardening do control plane, kubelet e etcd

Em clusters gerenciados (EKS, GKE, AKS), o provedor cuida da maior parte do control plane — mas **não** de tudo: o endpoint público, a autenticação dos usuários, a auditoria e a criptografia de Secrets costumam ser configurações suas. Em clusters próprios (kubeadm, RKE2, k3s), tudo é responsabilidade sua.

## API server

### Autenticação

- Desabilite métodos fracos: sem tokens estáticos (`--token-auth-file`), sem basic auth (já removido).
- Usuários humanos via **OIDC** (SSO da empresa, com MFA) — nada de certificados de cliente de longa duração distribuídos por e-mail.
- `--anonymous-auth`: em versões recentes, limite o acesso anônimo apenas aos endpoints de saúde (`AuthenticationConfiguration` com `anonymous.conditions`) ou desligue-o; confira que `system:anonymous` e `system:unauthenticated` não têm bindings além da descoberta básica.
- Certificados do grupo **`system:masters`** ignoram o RBAC e **não podem ser revogados** — só expiram. Use-os apenas para acesso de emergência, guardados offline.

### Autorização e admission

```text
--authorization-mode=Node,RBAC
--enable-admission-plugins=NodeRestriction,…
```

- **Node** autoriza kubelets a acessarem apenas objetos relacionados aos Pods do seu próprio nó.
- **NodeRestriction** impede que um kubelet altere labels de outros nós ou labels protegidos (`node-restriction.kubernetes.io/`) — um nó comprometido não consegue se "promover" para atrair workloads sensíveis.
- Nunca `AlwaysAllow`.

### Outras flags relevantes

| Flag | Recomendação |
| --- | --- |
| `--profiling` | `false` |
| `--audit-policy-file`, `--audit-log-path` | Habilitar (lição de auditoria) |
| `--encryption-provider-config` | Habilitar (lição de Secrets) |
| `--tls-min-version` | `VersionTLS12` ou superior |
| `--service-account-issuer`, `--service-account-key-file` | Chaves protegidas e rotacionáveis |

### Exposição de rede

O API server exposto na internet recebe varreduras constantes. Prefira endpoint **privado**, VPN/bastion ou, no mínimo, **lista de IPs autorizados**. Um API server bem configurado resiste, mas zero-days e credenciais vazadas acontecem.

## kubelet

A API do kubelet (porta **10250**) permite executar comandos em containers (`/exec`, `/run`), ler logs e listar Pods. Configuração segura (`KubeletConfiguration`):

```yaml
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true          # valida tokens no API server
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook            # pergunta ao API server (SubjectAccessReview)
readOnlyPort: 0            # desliga a porta 10255, sem autenticação
protectKernelDefaults: true
rotateCertificates: true
serverTLSBootstrap: true
```

Com `anonymous.enabled: true` e `authorization.mode: AlwaysAllow`, **qualquer um que alcance a porta 10250 executa comandos em qualquer container do nó** — sem passar pelo API server nem pelo RBAC. Esse foi o vetor de muitas campanhas de mineração.

Permissões RBAC em `nodes/proxy` também dão acesso a essa API através do API server: trate-as como equivalentes a acesso total aos Pods do nó.

## etcd

- Comunicação **somente com TLS mútuo**: `--client-cert-auth=true`, `--peer-client-cert-auth=true`, certificados próprios (não compartilhe a CA do cluster para identidades do etcd sem necessidade).
- Porta 2379 acessível **apenas** pelos API servers (firewall/security groups).
- Criptografia de disco e de **snapshots**; backups com acesso restrito — um snapshot do etcd é uma cópia de todos os Secrets.

## Nós

- Sistema operacional mínimo e imutável quando possível (Bottlerocket, Talos, Flatcar, COS).
- Sem SSH rotineiro; acesso por sessão auditada (SSM, IAP) e `kubectl debug node` controlado por RBAC.
- Atualizações automáticas do SO e do runtime; kernel com correções.
- **Metadata da nuvem**: IMDSv2 obrigatório com `hop limit = 1` (containers não alcançam as credenciais do nó) e identidades por workload (IRSA, Pod Identity, Workload Identity) em vez do papel do nó.

## Verificando

```bash
kube-bench run --targets master,node        # CIS Benchmark
kubescape scan framework nsa,mitre
curl -sk https://<nó>:10250/pods            # deve responder 401 Unauthorized
```

No simulador, parta de um cluster "de laboratório", corrija as falhas críticas e compare com um cluster kubeadm recente.
