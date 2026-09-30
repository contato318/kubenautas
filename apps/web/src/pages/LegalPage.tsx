import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, FileText, Mail, ShieldCheck } from 'lucide-react';

const jackPrivacy = 'https://jackexperts.com/politica.html';
const anpdRights = 'https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares';
const lgpdLaw = 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm';
// Contact published in section 2 of the Jack Experts institutional privacy policy.
const privacyEmail = 'renata@jackexperts.com.br';
type LegalKind = 'terms' | 'privacy' | 'lgpd';

function External({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-k8s-400 underline underline-offset-4 hover:text-white">{children}<span className="sr-only"> (abre em nova aba)</span></a>;
}

const documents: Record<LegalKind, { title: string; description: string; sections: { title: string; content: ReactNode }[] }> = {
  terms: {
    title: 'Termos de uso',
    description: 'As regras para aprender, praticar e acompanhar suas conquistas na Jack Academy.',
    sections: [
      { title: 'Sobre a plataforma', content: <p>A Jack Academy é uma plataforma gratuita de aprendizado sobre containers e Kubernetes, apresentada como uma iniciativa da Jack Experts. Lições, simuladores e estudos de caso têm finalidade educacional. Os laboratórios simulam comportamentos e não substituem a avaliação de um ambiente real de produção.</p> },
      { title: 'Acesso e conta', content: <p>Você pode explorar o conteúdo sem entrar. Para responder às perguntas, salvar resultados e emitir um certificado, use sua própria conta Google ou GitHub. O primeiro login cria seu cadastro na plataforma. Cada provedor mantém uma conta e um progresso separados, mesmo quando o e-mail é igual. Não compartilhe sua sessão nem se passe por outra pessoa.</p> },
      { title: 'Uso responsável', content: <p>Use o conteúdo para estudar e experimentar em ambientes sob sua responsabilidade ou com autorização. Os cenários de segurança e pentest não autorizam testes contra sistemas de terceiros. Não tente acessar contas alheias, explorar falhas da plataforma, falsificar resultados ou interferir no funcionamento do serviço.</p> },
      { title: 'Progresso e certificados', content: <p>Uma lição é concluída com pelo menos 70% de acertos no quiz. A prova final também exige 70% para a emissão do certificado. Informe seu nome completo corretamente: o certificado registra o nome, o aproveitamento, a data e um identificador público de validação. Ele comprova a aprovação na avaliação da Jack Academy; não equivale a uma certificação oficial da CNCF ou de outros fornecedores.</p> },
      { title: 'Conteúdo e disponibilidade', content: <p>Os conteúdos e funcionalidades podem ser atualizados. Podem ocorrer indisponibilidades e falhas de conexão; confira as mensagens de confirmação ao salvar resultados. Respeite a autoria, as marcas e as licenças aplicáveis aos materiais. A disponibilização do conteúdo não transfere a titularidade dessas marcas e materiais.</p> },
      { title: 'Encerramento e privacidade', content: <p>Você pode excluir sua conta pelo perfil. A exclusão remove seus dados de aprendizado e certificados, encerra as sessões e impede a validação dos certificados removidos. Leia o <Link className="text-k8s-400 underline underline-offset-4" to="/privacidade">aviso de privacidade</Link> e a página de <Link className="text-k8s-400 underline underline-offset-4" to="/lgpd">direitos LGPD</Link> para saber mais sobre seus dados.</p> },
    ],
  },
  privacy: {
    title: 'Privacidade',
    description: 'Entenda quais dados a plataforma usa, para que servem e como gerenciar sua conta.',
    sections: [
      { title: 'Conta e identificação', content: <p>No login, recebemos do Google ou GitHub seu identificador no provedor, nome, e-mail verificado quando disponível e endereço da imagem de perfil. Usamos esses dados para identificar sua conta e associar seus resultados. A plataforma não recebe sua senha do provedor e não guarda os tokens usados para consultar esse perfil.</p> },
      { title: 'Aprendizado e acompanhamento', content: <p>Guardamos as melhores notas dos quizzes e da prova, as lições concluídas, a primeira resposta de cada caso e as datas associadas. Também registramos acessos a lições, casos e simuladores, início e finalização de provas e novas tentativas. Administradores autorizados podem consultar essas informações para acompanhar o uso e o aprendizado, além das datas de cadastro, login e última atividade.</p> },
      { title: 'Certificado e consulta pública', content: <p>Ao solicitar um certificado, você informa seu nome completo. Qualquer pessoa com o link de validação pode consultar esse nome, o aproveitamento, a data de emissão e o identificador do certificado, sem entrar na plataforma. Essa consulta não divulga seu e-mail nem o restante do seu progresso. Considere essa visibilidade antes de emitir ou compartilhar seu certificado.</p> },
      { title: 'Sessão e serviços externos', content: <p>Um cookie necessário mantém sua sessão por até sete dias. Sair encerra a sessão atual; excluir a conta encerra todas as suas sessões na plataforma. O login depende do Google ou GitHub e o site carrega fontes do Google Fonts, que recebem as requisições necessárias a esses serviços. Links externos e serviços de terceiros seguem suas próprias políticas.</p> },
      { title: 'Conservação e exclusão', content: <p>Os dados da conta ficam disponíveis enquanto ela existir. A exclusão pelo perfil remove o cadastro, o progresso, o histórico e os certificados da base ativa da plataforma. Não remove sua conta Google ou GitHub, dados mantidos por esses provedores, nem documentos que já tenham sido baixados ou compartilhados. Informações sobre eventuais cópias de segurança, registros de infraestrutura e retenções aplicáveis devem ser solicitadas pelo canal de privacidade.</p> },
      { title: 'Responsável e informações institucionais', content: <p>Esta página descreve o funcionamento da Jack Academy. Consulte também a <External href={jackPrivacy}>política de privacidade da Jack Experts</External> para informações institucionais e o canal de atendimento aos titulares. Você pode pedir esclarecimentos sobre finalidades, bases legais, compartilhamento e conservação pelo contato indicado abaixo.</p> },
    ],
  },
  lgpd: {
    title: 'Seus direitos LGPD',
    description: 'Informação e caminhos para exercer seus direitos sobre os dados pessoais.',
    sections: [
      { title: 'O que a LGPD prevê', content: <p>A Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) prevê direitos sobre o tratamento de dados pessoais. Entre eles estão confirmação do tratamento, acesso e correção de dados, informação sobre compartilhamento e, conforme as condições legais, portabilidade, anonimização, bloqueio e eliminação. Também há direitos relacionados à revogação de consentimento, oposição e revisão de decisões automatizadas.</p> },
      { title: 'O que você pode fazer na plataforma', content: <p>No <Link className="text-k8s-400 underline underline-offset-4" to="/perfil">meu perfil</Link>, você acompanha seus resultados e pode excluir a conta. A exclusão apaga o cadastro, o progresso, o histórico e os certificados da base ativa. Se precisar corrigir o nome de um certificado, consultar outros dados ou fazer uma solicitação que não esteja disponível no perfil, use o canal de atendimento.</p> },
      { title: 'Como enviar uma solicitação', content: <p>Escreva para o contato de privacidade abaixo e informe que a solicitação se refere à Jack Academy, o provedor usado no login e o que deseja solicitar. Pode ser necessário confirmar sua identidade para proteger os dados. Não envie senhas, tokens de acesso ou documentos sensíveis sem uma orientação específica do atendimento.</p> },
      { title: 'Condições e acompanhamento', content: <p>Os pedidos são avaliados conforme o direito exercido e as condições previstas na lei. O direito de eliminação não é absoluto: podem existir hipóteses legais de conservação. Para dúvidas ou reclamações, procure primeiro o responsável pelo tratamento. A ANPD também disponibiliza orientações e canais para titulares.</p> },
      { title: 'Fontes oficiais', content: <p>Consulte a <External href={lgpdLaw}>LGPD na íntegra</External> e as <External href={anpdRights}>orientações da ANPD sobre os direitos dos titulares</External>.</p> },
    ],
  },
};

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const document = documents[kind];
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <Link to="/entrar" className="inline-flex min-h-11 items-center gap-2 text-sm text-tactical-dim hover:text-white"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Voltar ao login</Link>
    <header className="mt-5 rounded-2xl border border-k8s-400/20 bg-gradient-to-br from-[#12213a] to-tactical-surface p-5 sm:p-8">
      <ShieldCheck aria-hidden="true" className="h-8 w-8 text-k8s-400" />
      <p className="label mt-5">Transparência e seus dados</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{document.title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-tactical-dim">{document.description}</p>
      <p className="mt-5 text-xs text-tactical-label">Atualizado em 29 de setembro de 2026</p>
    </header>
    <nav aria-label="Informações legais" className="my-6 flex flex-wrap gap-2">
      {[{to:'/termos-de-uso',label:'Termos de uso'},{to:'/privacidade',label:'Privacidade'},{to:'/lgpd',label:'LGPD'}].map(item=><NavLink key={item.to} to={item.to} className={({isActive})=>`inline-flex min-h-11 items-center rounded-lg px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-k8s-400 ${isActive?'bg-k8s-500/15 text-k8s-400':'text-tactical-dim hover:bg-tactical-raised'}`}>{item.label}</NavLink>)}
    </nav>
    <article className="divide-y divide-tactical-border rounded-2xl border border-tactical-border bg-tactical-surface px-5 sm:px-8">
      {document.sections.map((section,index)=><section key={section.title} className="py-6 sm:py-7"><h2 className="text-lg font-semibold">{index+1}. {section.title}</h2><div className="mt-3 text-sm leading-7 text-tactical-dim">{section.content}</div></section>)}
    </article>
    <aside aria-labelledby="privacy-contact-title" className="mt-6 rounded-xl border border-tactical-border p-5 sm:p-6">
      <h2 id="privacy-contact-title" className="flex items-center gap-2 text-base font-semibold"><Mail aria-hidden="true" className="h-5 w-5 text-k8s-400" />Contato de privacidade</h2>
      <p className="mt-3 text-sm leading-6 text-tactical-dim">Canal informado na política de privacidade da Jack Experts para solicitações sobre dados pessoais.</p>
      <a href={`mailto:${privacyEmail}?subject=Jack%20Academy%20-%20Solicita%C3%A7%C3%A3o%20LGPD`} className="mt-3 inline-flex min-h-11 items-center break-all text-sm text-k8s-400 underline underline-offset-4">{privacyEmail}</a>
      <p className="mt-2 flex items-start gap-2 text-xs leading-6"><FileText aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-tactical-label" /><External href={jackPrivacy}>Consultar a política institucional e seus canais de contato</External></p>
    </aside>
  </div>;
}
