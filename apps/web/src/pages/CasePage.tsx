import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Search, XCircle } from 'lucide-react';
import { cases, findCase } from '../content/cases';
import { useProgress } from '../hooks/useProgress';
import Markdown from '../components/Markdown';
import { Badge } from '../components/simulators/kit';
import { simulators } from '../components/simulators/registry';
import { severityTone } from './CasesPage';
import NotFoundPage from './NotFoundPage';
import AccountNotice from '../components/AccountNotice';
import { useActivityVisit } from '../hooks/useActivity';
import { useAccount } from '../auth/AccountProvider';

export default function CasePage() {
  const { slug = '' } = useParams();
  const found = findCase(slug);
  useActivityVisit('case_opened', found ? slug : undefined);
  // key reinicia o estado ao navegar entre casos
  return found ? <CaseView key={slug} slug={slug} /> : <NotFoundPage />;
}

function CaseView({ slug }: { slug: string }) {
  const c = findCase(slug)!;
  const { progress, recordCase } = useProgress();
  const { user, status } = useAccount();
  const canAnswer = !!user && status === 'ready';
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const idx = cases.findIndex((x) => x.slug === slug);
  const next = cases[idx + 1];
  const sim = simulators.find((s) => s.id === c.simulator);
  const answered = selected !== null;
  const correct = selected === c.diagnosis.answer;

  const reveal = (choice: number | null) => {
    if (choice !== null && (!canAnswer || answered)) return;
    if (choice !== null) setSelected(choice);
    setRevealed(true);
    // Visitors may read the solution without recording an answer.
    if (canAnswer) void recordCase(c.slug, choice === c.diagnosis.answer);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/casos" className="inline-flex items-center gap-1.5 font-mono text-xs text-tactical-label hover:text-tactical-text">
        <ArrowLeft className="h-3.5 w-3.5" /> ESTUDOS DE CASO
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-tactical-label">CASO {String(idx + 1).padStart(2, '0')}</span>
        <Badge tone={severityTone[c.severity]}>severidade {c.severity}</Badge>
        <Badge tone="dim">{c.area}</Badge>
        {progress.cases?.[c.slug] && <Badge tone="green">resolvido</Badge>}
      </div>

      <div className="mt-6">
        <Markdown>{c.symptoms}</Markdown>
      </div>

      <section className="panel mt-8 p-6">
        <AccountNotice />
        <div className="label mb-2 flex items-center gap-2">
          <Search className="h-3.5 w-3.5" /> Seu diagnóstico
        </div>
        <h3 className="mb-4 text-lg font-semibold">{c.diagnosis.q}</h3>
        <div className="space-y-2">
          {c.diagnosis.options.map((opt, i) => {
            let style = 'border-tactical-border hover:border-tactical-line hover:bg-tactical-raised';
            if (answered) {
              if (i === c.diagnosis.answer) style = 'border-signal-green bg-signal-green/10';
              else if (i === selected) style = 'border-signal-red bg-signal-red/10';
              else style = 'border-tactical-border opacity-60';
            }
            return (
              <button
                key={i}
                disabled={!canAnswer || answered}
                onClick={() => reveal(i)}
                className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${style}`}
              >
                <span className="font-mono text-tactical-label">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{opt}</span>
                {answered && i === c.diagnosis.answer && <CheckCircle2 className="h-5 w-5 shrink-0 text-signal-green" />}
                {answered && i === selected && i !== c.diagnosis.answer && <XCircle className="h-5 w-5 shrink-0 text-signal-red" />}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`mt-4 rounded-md border-l-4 px-4 py-3 text-sm ${correct ? 'border-signal-green bg-signal-green/10' : 'border-signal-amber bg-signal-amber/10'}`}>
            <strong>{correct ? 'Diagnóstico certeiro!' : 'Não exatamente.'}</strong> <span className="text-tactical-dim">{c.diagnosis.explanation}</span>
          </div>
        )}
        {!revealed && (
          <button className="mt-4 font-mono text-xs text-tactical-label underline hover:text-tactical-text" onClick={() => reveal(null)}>
            pular e ver a solução
          </button>
        )}
      </section>

      {revealed && (
        <div className="mt-8">
          <Markdown>{c.solution}</Markdown>
          {sim && (
            <Link to={`/simuladores/${sim.id}`} className="panel mt-8 flex items-center gap-4 p-4 transition-colors hover:border-k8s-500">
              <span className="text-2xl">{sim.emoji}</span>
              <span className="flex-1">
                <span className="label block">Pratique no simulador</span>
                <span className="font-semibold">{sim.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-tactical-label" />
            </Link>
          )}
        </div>
      )}

      <nav className="mt-12 flex justify-between gap-4 border-t border-tactical-border pt-6">
        <Link to="/casos" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Todos os casos
        </Link>
        {next && (
          <Link to={`/casos/${next.slug}`} className="btn-primary">
            Próximo caso <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </nav>
    </div>
  );
}
