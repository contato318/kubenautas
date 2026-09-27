# O operador novo não aceita os recursos novos

## Contexto

O time atualizou o chart do operador de certificados para a versão que suporta um campo novo (`spec.privateKey.rotationPolicy`). O `helm upgrade` passou, o operador está na versão nova — mas os manifestos que usam o campo novo são rejeitados.

## Sintomas

```text
$ kubectl apply -f certificado.yaml
Error from server (BadRequest): error when creating "certificado.yaml": Certificate in version "v1"
cannot be handled as a Certificate: strict decoding error: unknown field "spec.privateKey.rotationPolicy"

$ helm list -n cert-manager
NAME           REVISION   STATUS     CHART                  APP VERSION
cert-manager   7          deployed   cert-manager-v1.x.0    v1.x.0
```

<!-- solucao -->

## Investigação

```text
$ kubectl get crd certificates.cert-manager.io -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}'
v1.(versão antiga)

$ helm show chart ./cert-manager | grep -i crd
# o chart traz as CRDs no diretório crds/
```

## Causa raiz

CRDs no diretório **`crds/`** são instaladas pelo Helm **somente na primeira instalação**. Em `helm upgrade` elas **não são atualizadas** (nem removidas no uninstall), por segurança: mudar ou apagar uma CRD pode destruir todos os recursos customizados do cluster. O operador foi atualizado; o schema da API (CRD), não.

## Correção

Atualizar as CRDs explicitamente, antes do upgrade do operador:

```bash
helm pull jetstack/cert-manager --version <nova> --untar
kubectl apply --server-side -f cert-manager/crds/
helm upgrade cert-manager jetstack/cert-manager -n cert-manager --version <nova>
```

Muitos charts oferecem uma opção para gerenciar as CRDs como templates (ex.: `crds.enabled=true` / `installCRDs=true`), que passam a ser atualizadas nos upgrades — com `helm.sh/resource-policy: keep` para não serem apagadas no uninstall.

## Prevenção

- Leia as notas de upgrade de operadores: quase sempre há um passo de CRDs.
- Padronize: CRDs em chart separado (ou aplicadas pelo pipeline) antes do chart do operador.
- Em GitOps, trate as CRDs como uma aplicação própria, sincronizada primeiro.
