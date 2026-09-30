# Volumes e armazenamento persistente

O sistema de arquivos de um container é **efêmero**: reiniciou, perdeu. Volumes resolvem isso em níveis diferentes.

## Volumes efêmeros (vivem com o Pod)

| Tipo | Uso |
|------|-----|
| `emptyDir` | Espaço temporário compartilhado entre containers do Pod (cache, scratch). `medium: Memory` usa RAM |
| `configMap` / `secret` | Configuração como arquivos |
| `downwardAPI` | Expõe metadados do Pod (labels, limites) como arquivos |
| `projected` | Combina vários dos acima num único diretório |

## Persistência: PV, PVC e StorageClass

Três objetos separam **quem precisa** de armazenamento de **quem fornece**:

```
 Desenvolvedor                       Cluster / Admin
 ┌───────────────────┐   bind   ┌──────────────────────┐
 │ PersistentVolume- │ ───────► │ PersistentVolume (PV)│ ──► disco real
 │ Claim (PVC)       │          │ 20Gi, RWO, gp3       │     (EBS, PD, NFS…)
 │ "quero 20Gi RWO"  │          └──────────────────────┘
 └───────────────────┘                    ▲
          │ storageClassName: fast        │ cria dinamicamente
          └──────────────► StorageClass (provisioner CSI)
```

- **PersistentVolume (PV)** — um pedaço de armazenamento real no cluster (recurso de escopo de cluster).
- **PersistentVolumeClaim (PVC)** — um **pedido** de armazenamento feito por um namespace.
- **StorageClass** — um "tipo" de disco com um **provisioner** (driver CSI) que cria PVs **sob demanda** (provisionamento dinâmico).

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dados
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast
  resources:
    requests:
      storage: 20Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: minha-app
      volumeMounts:
        - name: dados
          mountPath: /data
  volumes:
    - name: dados
      persistentVolumeClaim:
        claimName: dados
```

## Access modes

| Modo | Sigla | Significado |
|------|-------|-------------|
| ReadWriteOnce | RWO | Leitura/escrita por **um nó** |
| ReadOnlyMany | ROX | Somente leitura por vários nós |
| ReadWriteMany | RWX | Leitura/escrita por vários nós (NFS, EFS, CephFS) |
| ReadWriteOncePod | RWOP | Leitura/escrita por **um único Pod** |

> Discos de bloco da nuvem (EBS, Persistent Disk) normalmente são **RWO** e presos a uma **zona de disponibilidade**. Um Pod com PVC em `us-east-1a` não pode ser agendado em `us-east-1b`. Use `volumeBindingMode: WaitForFirstConsumer` na StorageClass para o disco ser criado na zona onde o Pod for agendado.

## Reclaim policy

O que acontece com o PV quando o PVC é deletado:
- `Delete` (padrão no provisionamento dinâmico) — o disco é **apagado**.
- `Retain` — o PV fica em `Released` e os dados são preservados para recuperação manual.

## Outras funcionalidades

- **Expansão de volume**: `allowVolumeExpansion: true` na StorageClass; basta aumentar o `requests.storage` do PVC.
- **VolumeSnapshot**: snapshots via CSI.
- Para backup completo de namespaces + volumes: **Velero**.
