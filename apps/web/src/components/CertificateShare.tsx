import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';

export default function CertificateShare({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setState('idle'); }, [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setState('copied'); }
    catch { setState('error'); input.current?.focus(); input.current?.select(); }
  };
  return (
    <section aria-labelledby="certificate-share-title" className="mt-6 rounded-xl border border-k8s-400/25 bg-k8s-500/5 p-5 sm:p-6">
      <h2 id="certificate-share-title" className="flex items-center gap-2 text-base font-semibold"><Link2 aria-hidden="true" className="h-5 w-5 text-k8s-400" />Compartilhe sua conquista</h2>
      <p className="mt-2 text-sm leading-6 text-tactical-dim">Qualquer pessoa com este link pode confirmar a emissão e conferir os dados do certificado, sem entrar na plataforma.</p>
      <label htmlFor="certificate-public-link" className="mt-4 block text-xs text-tactical-label">Link público de validação</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input ref={input} id="certificate-public-link" type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-h-12 min-w-0 flex-1 rounded-lg border border-tactical-line bg-tactical-bg px-3 text-sm text-tactical-text focus:border-k8s-400 focus:outline-none focus:ring-1 focus:ring-k8s-400" /><button type="button" onClick={() => void copy()} className="btn-primary min-h-12 justify-center">{state === 'copied' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}{state === 'copied' ? 'Link copiado' : 'Copiar link'}</button></div>
      <p role="status" className="mt-2 text-xs leading-5 text-tactical-dim">{state === 'copied' ? 'Link copiado para a área de transferência.' : state === 'error' ? 'Selecione e copie o link acima para compartilhar.' : ''}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded text-sm text-k8s-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400">Abrir validação pública<ExternalLink aria-hidden="true" className="h-4 w-4" /><span className="sr-only">(abre em nova aba)</span></a>
    </section>
  );
}
