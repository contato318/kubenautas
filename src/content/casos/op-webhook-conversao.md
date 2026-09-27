# kubectl get databases parou de funcionar

## Contexto

Na versão 2.0 do operador, o CRD `Database` ganhou a versão `v1` (com `spec.storage.size` no lugar de `spec.size`) e um webhook de conversão. Tudo funcionou por semanas. Hoje de manhã, ninguém consegue listar bancos, o operador parou de reconciliar e o Argo CD mostra `Unknown` para todas as aplicações que têm um `Database`.

## Sintomas

```text
$ kubectl get databases -A
Error from server: conversion webhook for db.exemplo.com/v1alpha1, Kind=Database failed:
Post "https://db-operator-webhook.db-system.svc:443/convert?timeout=30s":
tls: failed to verify certificate: x509: certificate has expired or is not yet valid
```

<!-- solucao -->

## Investigação

```text
$ kubectl get crd databases.db.exemplo.com -o jsonpath='{.status.storedVersions}'
["v1alpha1","v1"]

$ kubectl get secret db-operator-webhook-tls -n db-system -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -enddate
notAfter=Sep 26 23:59:59 2026 GMT
```

O certificado do webhook foi gerado à mão com validade de um ano.

## Causa raiz

Objetos antigos continuam gravados em `v1alpha1`; a cada leitura em `v1`, o API server precisa chamar o **webhook de conversão**. Com o certificado do webhook expirado, a chamada TLS falha — e a **lista inteira** falha, porque qualquer objeto que precise de conversão quebra a resposta. O próprio operador, o garbage collector e o Argo CD dependem dessas leituras.

## Correção

1. Renovar o certificado do webhook e atualizar o `caBundle` no CRD.
2. Migrar os objetos para a versão de storage (`kubectl get databases -A -o json | kubectl replace -f -`) e remover `v1alpha1` de `status.storedVersions`, reduzindo a dependência do webhook no dia a dia.

## Prevenção

- Certificados de webhook gerenciados (cert-manager com `cainjector` preenchendo o `caBundle`), com renovação automática.
- Webhook de conversão com ≥ 2 réplicas, PDB e alertas de disponibilidade e de expiração de certificado.
- Migração de storage logo após cada mudança de versão — objetos antigos no etcd são dívida.
- Preferir mudanças aditivas que dispensam conversão.

No simulador de versões, desligue "Webhook de conversão no ar" antes e depois da migração.
