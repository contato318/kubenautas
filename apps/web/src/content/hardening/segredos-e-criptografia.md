# Segredos e criptografia

Um `Secret` do Kubernetes **não é secreto por padrão**: os dados são apenas codificados em base64, gravados no etcd em texto e legíveis por qualquer identidade com `get`/`list` em `secrets` — ou com permissão de criar Pods no namespace.

```bash
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d
```

Proteger segredos exige controles em várias frentes.

## 1. Criptografia em repouso no etcd

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: [secrets]
    providers:
      - kms:
          apiVersion: v2
          name: kms-da-nuvem
          endpoint: unix:///var/run/kmsplugin/socket.sock
      - identity: {}          # permite LER dados antigos ainda não criptografados
```

- O **primeiro** provider é usado para **gravar**; os demais só para ler. `identity` primeiro = sem criptografia.
- `aescbc`/`aesgcm`/`secretbox` usam uma chave **no próprio arquivo** do control plane — protegem o disco e os backups do etcd, mas não quem acessa o host.
- **KMS v2** (envelope encryption): a chave mestra fica num KMS externo (nuvem, HSM, Vault); é a opção recomendada.
- Depois de habilitar, **regrave** os Secrets existentes: `kubectl get secrets -A -o json | kubectl replace -f -`.
- Em clusters gerenciados, habilite a criptografia de Secrets com a chave do KMS do provedor (EKS, GKE, AKS oferecem).

## 2. Quem pode ler

- `list` em secrets entrega o conteúdo de **todos** — nunca conceda a humanos em produção.
- Aplicações leem só os seus: `resourceNames` no Role, ou, melhor, apenas montam o Secret (sem nenhuma permissão na API).
- Lembre: quem cria Pods, Deployments ou Jobs no namespace consegue montar qualquer Secret dele. Separe namespaces por nível de confiança.

## 3. Como a aplicação consome

| Forma | Riscos |
| --- | --- |
| Variável de ambiente | Aparece em `/proc/<pid>/environ`, em crash dumps, em `docker inspect`/`crictl inspect`, em logs de frameworks que imprimem o ambiente; não atualiza sem reinício |
| Arquivo montado (volume) | tmpfs, permissões controláveis (`defaultMode: 0400`), atualizado automaticamente (exceto com `subPath`) |

Prefira arquivos. E nunca logue configuração completa na inicialização.

## 4. Onde o Secret nasce: GitOps sem vazar

Manifests de Secret em texto no Git ficam no histórico para sempre. Opções:

- **External Secrets Operator** — o Git guarda só uma referência (`ExternalSecret`); o valor vem do AWS Secrets Manager, GCP Secret Manager, Azure Key Vault ou Vault.
- **Secrets Store CSI Driver** — monta o segredo direto do cofre como arquivo, podendo nem criar um Secret no cluster.
- **Sealed Secrets** / **SOPS** — o Git guarda o valor **cifrado**; só o cluster (ou quem tem a chave) decifra.
- **Vault Agent Injector** — sidecar que busca e renova segredos dinâmicos (credenciais de banco com validade curta).

## 5. Rotação

- Segredos com validade curta (credenciais dinâmicas do Vault, tokens projetados) reduzem a janela de abuso.
- Planeje rotação sem downtime: aplicações que releem o arquivo montado, ou rollout automático quando o Secret muda (checksum em anotação, Reloader).
- Tenha um runbook de "segredo vazou": revogar na origem, rotacionar, investigar uso.

## 6. Backups e cópias

Snapshots do etcd, backups do Velero e dumps de recursos (`kubectl get all -o yaml`) contêm Secrets. Criptografe e restrinja o acesso aos buckets; com criptografia em repouso, o snapshot contém os dados cifrados (a chave não vai junto).

## 7. Detectando exposição

- Audit log com `get`/`list` em secrets (nível `Metadata`, nunca o corpo).
- Scanners de segredos em repositórios, imagens e logs (gitleaks, trufflehog, trivy).
- Alertas para leitura de Secrets por identidades humanas.

No simulador, feche os vetores de exposição do Secret de banco de dados um a um.
