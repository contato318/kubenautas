# Anatomia de um chart

Crie um chart de exemplo e explore: `helm create loja` gera uma estrutura completa e funcional, que é o ponto de partida da maioria dos charts.

```
loja/
├── Chart.yaml            # metadados do chart (obrigatório)
├── Chart.lock            # versões resolvidas das dependências
├── values.yaml           # valores padrão
├── values.schema.json    # validação dos values (opcional)
├── charts/               # dependências empacotadas
├── crds/                 # CustomResourceDefinitions (tratamento especial)
├── templates/
│   ├── _helpers.tpl      # templates nomeados (não geram manifesto)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   ├── NOTES.txt         # mensagem exibida após install/upgrade
│   └── tests/
│       └── test-connection.yaml
└── .helmignore           # arquivos que não entram no pacote
```

## Chart.yaml

```yaml
apiVersion: v2                 # charts do Helm 3+ (v1 era do Helm 2)
name: loja
description: Loja virtual — API e frontend
type: application              # ou "library" (só helpers, não gera recursos)
version: 1.4.0                 # versão do CHART (SemVer 2 obrigatório)
appVersion: "2.3.1"            # versão da APLICAÇÃO empacotada (texto livre)
kubeVersion: ">=1.27.0-0"      # restrição de versão do cluster (opcional)
icon: https://exemplo.com/logo.png
maintainers:
  - name: time-plataforma
    email: plataforma@exemplo.com
dependencies:
  - name: postgresql
    version: "~16.0.0"
    repository: oci://registry-1.docker.io/bitnamicharts
    condition: postgresql.enabled
```

### version × appVersion

São **independentes**:

- `version` muda sempre que **qualquer coisa** no chart muda (um template, um default, uma dependência). Segue SemVer: *patch* para correções, *minor* para funcionalidades compatíveis, *major* para mudanças incompatíveis nos values ou nos recursos.
- `appVersion` informa qual versão da aplicação o chart instala por padrão. Muitos charts usam `{{ .Values.image.tag | default .Chart.AppVersion }}` como tag da imagem.

Publicar a mesma `version` com conteúdo diferente quebra caches, locks e a reprodutibilidade — trate versões de chart como **imutáveis**.

### type: library

Um chart `library` só contém templates nomeados para serem reutilizados por outros charts (via dependência). Ele não pode ser instalado sozinho. É a forma de padronizar labels, probes e recursos entre dezenas de microsserviços.

## values.yaml e values.schema.json

O `values.yaml` documenta a interface do chart: cada chave deve ter um valor padrão sensato e, idealmente, um comentário. O `values.schema.json` (JSON Schema) **valida** os values em `install`, `upgrade`, `lint` e `template`:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["image"],
  "properties": {
    "replicaCount": { "type": "integer", "minimum": 1 },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" }
      }
    }
  }
}
```

Com schema, `--set replicaCount=abc` falha **antes** de chegar ao cluster, com uma mensagem clara.

## templates/

- Cada arquivo `.yaml`/`.tpl` é processado pelo motor de templates; arquivos que começam com `_` só definem templates nomeados.
- Um arquivo pode gerar vários documentos separados por `---`, ou nenhum (se estiver todo dentro de um `if` falso).
- `NOTES.txt` é renderizado e exibido ao usuário — use para mostrar a URL de acesso ou o próximo passo.
- `templates/tests/` guarda Pods de teste executados por `helm test` (veja a lição de hooks).

## crds/

CRDs em `crds/` são instaladas **antes** dos templates, na primeira instalação. Mas o Helm **não as atualiza** em upgrades nem as remove no uninstall — é uma decisão deliberada para não apagar dados de recursos customizados. Estratégias para gerenciar CRDs aparecem na lição de produção.

## .helmignore

Funciona como `.gitignore` na hora do `helm package`: exclua testes locais, arquivos de CI, `*.swp`, `.git/` — tudo que não deve ir no pacote.

## helm lint

```bash
helm lint ./loja
helm lint ./loja -f values-prod.yaml --strict   # warnings também falham
```

O lint renderiza os templates, valida o YAML resultante, o `Chart.yaml`, o schema e as regras de nomes do Kubernetes. Rode no CI **com os values de cada ambiente**.

No simulador abaixo, explore a estrutura e provoque erros comuns para ver as mensagens reais do `helm lint`.
