# Hooks e testes

Algumas tarefas precisam acontecer em **momentos específicos** do ciclo de vida: migrar o banco antes do deploy, popular dados depois da instalação, fazer backup antes de desinstalar. Para isso existem os **hooks**.

## Como declarar

Qualquer recurso do chart vira hook com uma annotation — quase sempre um `Job`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "loja.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          command: ["./manage", "migrate"]
```

## Eventos

| Hook | Quando roda |
| --- | --- |
| `pre-install` / `post-install` | Antes / depois de criar os recursos numa instalação |
| `pre-upgrade` / `post-upgrade` | Antes / depois de atualizar os recursos |
| `pre-rollback` / `post-rollback` | Antes / depois de um rollback |
| `pre-delete` / `post-delete` | Antes / depois de remover os recursos no uninstall |
| `test` | Quando você executa `helm test` |

"Depois" significa: depois que os recursos foram **aplicados** (e, com `--wait`, depois de ficarem prontos).

## Ordem e espera

1. Os hooks de uma fase são ordenados por **`hook-weight`** (menor primeiro; pode ser negativo), depois por tipo e nome.
2. O Helm cria cada hook e **espera** até ele terminar (Job concluído, Pod `Succeeded`) antes do próximo.
3. Se um hook **falhar**, a operação para: a release fica `failed`. Em `pre-*`, os recursos do chart **não chegam a ser aplicados**; em `post-*`, já foram.
4. O tempo de espera respeita `--timeout` (padrão 5m).

## Políticas de deleção

| `helm.sh/hook-delete-policy` | Efeito |
| --- | --- |
| `before-hook-creation` | Apaga o recurso da execução **anterior** antes de criar o novo — **é o padrão quando a annotation não existe** |
| `hook-succeeded` | Apaga depois que o hook tem sucesso |
| `hook-failed` | Apaga se o hook falhar |

Combinação comum: `before-hook-creation,hook-succeeded` — some quando dá certo, fica para investigação quando falha, e não impede a próxima execução.

**Armadilha:** usar só `hook-succeeded`. Se o Job falhar, ele **fica no cluster**; na próxima execução o Helm tenta criar um Job com o mesmo nome e recebe `jobs.batch "…" already exists`.

## Hooks não fazem parte da release

Recursos de hook **não são gerenciados como os demais**: `helm uninstall` não os remove (a menos que uma política os apague) e eles não aparecem em `helm get manifest`. Um Job de migração sem política acumula lixo.

Relacionado: a annotation `helm.sh/resource-policy: keep` faz o Helm **não apagar** um recurso no uninstall — útil para PVCs e Secrets com dados que precisam sobreviver.

## helm test

Testes são hooks do tipo `test`, geralmente Pods que verificam se a aplicação responde:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "loja.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox:1.36
      command: ["wget", "-qO-", "{{ include "loja.fullname" . }}:{{ .Values.service.port }}/healthz"]
```

```bash
helm test loja -n loja --logs
```

Rode `helm test` no pipeline logo após o deploy: se falhar, o pipeline pode acionar o rollback.

## Boas práticas

- Migrações **idempotentes** e compatíveis com a versão anterior da aplicação (o rollback do Helm não desfaz o banco).
- `backoffLimit` e `activeDeadlineSeconds` explícitos: um Job preso segura o deploy até o `--timeout`.
- Evite hooks para o que não é ciclo de vida — muitos hooks tornam o deploy lento e frágil.
- Ferramentas GitOps tratam hooks de forma própria (o Argo CD mapeia hooks do Helm para os seus *sync hooks*). Teste o comportamento no seu fluxo.

No simulador, execute install, upgrade, rollback, test e uninstall, faça hooks falharem e observe a ordem, o status da release e o que sobra no cluster.
