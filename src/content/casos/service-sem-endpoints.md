# 503 no Ingress depois de "padronizar os labels"

## Contexto

Uma iniciativa de padronização trocou os labels de todos os charts para o padrão recomendado (`app.kubernetes.io/name`). O deploy do serviço `pedidos` foi aprovado, os Pods estão saudáveis — e o site passou a responder **503 Service Temporarily Unavailable** em `/pedidos`.

## Sintomas

```text
$ kubectl get pods -n loja -l app.kubernetes.io/name=pedidos
NAME                       READY   STATUS    RESTARTS   AGE
pedidos-6d5f7c8b9-4kx2m    1/1     Running   0          12m
pedidos-6d5f7c8b9-9pz7q    1/1     Running   0          12m

$ kubectl get endpointslices -n loja -l kubernetes.io/service-name=pedidos
NAME            ADDRESSTYPE   PORTS     ENDPOINTS   AGE
pedidos-x8q2k   IPv4          <unset>   <unset>     210d
```

Logs do Ingress Controller: `service "loja/pedidos" does not have any active endpoint`.

<!-- solucao -->

## Investigação

Pods Running e Ready, mas o Service sem endpoints: o elo entre os dois é o **selector**.

```text
$ kubectl get svc pedidos -n loja -o jsonpath='{.spec.selector}'
{"app":"pedidos"}

$ kubectl get pods -n loja --show-labels | grep pedidos
pedidos-6d5f7c8b9-4kx2m   ...   app.kubernetes.io/name=pedidos,pod-template-hash=6d5f7c8b9
```

O template do Service não foi incluído na padronização e continuou selecionando `app: pedidos`, label que os Pods novos não têm mais.

## Causa raiz

**Selector do Service não casa com os labels dos Pods.** Nenhum Pod é selecionado → nenhum endpoint → o Ingress Controller não tem para onde mandar o tráfego e responde 503.

Bônus: o `spec.selector` de um Deployment é **imutável**. Por isso a mudança de labels no chart exigiu recriar o Deployment — o que também explica os 210 dias do EndpointSlice antigo e os 12 minutos dos Pods.

## Correção

```yaml
apiVersion: v1
kind: Service
metadata:
  name: pedidos
spec:
  selector:
    app.kubernetes.io/name: pedidos
  ports:
    - port: 80
      targetPort: 8080
```

Confirme antes de fechar o incidente:

```bash
kubectl get endpointslices -n loja -l kubernetes.io/service-name=pedidos
```

## Prevenção

- Gere labels e selectors a partir do **mesmo helper** no chart (`{{ include "app.selectorLabels" . }}`).
- Smoke test pós-deploy que falha se o Service ficar sem endpoints.
- Alerta de Service sem endpoints: `kube_endpoint_address{ready="true"} == 0` (kube-state-metrics).
