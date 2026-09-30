# Avaliação: etcd alcançável a partir dos nós

## Contexto

Num pentest de um cluster autogerenciado, o avaliador — partindo de acesso a um nó worker (autorizado) — verificou se o etcd, o banco que guarda todo o estado do cluster, estava devidamente isolado.

## Sintomas

```text
# a partir do nó worker (em escopo)
$ nc -zv -w3 10.20.0.10 2379
Connection to 10.20.0.10 2379 port [tcp/*] succeeded!

$ curl -sk https://10.20.0.10:2379/version
{"etcdserver":"3.5.12","etcdcluster":"3.5.0"}
```

A porta 2379 do etcd respondeu a partir de um nó worker.

<!-- solucao -->

## Investigação

O avaliador verificou se o etcd exigia certificado de cliente (mTLS):

```text
$ ps -ef | grep etcd | tr ' ' '\n' | grep -E "client-cert-auth"
--client-cert-auth=false
```

Com `--client-cert-auth=false` e a porta alcançável de fora do control plane, qualquer processo num nó worker poderia consultar o etcd — que contém **todo** o estado do cluster, incluindo os Secrets (em texto, se não houver criptografia em repouso). O avaliador confirmou a alcançabilidade e a configuração, e **não** extraiu dados do etcd; documentou o impacto como "comprometimento total do cluster".

## Causa raiz

etcd sem autenticação por certificado de cliente e com a porta 2379 acessível além do control plane. Quem lê o etcd é, na prática, dono do cluster.

## Correção

- `--client-cert-auth=true` e `--peer-client-cert-auth=true`, com certificados próprios.
- Firewall/security group: porta 2379 acessível **apenas** pelos API servers.
- Criptografia em repouso dos Secrets (KMS) e de snapshots do etcd.

## Prevenção

- kube-bench inclui os controles do etcd — rodar no provisionamento.
- Control plane em rede isolada dos workers.
- Backups do etcd cifrados e com acesso restrito.

No simulador de recon externo, veja o peso de "etcd (2379) alcançável sem mTLS" na exposição.
