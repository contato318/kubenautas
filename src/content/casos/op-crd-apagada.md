# Um helm uninstall apagou todos os certificados

## Contexto

Ao migrar o cert-manager para um novo método de instalação, um engenheiro rodou `helm uninstall cert-manager` pretendendo reinstalar em seguida. A reinstalação levou dois minutos. Nesse intervalo, os Ingress de produção começaram a servir certificados inválidos — e depois da reinstalação, continuaram assim.

## Sintomas

```text
$ kubectl get certificates -A
No resources found

$ kubectl get secrets -n loja | grep tls
(vazio)

$ curl -v https://loja.exemplo.com 2>&1 | grep -i "certificate"
* SSL certificate problem: self-signed certificate   ← certificado padrão do ingress controller
```

<!-- solucao -->

## Investigação

O chart instalava os CRDs como templates normais (`installCRDs=true`). O histórico do Helm mostra:

```text
$ helm history cert-manager -n cert-manager
REVISION  STATUS       DESCRIPTION
1         uninstalled  Uninstallation complete
```

E o audit log registra `DELETE customresourcedefinitions/certificates.cert-manager.io`.

## Causa raiz

Os CRDs faziam parte da release. `helm uninstall` apagou os CRDs — e **apagar um CRD apaga todos os objetos daquele tipo em todos os namespaces**. Como o cert-manager rodava com `--enable-certificate-owner-ref` (os Secrets TLS recebem ownerReference para o `Certificate`), o garbage collector apagou também os Secrets quando os `Certificate` sumiram. Reinstalar recriou os CRDs **vazios**.

## Correção

- Restaurar os manifests de `Certificate`, `Issuer` e `ClusterIssuer` a partir do Git (GitOps) ou de backup (Velero), e deixar o cert-manager reemitir — observando os limites de emissão da CA (ex.: Let's Encrypt).
- Enquanto isso, usar um certificado temporário no Ingress para os domínios críticos.

## Prevenção

- CRDs fora da release do operador (chart separado ou `crds/`), ou com a anotação `helm.sh/resource-policy: keep`.
- RBAC: poucas pessoas com permissão de `delete` em `customresourcedefinitions`.
- Admission policy (CEL/Kyverno/OPA) bloqueando remoção de CRDs com um label de proteção.
- Backups regulares dos CRs (Velero) e de tudo em Git.
- Tratar CRDs como schema de banco de dados: mudanças revisadas, nunca removidas "para reinstalar".
