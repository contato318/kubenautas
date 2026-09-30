# Armazenamento: PVCs, attach e mount

Problemas de volume costumam aparecer em outro lugar: o Pod fica `Pending` ou `ContainerCreating`, ou a aplicação crasha com "Permission denied". Siga a cadeia:

```
PVC → (StorageClass + provisionador CSI) → PV → attach no nó → mount no Pod → permissões para o processo
```

```bash
kubectl get pvc,pv -n loja
kubectl describe pvc data-web-0 -n loja
kubectl describe pod web-0 -n loja
kubectl get volumeattachment
kubectl get storageclass
```

## PVC Pending

| Evento no PVC | Causa |
| --- | --- |
| `storageclass.storage.k8s.io "x" not found` | StorageClass inexistente (e `storageClassName` é imutável: recrie o PVC) |
| `Waiting for a volume to be created either by the external provisioner "…"` | Driver CSI fora do ar, sem permissão na nuvem, ou lento |
| `waiting for first consumer to be created before binding` | Normal com `WaitForFirstConsumer`: o PVC espera um Pod ser agendado |
| `no persistent volumes available for this claim` | Sem provisionamento dinâmico e sem PV estático compatível (tamanho, access mode, classe) |
| `exceeded quota` (no controller que cria o PVC) | ResourceQuota de storage do namespace |

## ContainerCreating: attach e mount

| Evento no Pod | Causa |
| --- | --- |
| `Multi-Attach error for volume … already exclusively attached to one node` | Volume **ReadWriteOnce** ainda preso a outro nó (outra réplica, ou nó antigo que não soltou) |
| `FailedAttachVolume … timed out` | API da nuvem lenta, limite de volumes por nó, driver com problema |
| `FailedMount … MountVolume.SetUp failed … not found` | Secret/ConfigMap usado como volume não existe |
| `Unable to attach or mount volumes: … timed out waiting for the condition` | Genérico — procure o evento anterior mais específico |

### Multi-Attach em detalhe

Volumes de bloco (EBS, Persistent Disk, Azure Disk) são **RWO**: um nó por vez. Aparece quando:

- Um **Deployment** com várias réplicas usa o **mesmo PVC** — as réplicas em outros nós nunca sobem. Use StatefulSet com `volumeClaimTemplates` (um PVC por réplica) ou storage RWX.
- Um Pod foi reagendado depois que o nó antigo **morreu**: o volume continua "anexado" ao nó perdido. O Kubernetes espera antes de forçar o detach (minutos) — ou você resolve removendo o nó morto do cluster, o que libera o VolumeAttachment.
- Rolling update de um Deployment com PVC RWO e `maxSurge`: o Pod novo nasce em outro nó enquanto o velho segura o volume. Use `strategy: Recreate`.

## Permissões

O volume é montado com dono **root**; se a aplicação roda como usuário não-root, gravar falha:

```text
mkdir: can't create directory '/data/uploads': Permission denied
```

```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000                     # o kubelet ajusta o grupo dos arquivos do volume
  fsGroupChangePolicy: OnRootMismatch   # evita varrer volumes enormes a cada start
```

## Espaço

- PVC cheio: a aplicação reporta "No space left on device". Expanda: edite `spec.resources.requests.storage` (a StorageClass precisa de `allowVolumeExpansion: true`); alguns drivers precisam reiniciar o Pod para o filesystem crescer.
- Disco do **nó** cheio (não do PVC): é ephemeral-storage — veja a lição de nós.

## Dados e ciclo de vida

- `reclaimPolicy: Delete` apaga o disco junto com o PVC; `Retain` preserva (e o PV fica `Released`).
- Apagar um StatefulSet ou fazer `helm uninstall` **não** apaga os PVCs de `volumeClaimTemplates`.
- Snapshots (`VolumeSnapshot`) e backup (Velero) antes de operações arriscadas.

No simulador, combine falhas e veja o estado do PVC, dos Pods, os eventos e a correção.
