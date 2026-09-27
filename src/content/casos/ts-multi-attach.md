# O CMS não volta depois que o nó morreu

## Contexto

O CMS da empresa roda como Deployment de 1 réplica com um PVC `gp3` (ReadWriteOnce). Um nó da AWS foi terminado por falha de hardware. O Pod foi recriado em outro nó — e está há 12 minutos em `ContainerCreating`.

## Sintomas

```text
$ kubectl get pods -n cms -o wide
NAME                   READY   STATUS              NODE
cms-6d8f7c9b5-kq2vp    0/1     ContainerCreating   worker-7

$ kubectl describe pod cms-6d8f7c9b5-kq2vp -n cms
  Warning  FailedAttachVolume  attachdetach-controller  Multi-Attach error for volume "pvc-3b1e…"
           Volume is already exclusively attached to one node and can't be attached to another
```

<!-- solucao -->

## Investigação

```text
$ kubectl get volumeattachment | grep pvc-3b1e
csi-9a…   ebs.csi.aws.com   pvc-3b1e…   worker-3   true

$ kubectl get node worker-3
NAME       STATUS     AGE
worker-3   NotReady   210d          ← a instância já não existe na AWS
```

## Causa raiz

Volumes de bloco são **ReadWriteOnce**: anexados a um nó por vez. O `VolumeAttachment` ainda aponta para `worker-3`, que morreu sem soltar o volume. O Kubernetes não força o detach imediatamente, porque o nó "morto" poderia estar só isolado e ainda escrevendo no disco — forçar arriscaria corromper os dados. Ele espera um tempo (minutos) ou uma confirmação de que o nó foi embora.

## Correção

Confirmado que a instância não existe mais:

```bash
kubectl delete node worker-3
# o controller remove o VolumeAttachment, o disco é anexado ao worker-7 e o Pod sobe
```

(Com Cluster Autoscaler/Karpenter e o cloud-controller-manager saudáveis, nós de instâncias terminadas são removidos automaticamente.)

## Prevenção

- Para aplicações com disco e uma réplica, `strategy: Recreate` no Deployment (evita Multi-Attach em rolling updates) — ou StatefulSet.
- Considere storage RWX (EFS, Filestore, CephFS) quando várias réplicas precisam do mesmo volume.
- Verifique se o cloud-controller-manager remove nós de instâncias encerradas.

Reproduza no simulador de armazenamento com "2ª réplica usa o mesmo PVC em outro nó".
