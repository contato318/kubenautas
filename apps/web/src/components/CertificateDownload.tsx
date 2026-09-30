import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import type { Certificate } from '@jack-academy/contracts';
import { certificatePdf } from '../lib/certificate';

export default function CertificateDownload({ certificate }: { certificate: Certificate }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(false);
    try {
      const bytes = await certificatePdf(certificate);
      if (!mounted.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado-jack-academy-${certificate.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setDownloading(false); }
  };
  return (
    <div>
      <button type="button" onClick={() => void download()} disabled={downloading} className="btn-primary min-h-11">{downloading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="h-4 w-4" />}{downloading ? 'Preparando PDF…' : 'Baixar certificado em PDF'}</button>
      {error && <p role="alert" className="mt-3 text-sm text-signal-amber">Não foi possível gerar o PDF. Tente novamente.</p>}
    </div>
  );
}
