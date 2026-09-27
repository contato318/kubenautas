import type { Module, Question } from '../types';

/** Módulo completo de CRDs e Operators com Kopf: 9 lições, cada uma com simulador próprio e quiz de 10 perguntas. */

const files = import.meta.glob('./operators/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const md = (slug: string) => {
  const c = files[`./operators/${slug}.md`];
  if (!c) throw new Error(`Conteúdo não encontrado: operators/${slug}`);
  return c;
};
const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const operatorsModule: Module = {
  id: 'operators',
  title: 'CRDs e Operators com Kopf',
  description: 'Curso completo: estenda a API com CRDs e escreva operators em Python com Kopf — do schema à produção.',
  level: 'Avançado',
  emoji: '🧬',
  lessons: [
    {
      slug: 'fundamentos', title: 'Extensões da API e o padrão Operator', summary: 'CRD + controller, loop de reconciliação, level-triggered, quando (não) escrever um operator.', minutes: 12,
      content: md('fundamentos'), simulator: 'op-reconcile',
      quiz: [
        q('O que é um Operator?', ['Um usuário com permissão de admin', 'Um CRD mais um controller que codifica conhecimento operacional de um sistema', 'Um tipo de Pod privilegiado', 'Um plugin do kubectl'], 1, 'O CRD define o tipo; o controller dá comportamento a ele.'),
        q('Um CRD sozinho, sem controller, faz o quê?', ['Cria Pods automaticamente', 'Apenas armazena e valida objetos do novo tipo na API', 'Nada: não pode ser aplicado', 'Reinicia o API server'], 1, 'Comportamento vem de um controller observando os objetos.'),
        q('O que significa um controller ser level-triggered?', ['Reage a cada evento individualmente', 'Decide comparando estado desejado com estado real, então eventos perdidos não o deixam errado', 'Só roda em nós de nível alto', 'Executa por prioridade'], 1, 'Eventos são só gatilhos; a decisão vem do estado atual.'),
        q('Por que o reconcile precisa ser idempotente?', ['Por desempenho', 'Porque pode rodar várias vezes para o mesmo estado (retentativas, reinícios, eventos duplicados)', 'Exigência do etcd', 'Para usar menos memória'], 1, 'Rodar duas vezes não pode criar nada em dobro.'),
        q('Onde um operator deve guardar o estado importante?', ['Em variáveis globais do processo', 'No cluster (spec, status, anotações) ou no sistema externo que gerencia', 'Num arquivo local do Pod', 'Na memória do kubelet'], 1, 'O processo pode reiniciar a qualquer momento.'),
        q('Quando um ConfigMap é suficiente em vez de um CRD?', ['Quando precisa de validação e status', 'Para configuração simples de uma aplicação, sem ciclo de vida nem validação próprios', 'Sempre', 'Nunca'], 1, 'CRDs trazem schema, versões, RBAC e status.'),
        q('O que é o Kopf?', ['Um CNI', 'Um framework Python para escrever operators com handlers decorados', 'Uma CLI de Helm', 'Um banco de dados'], 1, 'Kubernetes Operator Pythonic Framework.'),
        q('Qual destes é um bom motivo para NÃO escrever um operator?', ['O sistema tem ciclo de vida complexo', 'Já existe um operator maduro para o sistema (ex.: CloudNativePG, Strimzi)', 'Outros times criam recursos via GitOps', 'Você quer status observável'], 1, 'Operator é software de produção: reutilize quando possível.'),
        q('No padrão de controller, quem escreve spec e quem escreve status?', ['O controller escreve os dois', 'O usuário escreve a spec; o controller escreve o status', 'O kubelet escreve o status', 'O etcd escreve a spec'], 1, 'Separação desejado × observado.'),
        q('Um operator ficou parado enquanto a spec mudou 5 vezes. O que acontece ao voltar?', ['Reproduz as 5 mudanças em ordem', 'Compara o estado atual com o desejado e converge direto para a última spec', 'Ignora as mudanças', 'Apaga o objeto'], 1, 'Level-triggered: só o estado atual importa.'),
      ],
    },
    {
      slug: 'anatomia-crd', title: 'Anatomia de um CRD', summary: 'group, versions, names, scope, printer columns, Established e o perigo de apagar um CRD.', minutes: 12,
      content: md('anatomia-crd'), simulator: 'op-crd-builder',
      quiz: [
        q('Qual deve ser o metadata.name de um CRD com plural databases e grupo db.exemplo.com?', ['Database', 'db.exemplo.com', 'databases.db.exemplo.com', 'database-crd'], 2, 'Sempre <plural>.<group>.'),
        q('O que acontece se spec.group não tiver ponto (ex.: "databases")?', ['Funciona normalmente', 'O CRD é rejeitado: o grupo deve ser um domínio com pelo menos um ponto', 'Vira um grupo core', 'É convertido para databases.local'], 1, 'Use um domínio que você controla.'),
        q('Quantas versões de um CRD podem ter storage: true?', ['Nenhuma', 'Exatamente uma', 'Todas as servidas', 'Até três'], 1, 'É a versão gravada no etcd.'),
        q('Para que servem os shortNames?', ['Para o nome no etcd', 'Atalhos no kubectl (ex.: kubectl get db)', 'Para o RBAC', 'Para o DNS'], 1, 'Como po para pods e deploy para deployments.'),
        q('O scope de um CRD pode ser alterado depois de criado?', ['Sim, a qualquer momento', 'Não: Namespaced ou Cluster é definitivo', 'Só com --force', 'Só em clusters de teste'], 1, 'Escolha com cuidado.'),
        q('Como mostrar .spec.engine como coluna em kubectl get?', ['labels', 'additionalPrinterColumns com jsonPath', 'annotations', 'Não é possível'], 1, 'Com priority: 1 a coluna só aparece em -o wide.'),
        q('Por que usar kubectl wait --for condition=established após aplicar um CRD?', ['Para gerar certificados', 'Porque aplicar objetos antes pode falhar com no matches for kind', 'Para reiniciar o API server', 'Para criar o namespace'], 1, 'O tipo só é servido depois de Established.'),
        q('O que acontece com os objetos quando você apaga o CRD?', ['Ficam órfãos no etcd', 'Todos os objetos daquele tipo são apagados, em todos os namespaces', 'São convertidos em ConfigMaps', 'Nada'], 1, 'Trate CRDs como schema de banco de dados.'),
        q('Na pasta crds/ de um chart Helm, o que acontece com CRDs em helm upgrade?', ['São atualizados', 'Não são atualizados nem removidos pelo Helm', 'São recriados', 'São apagados'], 1, 'Por isso muitos projetos têm um chart só de CRDs.'),
        q('Que comando mostra a documentação dos campos de um CRD a partir do schema?', ['kubectl describe crd', 'kubectl explain databases.spec', 'kubectl docs', 'kubectl get --help'], 1, 'Descrições do schema viram documentação.'),
      ],
    },
    {
      slug: 'validacao', title: 'Schemas, validação e CEL', summary: 'Schema estrutural, pruning, fieldValidation, defaults, regras CEL e transição com oldSelf.', minutes: 14,
      content: md('validacao'), simulator: 'op-schema',
      quiz: [
        q('O que é pruning em CRDs?', ['Apagar objetos antigos', 'Remover campos que não existem no schema antes de gravar no etcd', 'Compactar o etcd', 'Remover versões antigas'], 1, 'Protege contra lixo, mas esconde typos.'),
        q('Um usuário escreveu spec.storageGb (b minúsculo) e o cliente não usa validação strict. O que acontece?', ['Erro de validação', 'O campo é descartado em silêncio e o operador nunca vê o valor', 'O valor é convertido', 'O API server corrige o nome'], 1, 'Use --validate=strict e dry-run=server.'),
        q('Com kubectl --validate=strict, um campo desconhecido gera…', ['Aviso', 'Erro: strict decoding error: unknown field', 'Nada', 'Um evento'], 1, 'Strict transforma o pruning silencioso em erro.'),
        q('Para aceitar campos arbitrários num trecho do objeto, usa-se…', ['type: any', 'x-kubernetes-preserve-unknown-fields: true naquele nó', 'nullable: true', 'additionalPrinterColumns'], 1, 'Use com moderação, só onde precisa.'),
        q('Onde os defaults do schema são aplicados?', ['No operador', 'No API server, antes da validação', 'No kubectl', 'No kubelet'], 1, 'Ficam visíveis em -o yaml para todos os clientes.'),
        q('Qual regra CEL impede diminuir spec.storageGB?', ['self > 0', 'self >= oldSelf (regra de transição)', 'has(self)', 'self == 1'], 1, 'oldSelf só existe em updates.'),
        q('Como tornar um campo imutável com CEL?', ['immutable: true', "rule: 'self == oldSelf'", 'readOnly: true', 'Não é possível'], 1, 'Regra de transição que exige igualdade.'),
        q('Vantagem de regras CEL sobre um webhook de validação?', ['Consultam outros objetos', 'Rodam dentro do API server, sem serviço externo que possa cair', 'São mais lentas', 'Não precisam de schema'], 1, 'Webhook só quando depende de estado externo.'),
        q('O que é um schema estrutural?', ['Um schema com todos os campos obrigatórios', 'Um schema em que todo campo tem type e não há ambiguidade de tipos', 'Um schema em JSON', 'Um schema sem enum'], 1, 'Exigido por apiextensions.k8s.io/v1.'),
        q('Por que o API server pode recusar uma regra CEL sobre uma lista sem maxItems?', ['Sintaxe', 'Custo estimado de avaliação alto demais', 'Listas não são suportadas', 'Falta de RBAC'], 1, 'Limite tamanhos para caber no orçamento de custo.'),
      ],
    },
    {
      slug: 'status-e-condicoes', title: 'Status, subrecursos e condições', summary: '/status, generation × observedGeneration, condições padronizadas e /scale.', minutes: 13,
      content: md('status-e-condicoes'), simulator: 'op-status',
      quiz: [
        q('Com o subrecurso status habilitado, um PATCH no endpoint principal alterando .status…', ['Grava o status', 'É ignorado na parte do status', 'Falha com 403', 'Incrementa generation'], 1, 'Status só muda via /status.'),
        q('Sem o subrecurso status, escrever no status…', ['Não é permitido', 'Também incrementa metadata.generation', 'Dispara o HPA', 'Apaga a spec'], 1, 'O operador passa a ver cada escrita de status como mudança.'),
        q('Para que serve status.observedGeneration?', ['Contar reinícios', 'Dizer qual generation da spec o operador já processou', 'Guardar a versão do CRD', 'Contar réplicas'], 1, 'Sem ele, Ready=True pode ser de uma spec antiga.'),
        q('Mudar um label de um CR incrementa metadata.generation?', ['Sim', 'Não: generation muda com a spec, não com metadados', 'Só em CRDs cluster-scoped', 'Só com Kopf'], 1, 'Labels e anotações não são spec.'),
        q('Qual campo de uma condição deve mudar só quando o status da condição muda?', ['message', 'lastTransitionTime', 'type', 'reason'], 1, 'Não atualize a cada reconcile.'),
        q('Qual a diferença entre reason e message numa condição?', ['Nenhuma', 'reason é curto e estável para máquinas; message traz detalhes para humanos', 'message é obrigatório; reason não', 'reason é um número'], 1, 'reason vira filtro e alerta.'),
        q('O que o subrecurso scale habilita?', ['Backup', 'kubectl scale e HPA sobre o seu tipo', 'Conversão de versões', 'Mais réplicas do API server'], 1, 'specReplicasPath, statusReplicasPath e labelSelectorPath.'),
        q('No Kopf, para onde vai o valor retornado por um handler chamado criar?', ['Para uma anotação', 'Para status.criar', 'Para um ConfigMap', 'Para os logs apenas'], 1, 'Retornos são gravados no status sob o id do handler.'),
        q('Por que o Kopf não dispara on.update quando só o status muda?', ['Bug conhecido', 'Status não faz parte da essência do objeto, o que evita loops', 'Por falta de RBAC', 'Porque o status é criptografado'], 1, 'Essência: spec, labels e anotações.'),
        q('Que comando espera um CR ficar pronto usando condições?', ['kubectl rollout status database/x', 'kubectl wait database/pedidos --for=condition=Ready', 'kubectl get --watch-ready', 'kubectl ready database'], 1, 'Combine com observedGeneration para não ler status antigo.'),
      ],
    },
    {
      slug: 'kopf-primeiros-passos', title: 'Primeiro operator com Kopf', summary: 'kopf run, on.create/update/delete/resume/event, argumentos, diff, filtros e eventos.', minutes: 15,
      content: md('kopf-primeiros-passos'), simulator: 'op-kopf-handlers',
      quiz: [
        q('Como rodar um operator Kopf localmente contra o cluster do seu kubeconfig?', ['python -m kubernetes', 'kopf run operator.py --verbose', 'kubectl run kopf', 'helm install kopf'], 1, 'Em desenvolvimento, roda fora do cluster.'),
        q('Por que os handlers do Kopf terminam com **_ ou **kwargs?', ['Por estilo', 'O Kopf injeta vários argumentos por nome; os não usados precisam ser aceitos', 'Para receber variáveis de ambiente', 'Para async'], 1, 'Declare só o que usar.'),
        q('Quando @kopf.on.resume é chamado?', ['A cada update', 'Quando o operador (re)inicia e encontra objetos já existentes', 'Na remoção', 'A cada 60 s'], 1, 'Útil para reconstruir estado em memória.'),
        q('Como o Kopf descobre o que mudou enquanto estava parado?', ['Pelos logs do API server', 'Compara com a anotação kopf.zalando.org/last-handled-configuration', 'Pelos eventos antigos', 'Não descobre'], 1, 'O diff é calculado contra a última configuração tratada.'),
        q('Registrar @kopf.on.delete faz o Kopf…', ['Apagar filhos', 'Adicionar um finalizer ao objeto para garantir a chamada', 'Bloquear kubectl delete', 'Criar um webhook'], 1, 'kopf.zalando.org/KopfFinalizerMarker.'),
        q('Qual handler recebe todo evento do watch, sem estado nem retentativas?', ['on.update', 'on.event', 'on.resume', 'on.create'], 1, 'Baixo nível: inclusive os patches do próprio Kopf.'),
        q('O que kopf.adopt(filho) faz?', ['Cria o filho na API', 'Ajusta o manifesto com ownerReference para o CR e namespace', 'Copia a spec', 'Adiciona o finalizer'], 1, 'Você ainda precisa criar o objeto.'),
        q('Como disparar um handler só quando spec.replicas muda?', ["@kopf.on.update('databases', field='spec.replicas')", "@kopf.on.create('databases', replicas=True)", '@kopf.on.event(field=...)', 'Não é possível'], 0, 'Também existe @kopf.on.field.'),
        q('Para que serve o argumento patch nos handlers?', ['Aplicar um patch no kubectl', 'Acumular mudanças (ex.: patch.status) que o Kopf aplica ao objeto após o handler', 'Atualizar o Kopf', 'Corrigir bugs'], 1, 'Evita chamadas manuais à API.'),
        q('Como publicar um evento visível em kubectl describe a partir do operador?', ['print()', "kopf.info(body, reason='Provisioned', message='…')", 'logger.debug', 'Criando um ConfigMap'], 1, 'Logs de nível alto também são postados como eventos.'),
      ],
    },
    {
      slug: 'kopf-erros-e-retentativas', title: 'Kopf: erros, retentativas, timers e daemons', summary: 'TemporaryError, PermanentError, retries, backoff, idempotência, subhandlers, timers e daemons.', minutes: 15,
      content: md('kopf-erros-e-retentativas'), simulator: 'op-kopf-retries',
      quiz: [
        q('O que o Kopf faz quando um handler levanta uma exceção comum?', ['Desiste', 'Trata como temporária e tenta de novo após o backoff (60 s por padrão)', 'Apaga o objeto', 'Reinicia o Pod'], 1, 'Sem retries definidos, tenta para sempre.'),
        q('Quando usar kopf.PermanentError?', ['Para erros de rede', 'Quando tentar de novo não vai adiantar (ex.: spec inválida)', 'Sempre', 'Para pausar o operador'], 1, 'O Kopf marca como falho e para.'),
        q('Como pedir nova tentativa em exatamente 2 minutos?', ['time.sleep(120)', "raise kopf.TemporaryError('…', delay=120)", 'return 120', 'backoff=0'], 1, 'Nunca durma dentro do handler.'),
        q('Onde o Kopf guarda o progresso das tentativas?', ['Na memória', 'Em anotações (e/ou status) do próprio objeto, sobrevivendo a reinícios', 'Num arquivo', 'No etcd do Kopf'], 1, 'Por isso um reinício continua de onde parou.'),
        q('A 1ª tentativa criou um bucket e falhou depois. A 2ª tenta criar de novo e recebe 409. Qual a correção?', ['Aumentar o backoff', 'Tornar o handler idempotente (get_or_create, tratar 409 como sucesso)', 'Usar PermanentError', 'Desligar retries'], 1, 'Retentativas rodam o handler inteiro.'),
        q('Para que servem timers (@kopf.timer)?', ['Medir latência', 'Reconciliação periódica, por exemplo detectar drift em recursos externos', 'Agendar CronJobs', 'Expirar objetos'], 1, 'Handlers de mudança só rodam quando o objeto muda.'),
        q('O que o parâmetro idle de um timer faz?', ['Pausa o operador', 'Só roda se o objeto não mudou nos últimos N segundos', 'Define o intervalo', 'Limita a CPU'], 1, 'Evita competir com handlers de mudança.'),
        q('Um daemon Kopf deve observar qual sinal para terminar?', ['SIGKILL', 'O argumento stopped', 'A variável retry', 'O status Ready'], 1, 'Ignorá-lo trava a remoção do objeto.'),
        q('Qual o risco de um timer que grava uma anotação com a hora atual?', ['Nenhum', 'Mudar anotações dispara on.update — pode virar um loop de atualizações', 'Perder o status', 'Apagar o CR'], 1, 'Grave no status, que não dispara handlers de mudança.'),
        q('Para que servem subhandlers?', ['Paralelizar Pods', 'Dividir um handler em etapas com progresso próprio, sem repetir etapas concluídas', 'Criar outros operadores', 'Gerar logs'], 1, 'kopf.subhandler(id=...).'),
      ],
    },
    {
      slug: 'finalizers-e-filhos', title: 'Finalizers, ownerReferences e garbage collection', summary: 'deletionTimestamp, finalizers, on.delete, kopf.adopt, cascade e o que cada mecanismo limpa.', minutes: 13,
      content: md('finalizers-e-filhos'), simulator: 'op-finalizers',
      quiz: [
        q('O que é um finalizer?', ['Um script executado pelo API server', 'Uma string em metadata.finalizers que impede a remoção até o controller responsável retirá-la', 'Um tipo de Job', 'Um webhook'], 1, 'É uma promessa de limpeza.'),
        q('O que marca um objeto como "sendo apagado"?', ['status.phase=Deleting', 'metadata.deletionTimestamp', 'Um label', 'generation=0'], 1, 'Ele continua existindo enquanto houver finalizers.'),
        q('O operador foi desinstalado antes dos CRs, que tinham finalizer do Kopf. O que acontece ao apagar os CRs?', ['Somem normalmente', 'Ficam Terminating para sempre, porque ninguém remove o finalizer', 'O Kubernetes remove o finalizer sozinho', 'Voltam a Running'], 1, 'Ordem certa: CRs, depois operador, depois CRD.'),
        q('Para objetos dentro do cluster criados pelo operador, qual é a forma recomendada de limpeza?', ['Código no on.delete', 'ownerReferences (kopf.adopt) e garbage collection', 'CronJob', 'Limpeza manual'], 1, 'Deixe o GC trabalhar.'),
        q('Por que a ownerReference inclui o uid do dono?', ['Para o DNS', 'Para garantir que se refere a ESTE objeto, não a outro recriado com o mesmo nome', 'Para o RBAC', 'É opcional'], 1, 'Nomes podem ser reutilizados.'),
        q('Com --cascade=orphan, o que acontece com os filhos?', ['São apagados antes', 'Perdem a ownerReference e continuam vivos', 'São apagados depois', 'Ficam Terminating'], 1, 'Útil para trocar o dono sem derrubar nada.'),
        q('Com propagação foreground, o dono…', ['Some na hora', 'Fica Terminating até os filhos com blockOwnerDeletion serem apagados', 'Nunca é apagado', 'É órfão'], 1, 'Finalizer foregroundDeletion.'),
        q('Um CR namespaced cria um objeto em outro namespace. Quem deve limpá-lo?', ['O GC via ownerReference', 'O handler on.delete (ownerReference entre namespaces não é permitida)', 'Ninguém', 'O kubelet'], 1, 'Dono e filho no mesmo namespace.'),
        q('@kopf.on.delete(optional=True) significa…', ['Obrigatório', 'Sem finalizer: o handler roda se o operador estiver vivo, sem garantia', 'Só em testes', 'Com dois finalizers'], 1, 'Troca garantia por não travar remoções.'),
        q('Qual recurso SÓ um handler de delete consegue limpar?', ['Deployment filho', 'Um bucket ou DNS externo ao cluster', 'Um Service adotado', 'Um Secret adotado'], 1, 'O Kubernetes não sabe que ele existe.'),
      ],
    },
    {
      slug: 'versionamento', title: 'Versionamento e conversão', summary: 'served × storage, conversão None × Webhook, storedVersions, migração e mudanças compatíveis.', minutes: 14,
      content: md('versionamento'), simulator: 'op-versions',
      quiz: [
        q('Qual a diferença entre served e storage numa versão de CRD?', ['Nenhuma', 'served: a API responde nela; storage: é a versão gravada no etcd', 'storage: backup automático', 'served: visível no Dashboard'], 1, 'Pode haver várias servidas e uma de storage.'),
        q('Quando a conversão None é segura?', ['Sempre', 'Quando os schemas das versões são idênticos', 'Quando há webhook', 'Nunca'], 1, 'None só troca o apiVersion.'),
        q('O webhook de conversão caiu. Qual o sintoma?', ['Nenhum', 'kubectl get falha para objetos que precisam de conversão, inclusive para o operador e o GC', 'Só os logs mudam', 'O CRD é apagado'], 1, 'Está no caminho crítico de leitura.'),
        q('O que status.storedVersions registra?', ['Versões servidas', 'Versões que podem existir gravadas no etcd', 'Versões do operador', 'Versões do Kubernetes'], 1, 'Mudar storage não regrava objetos antigos.'),
        q('Por que o API server recusa remover v1alpha1 do CRD com "must appear in spec.versions"?', ['Falta de RBAC', 'v1alpha1 ainda está em status.storedVersions', 'Webhook fora', 'Nome inválido'], 1, 'Migre os objetos e atualize storedVersions primeiro.'),
        q('Como regravar todos os objetos na nova versão de storage?', ['Reiniciar o etcd', 'Um update no-op em cada objeto (ex.: kubectl get -o json | kubectl replace -f -) ou storage version migrator', 'Apagar e recriar o CRD', 'Mudar o scope'], 1, 'Depois atualize storedVersions.'),
        q('Qual mudança é compatível sem criar nova versão?', ['Renomear um campo', 'Adicionar um campo opcional', 'Mudar o tipo de um campo', 'Tornar um campo obrigatório'], 1, 'Mudanças aditivas são seguras.'),
        q('Para que serve deprecationWarning numa versão?', ['Bloquear o uso', 'Mostrar um aviso a quem usa a versão antiga', 'Apagar objetos', 'Gerar métricas'], 1, 'O kubectl exibe como Warning.'),
        q('O Kopf implementa webhooks de conversão?', ['Sim, com @kopf.on.convert', 'Não: ele oferece webhooks de admission; conversão exige outro serviço', 'Sim, automaticamente', 'Só em Go'], 1, 'Use um serviço HTTP próprio ou evite a necessidade com mudanças aditivas.'),
        q('Que propriedade uma conversão entre versões deve ter?', ['Ser rápida apenas', 'Ser sem perdas nos dois sentidos (round-trip)', 'Apagar campos antigos', 'Mudar o uid'], 1, 'Campos sem equivalente podem ir para anotações.'),
      ],
    },
    {
      slug: 'producao', title: 'Operator em produção', summary: 'Imagem, RBAC mínimo, escopo, peering e alta disponibilidade, observabilidade, testes e upgrades.', minutes: 15,
      content: md('producao'), simulator: 'op-rbac',
      quiz: [
        q('O operador sobe sem erros aparentes, mas nunca reage aos CRs. Qual permissão provavelmente falta?', ['events: create', 'list/watch no recurso do CRD', 'pods/exec', 'nodes: get'], 1, 'Sem watch, nenhum evento chega aos handlers.'),
        q('Por que o Kopf precisa de patch no próprio recurso?', ['Para apagá-lo', 'Para gravar finalizers e anotações de progresso', 'Para criar o CRD', 'Para o peering'], 1, 'Sem patch, 403 logo no primeiro evento.'),
        q('Duas réplicas do operador sem peering. O que acontece?', ['Uma fica em standby', 'As duas processam cada evento, duplicando trabalho e recursos externos', 'O Kubernetes impede', 'Dividem os objetos'], 1, 'Use peering ou uma réplica.'),
        q('O que significa a mensagem "Default peering object is not found, falling back to the standalone mode"?', ['Erro fatal', 'Os objetos/CRDs de peering não existem e a réplica age sozinha', 'O CRD foi apagado', 'Falta de memória'], 1, 'Com várias réplicas, isso duplica o trabalho.'),
        q('Qual a vantagem de --namespace em vez de --all-namespaces?', ['Mais rápido sempre', 'Permissões menores (Role por namespace) e isolamento entre times', 'Não precisa de RBAC', 'Suporta mais CRDs'], 1, 'Menor privilégio.'),
        q('Como testar a permissão do operador sem rodá-lo?', ['kubectl describe sa', 'kubectl auth can-i --as=system:serviceaccount:db-system:db-operator patch databases -n loja', 'kubectl top', 'kopf check'], 1, 'Impersonação da ServiceAccount.'),
        q('Para que serve KopfRunner em kopf.testing?', ['Deploy', 'Rodar o operador dentro de um teste e inspecionar exit_code e output', 'Gerar CRDs', 'Medir CPU'], 1, 'Testes de integração com cluster efêmero.'),
        q('Qual a ordem segura para desinstalar um operador?', ['CRD, operador, CRs', 'CRs, depois operador, depois CRD', 'Operador, CRD, CRs', 'Tudo junto'], 1, 'Evita finalizers órfãos e perda de dados.'),
        q('Como expor liveness de um operador Kopf?', ['Não é possível', 'kopf run … --liveness=http://0.0.0.0:8080/healthz e uma livenessProbe', 'Com um sidecar obrigatório', 'Via status do CR'], 1, 'Probes customizadas com @kopf.on.probe.'),
        q('Por que distribuir CRDs separadamente do operador?', ['Por tamanho', 'CRDs mudam com mais cuidado e apagá-los apaga todos os objetos', 'Exigência do Kopf', 'Para acelerar o build'], 1, 'Trate como schema de banco.'),
      ],
    },
  ],
};
