# Cadeia de suprimentos: imagens confiáveis do build ao deploy

Você pode endurecer o cluster inteiro e, ainda assim, executar código malicioso — basta ele vir **dentro** de uma imagem. A cadeia de suprimentos cobre tudo que leva código até o cluster: dependências, imagens base, CI, registry, charts e operadores.

## Ameaças

- **Typosquatting** e imagens maliciosas em registries públicos (`ngnix` em vez de `nginx`).
- Dependências comprometidas (pacotes npm/PyPI sequestrados).
- Imagens base desatualizadas, com CVEs críticas conhecidas.
- Pipeline de CI comprometido publicando imagens "oficiais" alteradas.
- Tags mutáveis: a imagem por trás de `:1.4` muda sem ninguém perceber.

## Controles no build

1. **Imagens base mínimas e confiáveis** (distroless, Chainguard/Wolfi, oficiais), fixadas por digest e atualizadas com frequência (Renovate/Dependabot).
2. **Scan de vulnerabilidades** no CI, com política clara (ex.: bloquear CVEs críticas **com correção disponível**).
3. **SBOM** (SPDX/CycloneDX) gerado a cada build: responde rápido "onde usamos a biblioteca X?".
4. **Proveniência** (SLSA): atestado de onde, como e a partir de qual commit a imagem foi construída.
5. **Assinatura** com Sigstore/cosign — idealmente *keyless* (identidade OIDC do pipeline) — assinando a imagem e anexando SBOM e resultado do scan como **atestações**.

```bash
cosign sign --yes registry.empresa.com/loja/api@sha256:4f1a…
cosign attest --yes --type cyclonedx --predicate sbom.json registry.empresa.com/loja/api@sha256:4f1a…
cosign verify registry.empresa.com/loja/api@sha256:4f1a… \
  --certificate-identity-regexp 'https://github.com/empresa/api/.github/workflows/release.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Controles no registry

- Registry privado como **única** origem; imagens públicas espelhadas/importadas após verificação.
- **Tags imutáveis** habilitadas.
- Scan contínuo (novas CVEs surgem para imagens antigas).
- Acesso de escrita só para o CI.

## Controles no cluster: admission

O ponto de controle final é o **admission**: o cluster só executa o que passa pelas políticas.

```yaml
# Kyverno: exige assinatura do pipeline oficial e digest
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: verify-images }
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 15
  rules:
    - name: assinatura-do-ci
      match: { any: [{ resources: { kinds: [Pod] } }] }
      verifyImages:
        - imageReferences: ["registry.empresa.com/*"]
          mutateDigest: true
          verifyDigest: true
          attestors:
            - entries:
                - keyless:
                    issuer: https://token.actions.githubusercontent.com
                    subject: "https://github.com/empresa/*"
```

Políticas típicas:

| Política | Efeito |
| --- | --- |
| Registries permitidos | Bloqueia imagens de fora do registry da empresa |
| Assinatura obrigatória | Só imagens assinadas pelo pipeline oficial |
| Digest obrigatório / proibir `latest` | Deploy imutável e rastreável |
| Atestação de scan sem CVEs críticas | Barra imagens vulneráveis |
| `imagePullPolicy: Always` para tags | Evita usar cópia local adulterada/antiga |

Alternativas: **Sigstore policy-controller**, **OPA Gatekeeper** + Ratify, **ValidatingAdmissionPolicy** (CEL) para regras simples como registries permitidos.

### Implantação segura das políticas

- Comece em **Audit** (Kyverno) / `warn` e leia os relatórios de política.
- Exclua namespaces de sistema com critério — cada exclusão é um caminho de bypass.
- Webhooks de admission em alta disponibilidade; decida conscientemente entre `failurePolicy: Fail` (seguro, pode bloquear deploys) e `Ignore` (disponível, pode deixar passar).

## Charts e operadores de terceiros

- Revise o RBAC e os `securityContext` que eles pedem.
- Fixe versões e digests; verifique assinaturas/proveniência quando o projeto oferecer.
- Renderize (`helm template`) e passe pelos mesmos scanners de configuração (kubescape, checkov, trivy config).

No simulador, ative as políticas uma a uma e veja quais imagens seriam admitidas — em Enforce e em Audit.
