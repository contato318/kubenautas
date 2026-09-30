import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, LoaderCircle } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { useCertificate } from '../hooks/useCertificate';
import CertificateDownload from './CertificateDownload';

export default function CertificateSection() {
  const { user, progress, saving } = useAccount();
  const { certificate, loading, loaded, issuing, error, reload, issue } = useCertificate(user?.id);
  const [fullName, setFullName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const navigate = useNavigate();
  const eligible = (progress.examBest ?? 0) >= 0.7;
  useEffect(() => { setFullName(''); setNameError(null); }, [user?.id]);

  if (!user) return null;
  if (loading) return eligible ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-tactical-dim"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Preparando seu certificado…</p> : null;
  if (!loaded && error) return <div className="mt-6 rounded-xl border border-tactical-border p-5 text-left"><p role="alert" className="text-sm text-signal-amber">{error}</p><button type="button" onClick={() => void reload()} className="mt-3 min-h-11 text-sm text-k8s-400 underline">Tentar carregar certificado novamente</button></div>;
  if (!certificate && !eligible) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (issuing) return;
    const name = fullName.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 120 || !/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*[\p{L}\p{M}.]$/u.test(name)) {
      setNameError('Informe seu nome completo, sem números ou símbolos especiais.');
      return;
    }
    setNameError(null);
    if (await issue(name)) navigate('/certificado');
  };

  return (
    <section aria-labelledby="certificate-section-title" className="mt-8 rounded-2xl border border-signal-amber/30 bg-gradient-to-br from-[#241f13] to-tactical-surface p-5 text-left sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-amber/10 text-signal-amber"><Award aria-hidden="true" className="h-6 w-6" /></span>
        <div className="min-w-0"><h2 id="certificate-section-title" className="text-lg font-semibold">{certificate ? 'Seu certificado está disponível' : 'Sua aprovação merece um certificado'}</h2><p className="mt-2 break-words text-sm leading-6 text-tactical-dim">{certificate ? certificate.fullName : 'Informe seu nome completo como ele deve aparecer no documento.'}</p></div>
      </div>
      {certificate ? (
        <div className="mt-5 flex flex-wrap items-center gap-3"><CertificateDownload certificate={certificate} /><Link to="/certificado" className="btn-ghost min-h-11">Ver certificado<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-5">
          <label htmlFor="certificate-full-name" className="block text-sm font-medium">Nome completo</label>
          <input id="certificate-full-name" name="fullName" autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setNameError(null); }} required minLength={3} maxLength={120} disabled={issuing} aria-invalid={!!nameError} aria-describedby={nameError ? 'certificate-name-error' : 'certificate-name-help'} placeholder="Digite seu nome completo" className="mt-2 min-h-12 w-full rounded-lg border border-tactical-line bg-tactical-bg px-4 py-3 text-base text-white placeholder:text-tactical-label focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400 disabled:opacity-60" />
          <p id="certificate-name-help" className="mt-2 text-xs leading-5 text-tactical-label">Confira a grafia antes de emitir. Seu nome, nota e data de emissão poderão ser consultados pelo link público do certificado.</p>
          {nameError && <p id="certificate-name-error" role="alert" className="mt-3 text-sm text-signal-amber">{nameError}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-signal-amber">{error}</p>}
          <button type="submit" disabled={issuing || saving} className="btn-primary mt-5 min-h-12 w-full justify-center sm:w-auto">{issuing ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Emitindo certificado…</> : <>Emitir meu certificado<ArrowRight aria-hidden="true" className="h-4 w-4" /></>}</button>
        </form>
      )}
    </section>
  );
}
