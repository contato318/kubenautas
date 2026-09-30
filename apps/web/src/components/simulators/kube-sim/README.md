# Motor das missões do terminal

Adaptado do `kube-sim-main.zip` fornecido pelo usuário (revisão do arquivo:
`66fc03538a8d67df8cac8c6af147d9b2774300ba`). O catálogo contém 23 missões,
divididas em cinco níveis, para o cluster simulado Kubernetes v1.31 com um
control plane e dois workers.

`core/` preserva os comandos, controladores, imagens, arquivos de exemplo e
definições das missões do projeto recebido. Os módulos recebem um runtime
privado por sessão em vez de instalar `globalThis.KS`. O parser YAML usa a
dependência `yaml` da plataforma. A interface DOM e o armazenamento global do
projeto original não são usados.

O terminal usa o `HostShell` completo do ZIP: `ls`, `cd`, `pwd`, `cat`,
edição e manipulação de arquivos, filtros, pipes, redirecionamentos, aliases,
variáveis, loops e sessões interativas via `kubectl exec`. O prompt acompanha
o diretório atual e a entrada aparece junto à saída. As cores ANSI são
renderizadas como texto React, sem interpretar HTML. Os atalhos Ctrl+A/E,
Ctrl+U/K/W, Ctrl+C/L/D e o histórico seguem a interação do terminal recebido;
Shift+Tab permite sair do campo e Shift+Enter permite editar várias linhas.
`history -c` limpa o histórico visível sem apagar a verificação das missões.

Conclusões de objetivos recebem feedback com Motion: check desenhado,
brilho breve, partículas, progresso animado e notificações em fila.
O feedback só dispara na transição de pendente para concluído; reabrir
uma aba não repete a celebração e reiniciar descarta a fila. A preferência
`prefers-reduced-motion` mantém a confirmação visual sem os movimentos.

`session.js` liga esse motor à interface React. Cluster, arquivos, histórico e
progresso vivem apenas na sessão do terminal. Reiniciar recria todos eles;
limpar apaga somente a saída. Desmontar interrompe comandos e jobs pendentes.
Objetivos são registrados em ordem e permanecem concluídos, inclusive nas
missões que aplicam e depois removem uma configuração. Os cenários precisam
ser preparados explicitamente. Algumas missões reutilizam recursos das
anteriores; siga a ordem do catálogo.

A solução de diagnóstico de `image-pull` inclui `get pods` e `describe`, os
dois comandos exigidos pela verificação original. O teste de integração
executa as soluções de todas as 23 missões e valida sua conclusão.
As escritas do processo principal em volumes montados são sincronizadas com
o armazenamento do volume, preservando também anexações feitas por `exec`.
Isso corrige o exemplo `pvc-pod.yaml`, cujo arquivo ficava escondido pelo
ponto de montagem no motor recebido. O teste verifica dados gravados antes
da recriação do Pod, além do código de saída das soluções.
O nome inválido `registry.k8s.io/kube-schedular` também produz erro de pull;
a regra genérica de registries públicos do projeto original aceitava essa
imagem e impedia que o cenário de recuperação do scheduler funcionasse.

O shell e a rede operam sobre os objetos e arquivos simulados no navegador.
Não executam comandos no host nem acessam clusters externos.
