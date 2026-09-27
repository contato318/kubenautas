# ConfigMaps e Secrets

Princípio dos **12 fatores**: a configuração fica **fora da imagem**. A mesma imagem roda em dev, staging e produção — só a configuração muda.

## ConfigMap

Armazena configuração **não sensível** como pares chave/valor ou arquivos inteiros (limite de 1 MiB).

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info
  FEATURE_NOVO_CHECKOUT: "true"
  nginx.conf: |
    server {
      listen 80;
      location / { proxy_pass http://api; }
    }
```

```
kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-file=nginx.conf
```

## Secret

Para dados sensíveis: senhas, tokens, certificados.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-cred
type: Opaque
stringData:              # texto puro; o API server converte para base64 em data:
  DB_USER: app
  DB_PASSWORD: s3nh@F0rt3
```

> **base64 NÃO é criptografia.** Qualquer um com permissão de `get secrets` lê o valor. Proteja Secrets com:
> - **RBAC** restrito;
> - **criptografia em repouso** no etcd (EncryptionConfiguration / KMS);
> - gestores externos: **External Secrets Operator**, **Sealed Secrets**, **Vault**, **SOPS**;
> - nunca comite Secrets em texto puro no Git.

Tipos comuns: `Opaque`, `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson` (credencial de registry, usado em `imagePullSecrets`), `kubernetes.io/service-account-token`.

## Consumindo nos Pods

### Como variáveis de ambiente

```yaml
containers:
  - name: app
    image: minha-app:2.0
    envFrom:
      - configMapRef:
          name: app-config       # todas as chaves viram variáveis
    env:
      - name: DB_PASSWORD
        valueFrom:
          secretKeyRef:
            name: db-cred
            key: DB_PASSWORD
```

### Como arquivos (volume)

```yaml
    volumeMounts:
      - name: nginx-conf
        mountPath: /etc/nginx/conf.d
        readOnly: true
volumes:
  - name: nginx-conf
    configMap:
      name: app-config
      items:
        - key: nginx.conf
          path: default.conf
```

## Atualizações: pegadinha clássica

| Forma de consumo | Atualiza sozinho quando o ConfigMap muda? |
|------------------|-------------------------------------------|
| Variável de ambiente | **Não** — só no próximo restart do Pod |
| Volume | **Sim**, eventualmente (~1 min), mas a app precisa reler o arquivo |
| Volume com `subPath` | **Não** |

Padrões para forçar rollout ao mudar config:
- `kubectl rollout restart deployment/app`;
- colocar um **hash da config em uma annotation** do template (o Helm faz isso com `checksum/config`);
- ConfigMaps **imutáveis** com nome versionado (`app-config-v7`) — `immutable: true` também alivia a carga no API server.
