import type { CaseMeta } from './helmCases';
import type { Question } from '../types';

/** Metadados dos estudos de caso de hardening (conteúdo em casos/hd-*.md). */

const q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

export const hardeningCaseMeta: CaseMeta[] = [
  {
    slug: 'hd-dashboard-exposto', title: 'O Dashboard que minerava criptomoedas', area: 'Hardening', severity: 'Crítica', simulator: 'hd-rbac-risk',
    summary: 'Painel exposto na internet, sem login e com cluster-admin.',
    diagnosis: q('Qual combinação permitiu o ataque?', ['CPU sem limites', 'Painel público, sem autenticação e com a ServiceAccount vinculada a cluster-admin', 'Imagem desatualizada do kube-proxy', 'Falta de HPA'], 1, 'Qualquer visitante tinha controle total do cluster.'),
  },
  {
    slug: 'hd-kubelet-anonimo', title: 'Comandos em containers sem passar pelo API server', area: 'Hardening', severity: 'Crítica', simulator: 'hd-cis-audit',
    summary: 'Processos desconhecidos em containers e nenhum exec no audit log.',
    diagnosis: q('Por que o audit log do API server não registrou nada?', ['O audit estava desligado', 'O atacante usou a API do kubelet (10250), anônima e com AlwaysAllow, sem passar pelo API server', 'Os Pods foram recriados', 'O etcd perdeu os eventos'], 1, 'Autenticação por webhook e authorization.mode: Webhook no kubelet.'),
  },
  {
    slug: 'hd-cni-sem-networkpolicy', title: 'As NetworkPolicies que nunca funcionaram', area: 'Hardening', severity: 'Alta', simulator: 'hd-netpol-matrix',
    summary: 'Policies aplicadas sem erro, mas o banco continuava acessível de qualquer namespace.',
    diagnosis: q('Por que as policies não tinham efeito?', ['YAML inválido', 'O CNI (Flannel) não implementa NetworkPolicy: os objetos eram ignorados', 'Faltava RBAC', 'O banco usava hostNetwork'], 1, 'Valide segmentação com testes negativos.'),
  },
  {
    slug: 'hd-pod-privilegiado-escape', title: 'O Pod de "debug" que era dono do nó', area: 'Hardening', severity: 'Crítica', simulator: 'hd-pss',
    summary: 'Um Pod privileged com hostPID e hostPath: / esquecido em produção.',
    diagnosis: q('Qual controle teria impedido o Pod?', ['HPA', 'Pod Security Admission com enforce baseline (ou restricted) no namespace', 'Um Service', 'Limits de memória'], 1, 'Baseline já proíbe privileged, hostPID e hostPath.'),
  },
  {
    slug: 'hd-token-vazado', title: 'O token do CI que nunca expira', area: 'Hardening', severity: 'Crítica', simulator: 'hd-token',
    summary: 'Token legado com cluster-admin exposto em log público do CI.',
    diagnosis: q('Qual a primeira ação?', ['Esperar o token expirar', 'Apagar o Secret do token (revoga na hora) e revisar o audit log', 'Reiniciar o API server', 'Trocar a senha do CI'], 1, 'Tokens legados não expiram.'),
  },
  {
    slug: 'hd-create-pods-escalada', title: '"Os devs não podem ler Secrets" — mas podiam', area: 'Hardening', severity: 'Alta', simulator: 'hd-rbac-risk',
    summary: 'Sem get em secrets, mas com create pods no namespace.',
    diagnosis: q('Como o acesso ao Secret aconteceu?', ['Bug do RBAC', 'Criar Pods permite montar qualquer Secret e usar qualquer ServiceAccount do namespace', 'O Secret era público', 'Cache do kubectl'], 1, 'Escrita em workloads vale tanto quanto os Secrets do namespace.'),
  },
  {
    slug: 'hd-secrets-em-backup', title: 'O backup do etcd no bucket errado', area: 'Hardening', severity: 'Crítica', simulator: 'hd-secrets',
    summary: 'Snapshots do etcd legíveis por terceiros, sem criptografia em repouso.',
    diagnosis: q('Por que o vazamento expôs todos os segredos?', ['O bucket era grande', 'Sem criptografia em repouso, cada snapshot continha todos os Secrets em texto', 'O etcd compacta dados', 'Os Secrets eram ConfigMaps'], 1, 'Rotacione tudo e habilite KMS v2.'),
  },
  {
    slug: 'hd-imagem-typosquatting', title: 'Um "nginx" que não era o nginx', area: 'Hardening', severity: 'Alta', simulator: 'hd-admission',
    summary: 'Um erro de digitação trouxe uma imagem de terceiros para o cluster.',
    diagnosis: q('Qual controle faltou?', ['Mais réplicas', 'Admission de supply chain: registries permitidos, assinatura e digest', 'Um Ingress', 'Limits de CPU'], 1, 'Importe imagens públicas após verificação.'),
  },
  {
    slug: 'hd-auditoria-sem-registro', title: 'O incidente que ninguém conseguiu reconstruir', area: 'Hardening', severity: 'Alta', simulator: 'hd-audit-policy',
    summary: 'Um binding de cluster-admin apareceu e o audit log não tinha nada.',
    diagnosis: q('Por que não havia registro?', ['O log foi apagado pelo invasor', 'A política descartava leituras e não tinha regra final: RBAC caía em None; e o log ficava só no disco', 'O API server estava fora', 'Faltava Falco'], 1, 'Ordem das regras e envio ao SIEM.'),
  },
  {
    slug: 'hd-egress-exfiltracao', title: 'Dados saindo por onde ninguém olhava', area: 'Hardening', severity: 'Crítica', simulator: 'hd-netpol-matrix',
    summary: '40 GB enviados para fora a partir de um namespace sem política de egress.',
    diagnosis: q('Qual lacuna permitiu a saída?', ['Falta de ingress policy', 'Nenhuma NetworkPolicy de egress: o workload podia falar com qualquer destino', 'DNS lento', 'HPA desligado'], 1, 'Default-deny de egress e egress gateway.'),
  },
  {
    slug: 'hd-exec-sem-deteccao', title: 'Shells em produção que ninguém via', area: 'Hardening', severity: 'Média', simulator: 'hd-runtime',
    summary: 'Centenas de kubectl exec em produção, sem alertas nem controle de acesso.',
    diagnosis: q('De onde vinha a permissão de exec?', ['De um bug', 'Das ClusterRoles padrão edit/admin, concedidas amplamente', 'Do kubelet', 'Do Ingress'], 1, 'Acesso sob demanda + auditoria + detecção.'),
  },
  {
    slug: 'hd-impersonate', title: 'A ferramenta de suporte que podia ser qualquer um', area: 'Hardening', severity: 'Crítica', simulator: 'hd-rbac-risk',
    summary: 'impersonate sem resourceNames numa ServiceAccount de portal interno.',
    diagnosis: q('Por que a permissão equivale a cluster-admin?', ['Porque lê logs', 'Permite assumir qualquer grupo, inclusive system:masters, que ignora o RBAC', 'Porque cria Pods', 'Não equivale'], 1, 'Restrinja com resourceNames ou elimine a impersonação.'),
  },
];
