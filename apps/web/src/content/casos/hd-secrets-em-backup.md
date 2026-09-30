# O backup do etcd no bucket errado

## Contexto

Um cluster kubeadm on-premises fazia snapshots diários do etcd e os enviava para um bucket de armazenamento de objetos. Numa reorganização de contas, o bucket foi movido para um projeto compartilhado com fornecedores, com leitura liberada para "facilitar a integração". Uma varredura de configuração da nuvem apontou: o bucket continha arquivos `etcd-snapshot-*.db`.

## Sintomas

```text
Alerta CSPM: bucket "backups-infra" legível por 14 identidades externas à organização
Objetos: etcd-snapshot-2026-09-01.db … etcd-snapshot-2026-09-27.db (27 arquivos)
```

```text
$ kubectl get --raw /api/v1/namespaces/kube-system/pods/kube-apiserver-cp1 | jq -r '.spec.containers[0].command[]' | grep encryption
(nenhuma linha)
```

<!-- solucao -->

## Investigação

Sem `--encryption-provider-config`, o API server gravava os Secrets no etcd **em texto** (apenas base64). Cada snapshot era, portanto, uma cópia de **todos** os Secrets do cluster: senhas de bancos, chaves de APIs de terceiros, certificados TLS, tokens. Os logs de acesso do bucket mostraram leituras por identidades de um fornecedor durante 9 dias.

## Causa raiz

Dois controles ausentes ao mesmo tempo: **criptografia em repouso** dos Secrets e **proteção dos backups** (criptografia e acesso restrito). Backups herdam a sensibilidade dos dados que contêm.

## Correção

1. Fechar o acesso ao bucket e preservar os logs de acesso.
2. Tratar **todos** os segredos do cluster como comprometidos: rotacionar senhas, chaves, certificados e tokens, priorizando os de maior impacto.
3. Habilitar criptografia em repouso (preferencialmente KMS v2) e regravar os Secrets.
4. Backups cifrados, em conta/projeto dedicado, com acesso mínimo e bloqueio de compartilhamento externo.

## Prevenção

- Classificar backups do etcd como dado **crítico** (mesmo nível dos segredos).
- Varreduras contínuas de configuração da nuvem (CSPM) e alertas para compartilhamento externo.
- Preferir segredos em cofre externo (External Secrets, CSI) e credenciais dinâmicas: reduzem o que um backup vazado expõe.

Feche os vetores um a um no simulador de Secrets.
