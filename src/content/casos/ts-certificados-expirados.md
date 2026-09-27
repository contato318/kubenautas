# Na segunda-feira, o kubectl parou de funcionar

## Contexto

Um cluster kubeadm on-premises, criado há exatamente um ano e nunca atualizado ("está estável, não mexe"), amanheceu inacessível. As aplicações continuam respondendo aos clientes, mas nenhum deploy funciona e o monitoramento parou de receber métricas do cluster.

## Sintomas

```text
$ kubectl get nodes
Unable to connect to the server: x509: certificate has expired or is not yet valid:
current time 2026-09-28T08:02:11Z is after 2026-09-27T14:20:33Z
```

<!-- solucao -->

## Investigação

No nó de control plane:

```text
$ sudo kubeadm certs check-expiration
CERTIFICATE                EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED
admin.conf                 Sep 27, 2026 14:20 UTC   <invalid>       no
apiserver                  Sep 27, 2026 14:20 UTC   <invalid>       no
apiserver-kubelet-client   Sep 27, 2026 14:20 UTC   <invalid>       no
controller-manager.conf    Sep 27, 2026 14:20 UTC   <invalid>       no
scheduler.conf             Sep 27, 2026 14:20 UTC   <invalid>       no
CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME
ca                         Sep 25, 2035 14:20 UTC   8y              no
```

## Causa raiz

O kubeadm emite os certificados dos componentes com validade de **1 ano** (a CA vale 10 anos). Eles são renovados automaticamente a cada `kubeadm upgrade` — que nunca aconteceu. Expirados, o kubectl, o controller-manager e o scheduler não conseguem mais se autenticar no API server. Os Pods existentes seguem rodando porque o kubelet mantém os containers.

## Correção

Em cada nó de control plane:

```bash
sudo kubeadm certs renew all
# reinicie os Pods estáticos do control plane (mover os manifestos e devolver, ou reiniciar o kubelet)
sudo mv /etc/kubernetes/manifests/*.yaml /tmp/ && sleep 20 && sudo mv /tmp/kube-*.yaml /tmp/etcd.yaml /etc/kubernetes/manifests/
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
kubectl get nodes
```

Verifique também se os kubelets renovam os próprios certificados (`rotateCertificates: true`).

## Prevenção

- Atualize o cluster pelo menos uma vez por ano (versões do Kubernetes saem a cada ~4 meses e têm suporte limitado).
- Alerta de expiração (ex.: `apiserver_client_certificate_expiration_seconds`, ou um job diário com `kubeadm certs check-expiration`).
- Documente o procedimento de renovação num runbook e teste-o.
