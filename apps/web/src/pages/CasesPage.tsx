import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { cases, type Severity } from '../content/cases';
import { useProgress } from '../hooks/useProgress';
import { Badge, type Tone } from '../components/simulators/kit';

export const severityTone: Record<Severity, Tone> = { Média: 'cyan', Alta: 'amber', Crítica: 'red' };

export default function CasesPage() {
  const { progress } = useProgress();
  const solved = cases.filter((c) => progress.cases?.[c.slug]).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="label mb-1">Incidentes reais, resolvidos passo a passo</div>
      <h1 className="text-3xl font-bold">Estudos de caso</h1>
      <p className="mt-2 max-w-3xl text-tactical-dim">
        Problemas que aparecem em todo cluster de produção. Leia os sintomas, dê o seu diagnóstico e só então veja a investigação, a causa raiz, a
        correção e como evitar que aconteça de novo.
      </p>
      <div className="mt-3 font-mono text-xs text-tactical-label">
        {solved}/{cases.length} casos resolvidos
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cases.map((c, i) => {
          const done = !!progress.cases?.[c.slug];
          return (
            <Link key={c.slug} to={`/casos/${c.slug}`} className="panel group p-5 transition-colors hover:border-k8s-500">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-tactical-label">CASO {String(i + 1).padStart(2, '0')}</span>
                <Badge tone={severityTone[c.severity]}>{c.severity}</Badge>
                <Badge tone="dim">{c.area}</Badge>
                {done && (
                  <span className="ml-auto flex items-center gap-1 font-mono text-xs text-signal-green">
                    <CheckCircle2 className="h-3.5 w-3.5" /> resolvido
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-semibold group-hover:text-k8s-400">{c.title}</h2>
              <p className="mt-1 text-sm text-tactical-dim">{c.summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
