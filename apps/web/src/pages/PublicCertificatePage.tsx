import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Award, CalendarDays, CircleAlert, FileCheck2, LoaderCircle, ShieldCheck, Trophy } from 'lucide-react';
import { BrandName, Logo } from '../components/Brand';
import { usePublicCertificate } from '../hooks/usePublicCertificate';
import { certificateDate } from '../lib/certificate';
import jackExpertsLogo from '../assets/jack-experts-white.png';

export default function PublicCertificatePage() {
  const { id } = useParams();
  const { certificate, status, reload } = usePublicCertificate(id);
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  return (
    <div className="min-h-svh bg-tactical-bg">
      <header className="border-b border-tactical-border"><div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-4 py-6 sm:px-6"><Link to="/" aria-label="Jack Academy — início" className="flex items-center gap-2.5 rounded font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><Logo /><BrandName /></Link><a href="https://jackexperts.com.br" target="_blank" rel="noopener noreferrer" aria-label="Conheça a Jack Experts (abre em nova aba)" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400"><img src={jackExpertsLogo} width={3937} height={1985} alt="Jack Experts" className="h-auto w-20" /></a></div></header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16" aria-busy={status === 'loading'}>
        <p className="label mb-4">Validação pública · Jack Academy</p>
        {status === 'loading' ? <div role="status" className="rounded-2xl border border-tactical-border bg-tactical-surface p-7"><LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-k8s-400 motion-reduce:animate-none" /><h1 className="mt-5 text-2xl font-semibold">Conferindo certificado…</h1><p className="mt-3 text-sm leading-6 text-tactical-dim">Consultando o registro de emissão da plataforma.</p></div> : certificate ? <>
          <div className="rounded-2xl border border-signal-green/25 bg-gradient-to-br from-[#122a25] to-tactical-surface p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-signal-green/20 bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Registro confirmado</span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Certificado verificado</h1>
            <p className="mt-3 text-sm leading-6 text-tactical-dim">Este certificado consta no registro de emissão da plataforma Jack Academy, da Jack Experts.</p>
            <div className="mt-7 border-t border-signal-green/15 pt-6"><p className="text-xs text-tactical-label">Emitido para</p><h2 className="mt-2 break-words text-2xl font-semibold leading-snug text-white sm:text-3xl">{certificate.fullName}</h2><p className="mt-3 flex items-center gap-2 text-sm text-[#a9d5c5]"><Award aria-hidden="true" className="h-5 w-5 shrink-0" />Aprovação na avaliação final de Kubernetes na prática</p></div>
          </div>
          <dl className="mt-6 grid gap-6 rounded-2xl border border-tactical-border bg-tactical-surface p-6 sm:grid-cols-2 sm:p-8">
            <div><dt className="flex items-center gap-2 text-sm text-tactical-label"><CalendarDays aria-hidden="true" className="h-4 w-4" />Data de emissão</dt><dd className="mt-2 text-sm font-medium">{certificateDate(certificate.issuedAt)}</dd></div>
            <div><dt className="flex items-center gap-2 text-sm text-tactical-label"><Trophy aria-hidden="true" className="h-4 w-4" />Aproveitamento</dt><dd className="mt-2 text-sm font-medium">{Math.round(certificate.examScore * 100)}% de acertos</dd></div>
            <div><dt className="text-sm text-tactical-label">Emitido por</dt><dd className="mt-2 text-sm font-medium">Jack Academy · Uma iniciativa Jack Experts</dd></div>
            <div><dt className="text-sm text-tactical-label">Tipo de documento</dt><dd className="mt-2 text-sm font-medium">Certificado de aprovação</dd></div>
            <div className="border-t border-tactical-border pt-5 sm:col-span-2"><dt className="text-sm text-tactical-label">Identificador do certificado</dt><dd className="mt-2 break-all font-mono text-xs leading-6">{certificate.id}</dd></div>
          </dl>
          <p className="mt-5 flex items-start gap-3 text-sm leading-6 text-tactical-dim"><FileCheck2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-k8s-400" />Confira se o nome, a nota e o identificador acima correspondem ao documento recebido.</p>
        </> : <div className="rounded-2xl border border-tactical-border bg-tactical-surface p-6 sm:p-8">
          <CircleAlert aria-hidden="true" className="h-9 w-9 text-signal-amber" />
          <h1 className="mt-5 text-2xl font-semibold">{status === 'not-found' ? 'Certificado não encontrado' : 'Não foi possível verificar agora'}</h1>
          <p role={status === 'error' ? 'alert' : undefined} className="mt-3 text-sm leading-6 text-tactical-dim">{status === 'not-found' ? 'Não há certificado registrado com esse identificador. Confira o link ou peça ao titular o endereço disponível no perfil dele.' : 'A consulta está indisponível no momento. Tente novamente para confirmar os dados do certificado.'}</p>
          {status === 'error' && <button type="button" onClick={reload} className="btn-primary mt-5 min-h-11">Tentar novamente</button>}
        </div>}
        <Link to="/" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded text-sm text-k8s-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400">Conheça a plataforma<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
      </main>
    </div>
  );
}
