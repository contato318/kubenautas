import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Award, LoaderCircle } from 'lucide-react';
import { useAccount } from '../auth/AccountProvider';
import { useCertificate } from '../hooks/useCertificate';
import { certificateDate, renderCertificate } from '../lib/certificate';
import CertificateDownload from '../components/CertificateDownload';
import CertificateShare from '../components/CertificateShare';
import { useLoginPath } from '../hooks/useLoginPath';

export default function CertificatePage() {
  const { user, status, refresh } = useAccount();
  const login = useLoginPath();
  const { certificate, loading, error, reload } = useCertificate(user?.id);
  const [preview, setPreview] = useState<{ id: string; image: string } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let canceled = false;
    setPreview(null);
    setPreviewError(false);
    if (certificate) void renderCertificate(certificate).then((image) => {
      if (!canceled) setPreview({ id: certificate.id, image });
    }).catch(() => { if (!canceled) setPreviewError(true); });
    return () => { canceled = true; };
  }, [certificate, retry]);

  if (status === 'ready' && !user) return <Navigate to={login} replace />;
  const busy = status === 'loading' || loading;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/perfil" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-tactical-dim hover:text-white"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Voltar ao perfil</Link>
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="label mb-3">Uma conquista para compartilhar</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meu certificado</h1><p className="mt-3 text-sm leading-6 text-tactical-dim">Seu resultado na avaliação final de Kubernetes na prática.</p></div>{certificate && !busy && <CertificateDownload certificate={certificate} />}</div>
      {busy ? <p role="status" className="mt-10 flex items-center gap-3 text-tactical-dim"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Carregando certificado…</p> : error || status === 'error' ? <div className="mt-8"><p role="alert" className="text-signal-amber">{error ?? 'Não foi possível carregar sua conta.'}</p><button onClick={() => void (status === 'error' ? refresh() : reload())} className="btn-primary mt-4 min-h-11">Tentar novamente</button></div> : certificate ? <>
        <CertificateShare url={certificate.verificationUrl} />
        <div className="mt-8 overflow-hidden rounded-xl border border-tactical-line bg-tactical-surface">
          {preview?.id === certificate.id ? <img src={preview.image} width={3360} height={2376} alt={`Certificado de aprovação de ${certificate.fullName}, com ${Math.round(certificate.examScore * 100)}% de aproveitamento, emitido em ${certificateDate(certificate.issuedAt)} pela Jack Academy.`} className="h-auto w-full" /> : previewError ? <div className="p-8"><p role="alert" className="text-sm text-signal-amber">Não foi possível abrir a prévia.</p><button onClick={() => setRetry((value) => value + 1)} className="btn-ghost mt-4 min-h-11">Recarregar prévia</button></div> : <p role="status" className="p-10 text-center text-tactical-dim">Preparando a prévia…</p>}
      </div>
        <dl className="mt-6 grid gap-5 rounded-xl border border-tactical-border p-5 text-sm sm:grid-cols-2"><div><dt className="text-tactical-label">Emitido para</dt><dd className="mt-1 break-words font-medium">{certificate.fullName}</dd></div><div><dt className="text-tactical-label">Data de emissão</dt><dd className="mt-1">{certificateDate(certificate.issuedAt)}</dd></div><div className="sm:col-span-2"><dt className="text-tactical-label">Identificador do certificado</dt><dd className="mt-1 break-all font-mono text-xs">{certificate.id}</dd></div></dl>
      </> : <div className="mt-8 rounded-xl border border-tactical-border p-6"><Award aria-hidden="true" className="h-8 w-8 text-signal-amber" /><h2 className="mt-4 text-lg font-semibold">Seu certificado ainda não foi emitido</h2><p className="mt-2 text-sm leading-6 text-tactical-dim">Conclua a prova com pelo menos 70% de acertos e informe seu nome completo para emitir.</p><Link to="/prova" className="btn-primary mt-5 min-h-11">Ir para a prova</Link></div>}
    </div>
  );
}
