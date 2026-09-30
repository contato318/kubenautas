# Upgrade do chart 2.0 falha com "field is immutable"

## Contexto

A plataforma lançou a versão **2.0** do chart base, com labels "melhorados": o helper `selectorLabels` passou a incluir `app.kubernetes.io/version`. O primeiro serviço a atualizar quebrou o pipeline.

## Sintomas

```text
$ helm upgrade pedidos ./chart -n pedidos --version 2.0.0
Error: UPGRADE FAILED: cannot patch "pedidos" with kind Deployment: Deployment.apps "pedidos" is invalid:
spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{
"app.kubernetes.io/instance":"pedidos", "app.kubernetes.io/name":"pedidos",
"app.kubernetes.io/version":"3.2.0"}}: field is immutable
```

<!-- solucao -->

## Investigação

```text
$ helm diff upgrade pedidos ./chart --version 2.0.0 | grep -A4 selector
   selector:
     matchLabels:
       app.kubernetes.io/instance: pedidos
       app.kubernetes.io/name: pedidos
+      app.kubernetes.io/version: "3.2.0"
```

## Causa raiz

O `spec.selector` de Deployments, StatefulSets e DaemonSets é **imutável** depois da criação. Incluir no selector um label que muda (versão da aplicação, versão do chart) torna impossível atualizar o objeto — e mesmo que desse, a cada nova versão os Pods antigos deixariam de ser selecionados.

## Correção

Reverter o helper: o selector deve ter **somente** labels estáveis.

```yaml
{{- define "base.selectorLabels" -}}
app.kubernetes.io/name: {{ include "base.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

`version` e `helm.sh/chart` continuam nos labels **gerais** (metadata), não no selector. Se uma mudança de selector for realmente necessária, ela exige recriar o objeto (novo nome ou `kubectl delete deployment --cascade=orphan` seguido de upgrade), numa janela planejada.

## Prevenção

- Trate mudanças de selector como **breaking change** (major) e documente a migração.
- Teste de upgrade no CI: instalar a versão anterior do chart e fazer upgrade para a nova (o `ct install --upgrade` faz isso).
- Revise diffs de selector com cuidado redobrado.
