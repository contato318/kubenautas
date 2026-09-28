# O incidente que ninguém conseguiu reconstruir

## Contexto

Um ClusterRoleBinding para `cluster-admin` apareceu em produção, vinculado a uma ServiceAccount de um namespace de testes. O time de segurança precisava responder: quem criou, quando, de onde, e o que essa identidade fez depois. O cluster tinha auditoria "habilitada" desde a instalação.

## Sintomas

```text
$ grep -c clusterrolebindings /var/log/kubernetes/audit.log
0

$ head -20 /etc/kubernetes/audit-policy.yaml
rules:
  - level: None
    verbs: ["get", "list", "watch"]
  - level: Metadata
    resources: [{ group: "", resources: ["pods", "services", "configmaps"] }]
```

<!-- solucao -->

## Investigação

A política de auditoria foi escrita para "reduzir custo de logs": a primeira regra descartava todas as leituras (incluindo `get`/`list` em secrets), e a segunda só registrava três tipos de recurso. Como não havia uma regra final genérica, **tudo o mais caía em `None`** — inclusive qualquer operação em RBAC. Além disso, o arquivo de log ficava só no disco do control plane, com rotação de 1 dia.

## Causa raiz

A política de auditoria não cobria as ações relevantes para segurança, e os eventos não eram enviados para fora do cluster. Sem registros, não era possível determinar a origem nem o alcance do incidente — o que obrigou o time a assumir o pior cenário (rotação completa de credenciais).

## Correção

- Remover o binding, desativar a ServiceAccount e rotacionar credenciais do cluster (assumindo comprometimento).
- Nova política, com a ordem certa:
  1. `None` apenas para ruído conhecido (health checks, watches de componentes do sistema);
  2. `Metadata` para secrets, configmaps e tokenreviews;
  3. `RequestResponse` para RBAC, `pods/exec`, `pods/attach`, `pods/portforward`;
  4. `Request` para escritas em geral;
  5. `Metadata` para todo o resto.
- Envio dos eventos para um SIEM fora do cluster, com retenção de meses e acesso restrito.

## Prevenção

- Testar a política: gerar ações sensíveis num ambiente de teste e confirmar que aparecem no SIEM.
- Alertas para bindings de cluster-admin, exec em produção e leituras de secrets por humanos.
- Revisão da política a cada mudança de versão do cluster.

Compare as políticas "Ruído zero" e "Recomendada" no simulador de auditoria.
