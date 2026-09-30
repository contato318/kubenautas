# Laboratório: kubectl na prática

O terminal abaixo simula um cluster Kubernetes v1.31 com um control plane e dois workers. Explore os comandos do `kubectl`, arquivos YAML e um shell com pipes e redirecionamentos. O estado é mantido enquanto você estiver na página.

## Missões

O painel traz **23 missões em cinco níveis**, com objetivos verificados automaticamente, dicas e soluções que podem ser inseridas no terminal. Siga a ordem: algumas missões usam recursos criados nas anteriores.

1. **Básico:** conheça o cluster, crie seu primeiro Pod e trabalhe com labels e seletores.
2. **Aplicações:** Deployments, réplicas, Services, DNS, rolling update, rollback e YAML declarativo.
3. **Configuração e acesso:** ConfigMaps, Secrets, namespaces, contexto, RBAC, probes e recursos.
4. **Troubleshooting:** investigue imagens inválidas, CrashLoopBackOff, Services sem destino e Pods em Pending.
5. **Operação do cluster:** Jobs, CronJobs, volumes persistentes, agendamento, manutenção de nós, HPA, NetworkPolicy, Ingress e recuperação do scheduler.

Nas missões com cenário, clique em **Preparar cenário** para criar os recursos que você precisa investigar. Os objetivos já cumpridos permanecem marcados quando você avança para os próximos passos.

Use `help` para explorar os comandos e `ls examples/` para ver os manifestos de exemplo. Abra arquivos com `vi` ou recursos com `kubectl edit`; o editor permite salvar com `Ctrl+S`. Também é possível colar comandos com várias linhas, incluindo heredocs YAML.

O terminal também tem os comandos do shell: `ls`, `cd`, `pwd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep`, `sed`, `awk` e outros. Experimente `cd examples`, `ls -la` e `cat nginx-deployment.yaml`. O prompt acompanha o diretório atual. Pipes (`|`), redirecionamentos (`>` e `>>`), variáveis e aliases funcionam nos arquivos simulados.

> `Tab` autocompleta; ↑/↓ percorre o histórico; `Shift+Enter` insere uma nova linha; `Ctrl+C` interrompe comandos como `kubectl get pods -w`; `Ctrl+L` limpa a saída. `Shift+Tab` sai do terminal. Reiniciar o cluster apaga recursos, arquivos, histórico e progresso das missões.

> Para editar a linha, use `Ctrl+A`/`Ctrl+E` para ir ao início/fim, `Ctrl+U`/`Ctrl+K` para apagar até o início/fim e `Ctrl+W` para apagar a palavra anterior. Dentro de um container aberto com `kubectl exec -it`, `exit` ou `Ctrl+D` volta ao shell do host.
