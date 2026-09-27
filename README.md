# Kubenautas — Kubernetes na prática

Plataforma gratuita e interativa para aprender Kubernetes, inspirada no projeto
[Dinamos](https://github.com/flaviojmendes/dinamos) (sistemas distribuídos).

- **6 módulos / 20 lições** — do "o que é Kubernetes" até RBAC, troubleshooting e Helm.
- **100 perguntas** de quiz (5 por lição, aprovação com 70%) + **prova final** com 20 perguntas sorteadas.
- **7 simuladores** interativos:
  - ⌨️ Terminal `kubectl` com cluster simulado e missões guiadas
  - ♻️ Self-healing (ReplicaSet + scheduler + nós caindo)
  - 🚀 Rolling update (maxSurge / maxUnavailable / rollback)
  - 🔀 Service e endpoints (labels, readiness, balanceamento)
  - 🧩 Scheduler (requests, taints, LeastAllocated x MostAllocated)
  - 📈 HPA (fórmula real, tolerância, janela de estabilização)
  - 🩺 Ciclo de vida (CrashLoopBackOff, OOMKilled, ImagePullBackOff, probes)
- Progresso salvo no navegador (localStorage) — sem backend, sem login.

## Rodando localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes (motor do kubectl simulado + integridade do conteúdo)
npm run build      # build de produção em dist/
npm run preview    # serve o build
```

## Rodando no Kubernetes

```bash
docker build -t kubenautas:1.0 .
kind load docker-image kubenautas:1.0
kubectl apply -f k8s/kubenautas.yaml
kubectl port-forward svc/kubenautas 8080:80
```

## Estrutura

```
src/
  content/<modulo>/<licao>.md   Texto das lições (Markdown)
  content/modules.ts            Catálogo de módulos, lições e quizzes
  components/simulators/        Simuladores (cluster.ts = motor do kubectl)
  pages/                        Home, Trilha, Lição, Simuladores, Prova
  hooks/useProgress.ts          Progresso em localStorage
```

Para adicionar uma lição: crie o `.md` em `src/content/<modulo>/` e registre-o com o quiz em `modules.ts`.
# kubenautas
