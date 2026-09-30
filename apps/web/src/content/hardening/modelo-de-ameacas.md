# Modelo de ameaças e defesa em profundidade

Hardening não é uma lista de flags para copiar: é reduzir, de forma **priorizada**, as maneiras realistas de alguém abusar do seu cluster. Para priorizar, você precisa de um modelo de ameaças.

## Quem ataca um cluster, e como

| Atacante | Ponto de entrada típico | Objetivo comum |
| --- | --- | --- |
| Externo oportunista | API server, Dashboard ou kubelet expostos; aplicações vulneráveis | Mineração de criptomoedas, botnets |
| Externo direcionado | Vulnerabilidade numa aplicação, credencial vazada, cadeia de suprimentos | Dados, movimento lateral para a nuvem |
| Workload comprometido | RCE numa dependência (ex.: Log4Shell) | Escalar para o nó e o cluster |
| Insider / credencial de dev | kubeconfig roubado, permissões amplas demais | Dados, sabotagem |
| Cadeia de suprimentos | Imagem base, pacote ou chart malicioso | Execução em todos os ambientes |

A maioria dos incidentes reais em Kubernetes começa de forma **nada sofisticada**: um painel exposto, um token vazado, uma imagem vulnerável. O hardening mais valioso fecha essas portas óbvias.

## Os 4Cs da segurança cloud native

```
Cloud  →  Cluster  →  Container  →  Code
```

Cada camada depende da de fora: um cluster impecável numa conta de nuvem com credenciais de admin vazadas não está seguro. E cada camada deve assumir que a de dentro **pode** falhar: se o código for explorado, o container deve limitar o estrago; se o container for comprometido, o cluster deve conter o invasor.

## Superfície de ataque do Kubernetes

- **API server** — a porta principal. Autenticação, autorização (RBAC), admission.
- **kubelet** (porta 10250) — executa comandos em containers; precisa de autenticação e autorização.
- **etcd** — guarda **todo** o estado, incluindo Secrets. Quem lê o etcd é dono do cluster.
- **Nós** — SSH, runtime de containers, sistema operacional, credenciais da nuvem no metadata service.
- **Workloads** — imagens, dependências, configurações de segurança dos Pods.
- **Rede** — tráfego leste-oeste entre Pods, saída para a internet.
- **Cadeia de suprimentos** — registries, CI/CD, charts, operadores de terceiros.
- **Pessoas e processos** — kubeconfigs, acesso de emergência, revisões.

## Uma cadeia de ataque típica

O framework **MITRE ATT&CK** (e a matriz de ameaças para Kubernetes da Microsoft, baseada nele) organiza técnicas por tática. Um ataque real encadeia várias:

1. **Acesso inicial** — RCE numa aplicação exposta.
2. **Execução** — shell no container, download de ferramentas.
3. **Acesso a credenciais** — token da ServiceAccount montado em `/var/run/secrets/kubernetes.io/serviceaccount/`.
4. **Descoberta** — `kubectl auth can-i --list` com o token roubado.
5. **Escalada de privilégio** — criar um Pod privilegiado com `hostPath: /` e `hostPID`, ou abusar de RBAC amplo.
6. **Movimento lateral** — do nó para outros nós, ou para a **conta de nuvem** pelo endpoint de metadata (`169.254.169.254`).
7. **Impacto** — mineração, exfiltração de dados, ransomware.

Cada etapa é uma oportunidade de **prevenir** ou **detectar**.

## Defesa em profundidade

Nenhum controle é perfeito. Combine controles independentes, para que a falha de um não signifique comprometimento total:

| Etapa | Prevenção | Detecção |
| --- | --- | --- |
| Acesso inicial | Scan e atualização de imagens, WAF, menos exposição | Logs da aplicação |
| Execução | Imagens mínimas, `readOnlyRootFilesystem`, seccomp | Falco/Tetragon |
| Credenciais | `automountServiceAccountToken: false`, tokens curtos | Audit log |
| Escalada | RBAC mínimo, Pod Security `restricted`, admission policies | Audit log, alertas de RBAC |
| Movimento lateral | NetworkPolicy, bloqueio do metadata, IMDSv2 com hop limit 1 | Flow logs |

## Referências para guiar o trabalho

- **CIS Kubernetes Benchmark** — controles verificáveis de configuração (use `kube-bench`).
- **NSA/CISA Kubernetes Hardening Guide** — visão ampla e priorizada.
- **Pod Security Standards** — perfis oficiais para Pods.
- **OWASP Kubernetes Top 10** — os riscos mais comuns (configurações inseguras de workloads, RBAC amplo, falta de políticas de rede, segredos mal gerenciados…).
- Ferramentas de postura: **kubescape**, **Trivy** (modo cluster), **Polaris**, **kube-bench**.

## Como priorizar

1. **Exposição externa** primeiro: API server, Dashboard, kubelet, Ingress de ferramentas internas.
2. **Identidades**: quem tem cluster-admin, tokens de longa duração, credenciais em CI.
3. **Workloads**: Pod Security, imagens, privilégios.
4. **Rede**: default-deny e bloqueio de metadata.
5. **Detecção e resposta**: audit log, runtime, runbooks.

No simulador, ligue e desligue controles e veja em que etapa a cadeia de ataque é interrompida — e se alguém ficaria sabendo.
