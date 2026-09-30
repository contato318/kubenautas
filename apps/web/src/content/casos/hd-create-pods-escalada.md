# "Os devs não podem ler Secrets" — mas podiam

## Contexto

A política da empresa proíbe desenvolvedores de ler Secrets de produção. O Role `dev` no namespace `pagamentos` foi revisado: não contém `secrets`. Mesmo assim, uma revisão de acessos encontrou, no audit log, a criação de um Pod por um desenvolvedor que montava o Secret de credenciais do gateway de pagamento.

## Sintomas

```text
$ kubectl auth can-i get secrets -n pagamentos --as=ana@empresa.com
no
$ kubectl auth can-i create pods -n pagamentos --as=ana@empresa.com
yes
$ kubectl auth can-i create deployments -n pagamentos --as=ana@empresa.com
yes
```

Evento de auditoria (resumido): `create pods` por `ana@empresa.com`, Pod `debug-ana` com volume do Secret `gateway-credentials`.

<!-- solucao -->

## Investigação

A desenvolvedora explicou que precisava testar a conectividade com o gateway e usou o mesmo Secret da aplicação. Não houve má-fé — mas o controle de acesso não funcionava como a empresa acreditava.

## Causa raiz

Quem pode **criar Pods** (ou Deployments, Jobs, CronJobs…) num namespace pode:

- montar **qualquer Secret** daquele namespace;
- usar **qualquer ServiceAccount** daquele namespace, herdando suas permissões.

A proibição de `get secrets` era contornável por design. Em RBAC, permissões de escrita em workloads valem tanto quanto os Secrets e ServiceAccounts mais sensíveis do namespace.

## Correção

- Em produção, desenvolvedores com acesso **somente leitura**; mudanças via GitOps (o controller aplica, com revisão de PR).
- Secrets de alto valor em namespaces onde só o pipeline cria workloads.
- Admission policy (Kyverno/ValidatingAdmissionPolicy) restringindo quais ServiceAccounts e Secrets cada workload pode usar.
- Rotacionar as credenciais do gateway, por precaução.

## Prevenção

- Revisões de RBAC que consideram caminhos indiretos (rbac-tool, KubiScan, kubescape).
- Alertas para Pods criados por identidades humanas em namespaces de produção.
- Documentar a regra: "criar workloads = acesso aos Secrets do namespace".

Veja o nível de risco de `create pods` no simulador de RBAC.
