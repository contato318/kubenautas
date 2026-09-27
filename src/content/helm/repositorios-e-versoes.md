# Repositórios, OCI e versões

Charts são artefatos: precisam de versão, de um lugar para morar e de garantias de integridade.

## Repositórios HTTP clássicos

Um repositório clássico é um servidor HTTP com um `index.yaml` que lista todos os charts e versões, mais os `.tgz`:

```bash
helm package ./loja                        # gera loja-1.4.0.tgz
helm repo index . --url https://charts.exemplo.com
helm repo add exemplo https://charts.exemplo.com
helm repo update                           # baixa o index.yaml atualizado
helm search repo exemplo/loja --versions   # lista versões
helm pull exemplo/loja --version 1.4.0 --untar
```

Pode ser hospedado em GitHub Pages, S3, Artifactory, Nexus, Harbor, ChartMuseum… O `index.yaml` cresce com o tempo e é baixado inteiro a cada `repo update`.

## Registries OCI (o padrão atual)

Charts podem ser guardados no mesmo registry das imagens de container, como **artefatos OCI**:

```bash
helm registry login registry.exemplo.com
helm package ./loja
helm push loja-1.4.0.tgz oci://registry.exemplo.com/charts
helm install loja oci://registry.exemplo.com/charts/loja --version 1.4.0
helm show values oci://registry.exemplo.com/charts/loja --version 1.4.0
```

Vantagens: mesma autenticação, permissões e replicação das imagens; sem `index.yaml`; sem `helm repo add`. Registros como Harbor, GHCR, ECR, GAR, ACR e Docker Hub suportam OCI. Em ambientes sem internet, espelhe charts e imagens no mesmo registry interno.

## SemVer e restrições de versão

A `version` do chart é SemVer 2: `MAJOR.MINOR.PATCH[-prerelease][+build]`. Em `dependencies[].version` e em `--version`, você pode usar **restrições**:

| Restrição | Significa |
| --- | --- |
| `1.4.0` | Exatamente 1.4.0 |
| `~1.4.0` | `>=1.4.0 <1.5.0` — só correções |
| `^1.4.0` | `>=1.4.0 <2.0.0` — tudo compatível |
| `^0.4.0` | `>=0.4.0 <0.5.0` — em 0.x, o minor é tratado como major |
| `1.4.x` ou `1.4` | `>=1.4.0 <1.5.0` |
| `>=1.2.0 <1.6.0` | Intervalo (espaço ou vírgula = E) |
| `1.2 - 1.6` | `>=1.2 <=1.6` |
| `^1.0.0 \|\| ^2.0.0` | OU |

- O Helm escolhe a **maior** versão que satisfaz a restrição.
- **Prereleases** (`-rc.1`, `-beta.2`) só entram se a restrição também tiver prerelease (ex.: `>=16.1.0-0`).
- O resultado exato fica no `Chart.lock`.

## Integridade e procedência

- **Provenance (`.prov`)**: `helm package --sign --key 'Time Plataforma' --keyring ~/.gnupg/secring.gpg` gera uma assinatura PGP; `helm install --verify` confere antes de instalar.
- **Charts OCI** podem ser assinados com **cosign** (Sigstore), como imagens — e políticas de admission podem exigir assinatura.
- Nunca reutilize uma versão: publicar `1.4.0` duas vezes com conteúdos diferentes quebra locks e caches.

## Testando charts no CI

```bash
helm lint ./loja -f values-prod.yaml --strict
helm template loja ./loja -f values-prod.yaml | kubeconform -strict -summary
helm unittest ./loja                     # plugin helm-unittest: testes de template em YAML
ct lint --charts ./loja                  # chart-testing: lint + checagem de bump de versão
ct install --charts ./loja               # instala num cluster efêmero (kind) e roda helm test
```

- **kubeconform** valida o YAML renderizado contra os schemas do Kubernetes (e de CRDs).
- **helm-unittest** permite asserções como "com ingress.enabled=true, existe um Ingress com host X".
- **chart-testing (`ct`)** também exige que a versão seja incrementada quando o chart muda.

## Fluxo de publicação típico

1. PR altera o chart → CI roda lint, unittest, kubeconform e `ct install` num kind.
2. Merge → CI incrementa (ou valida) a `version`, `helm package`, assina e faz `helm push` para o registry OCI.
3. Ambientes consomem uma versão fixa do chart (por GitOps ou pipeline).

No simulador, teste restrições contra uma lista de versões e veja qual o Helm escolheria — inclusive com prereleases.
