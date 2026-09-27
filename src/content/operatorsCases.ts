import type { CaseMeta } from './helmCases';
import type { Question } from '../types';

/** Metadados dos estudos de caso de CRDs e Operators (conteúdo em casos/op-*.md). */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const operatorsCaseMeta: CaseMeta[] = [
  {
    slug: 'op-campos-sumindo', title: 'O backup configurado que nunca rodou', area: 'Operators', severity: 'Alta', simulator: 'op-schema',
    summary: 'A retenção de 30 dias no Git virou o padrão de 7 dias, sem nenhum erro.',
    diagnosis: q('Por que o valor sumiu?', ['Bug no Argo CD', 'O campo tinha um typo e foi podado (pruning) pelo API server sem validação estrita', 'O etcd perdeu dados', 'O operador sobrescreveu a spec'], 1, 'Campos fora do schema são descartados antes de gravar.'),
  },
  {
    slug: 'op-status-ignorado', title: 'O status que não muda nunca', area: 'Operators', severity: 'Média', simulator: 'op-status',
    summary: 'O PATCH do status retorna 200, mas nada muda no objeto.',
    diagnosis: q('Qual a causa?', ['Falta de RBAC', 'Com o subrecurso status, mudanças em .status no endpoint principal são ignoradas', 'O Kopf apaga o status', 'Cache do kubectl'], 1, 'Use /status (ou patch.status no Kopf).'),
  },
  {
    slug: 'op-loop-de-reconcile', title: 'O operador que conversa sozinho', area: 'Operators', severity: 'Alta', simulator: 'op-kopf-handlers',
    summary: 'Milhares de PATCHes por minuto e o mesmo handler rodando sem parar.',
    diagnosis: q('O que causa o loop?', ['Um bug no API server', 'O handler de update grava uma anotação a cada execução, o que dispara um novo update', 'Réplicas demais', 'Timer com intervalo curto'], 1, 'Anotações fazem parte da essência; status não.'),
  },
  {
    slug: 'op-finalizer-orfao', title: 'Bancos que não morrem', area: 'Operators', severity: 'Média', simulator: 'op-finalizers',
    summary: 'CRs e namespace presos em Terminating depois de desinstalar o operador.',
    diagnosis: q('Por que não são removidos?', ['Falta de quota', 'O finalizer do Kopf ficou sem o operador para executar o on.delete e retirá-lo', 'O CRD está corrompido', 'O namespace é protegido'], 1, 'Ordem certa: CRs → operador → CRD.'),
  },
  {
    slug: 'op-crd-apagada', title: 'Um helm uninstall apagou todos os certificados', area: 'Operators', severity: 'Crítica', simulator: 'op-crd-builder',
    summary: 'Reinstalar o cert-manager não trouxe os certificados de volta.',
    diagnosis: q('O que aconteceu com os Certificates?', ['Expiraram', 'Os CRDs estavam na release; apagar um CRD apaga todos os objetos do tipo', 'Foram movidos de namespace', 'O Ingress os apagou'], 1, 'CRDs fora da release ou com resource-policy: keep.'),
  },
  {
    slug: 'op-rbac-forbidden', title: 'O operador em produção que não faz nada', area: 'Operators', severity: 'Alta', simulator: 'op-rbac',
    summary: 'Pod Running sem reinícios, mas nenhum CR é processado.',
    diagnosis: q('O que falta?', ['Memória', 'Permissões de RBAC: namespaces em modo cluster e patch no recurso', 'Uma Service', 'Um webhook'], 1, 'Localmente funcionava com kubeconfig de admin.'),
  },
  {
    slug: 'op-duas-replicas', title: 'Cada banco novo aparece duas vezes na nuvem', area: 'Operators', severity: 'Alta', simulator: 'op-rbac',
    summary: 'Duas réplicas do operador criam instâncias duplicadas e órfãs.',
    diagnosis: q('Por que duplicou?', ['Bug da nuvem', 'Sem peering, cada réplica age em modo standalone e processa todos os eventos', 'O HPA escalou os CRs', 'O CRD tem duas versões'], 1, 'Use peering ou uma réplica — e nomes determinísticos.'),
  },
  {
    slug: 'op-webhook-conversao', title: 'kubectl get databases parou de funcionar', area: 'Operators', severity: 'Crítica', simulator: 'op-versions',
    summary: 'Listar o tipo falha com erro no webhook de conversão.',
    diagnosis: q('O que está quebrando as leituras do tipo?', ['O CRD foi apagado', 'O certificado do webhook de conversão expirou, e objetos antigos exigem conversão a cada leitura', 'Falta de RBAC', 'etcd cheio'], 1, 'O webhook está no caminho crítico de leitura.'),
  },
  {
    slug: 'op-stored-versions', title: 'Não consigo remover a versão v1alpha1', area: 'Operators', severity: 'Média', simulator: 'op-versions',
    summary: 'status.storedVersions[0]: Invalid value: "v1alpha1": must appear in spec.versions.',
    diagnosis: q('O que fazer antes de remover a versão?', ['Apagar o CRD', 'Regravar os objetos na versão de storage e atualizar status.storedVersions', 'Mudar o scope', 'Reiniciar o API server'], 1, 'Mudar storage não regrava objetos antigos.'),
  },
  {
    slug: 'op-handler-nao-idempotente', title: 'Handler preso em 409 AlreadyExists', area: 'Operators', severity: 'Alta', simulator: 'op-kopf-retries',
    summary: 'Depois de uma falha parcial, as retentativas nunca mais dão certo.',
    diagnosis: q('Por que as retentativas falham?', ['Backoff curto', 'O handler não é idempotente: a retentativa refaz passos cujo efeito já existe', 'Falta de CPU', 'O broker caiu de novo'], 1, 'get-or-create ou subhandlers com progresso.'),
  },
  {
    slug: 'op-filhos-orfaos', title: 'Deployments fantasmas depois de apagar os CRs', area: 'Operators', severity: 'Alta', simulator: 'op-finalizers',
    summary: '341 Deployments para 12 ambientes de preview.',
    diagnosis: q('Por que os filhos não foram apagados?', ['O GC estava desligado', 'Foram criados sem ownerReferences (sem kopf.adopt), então o GC não os liga ao CR', 'Quota', 'O namespace é compartilhado'], 1, 'Adote todos os filhos do cluster.'),
  },
  {
    slug: 'op-observed-generation', title: 'O pipeline disse "deploy concluído" — e não estava', area: 'Operators', severity: 'Crítica', simulator: 'op-status',
    summary: 'kubectl wait retornou na hora com um Ready=True da versão anterior.',
    diagnosis: q('O que faltou no status?', ['Um label', 'observedGeneration, para saber a qual spec o Ready se refere', 'Uma anotação do Kopf', 'O campo phase'], 1, 'Status sem geração é ambíguo.'),
  },
];
