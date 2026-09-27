import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, FlaskConical } from 'lucide-react';
import { modules } from '../content/modules';
import { lessonKey, useProgress } from '../hooks/useProgress';

const levelColor = { Básico: 'text-signal-green border-signal-green/40', Intermediário: 'text-signal-amber border-signal-amber/40', Avançado: 'text-signal-red border-signal-red/40' };

export default function RoadmapPage() {
  const { progress, reset } = useProgress();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="label mb-1">Roadmap</div>
      <h1 className="text-3xl font-bold">Trilha de aprendizado</h1>
      <p className="mt-2 text-tactical-dim">Siga os módulos em ordem. Uma lição é concluída quando você acerta pelo menos 70% do quiz.</p>

      <ol className="relative mt-10 space-y-10 border-l border-tactical-line pl-8">
        {modules.map((m, mi) => (
          <li key={m.id} className="relative">
            <span className="absolute -left-[49px] flex h-8 w-8 items-center justify-center rounded-full border border-tactical-line bg-tactical-surface text-lg">{m.emoji}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-tactical-label">MÓDULO {String(mi + 1).padStart(2, '0')}</span>
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${levelColor[m.level]}`}>{m.level}</span>
            </div>
            <h2 className="mt-1 text-xl font-semibold">{m.title}</h2>
            <p className="text-sm text-tactical-dim">{m.description}</p>
            <div className="mt-4 space-y-2">
              {m.lessons.map((l) => {
                const key = lessonKey(m.id, l.slug);
                const done = !!progress.completed[key];
                const best = progress.quizzes[key];
                return (
                  <Link key={l.slug} to={`/aprender/${m.id}/${l.slug}`} className="panel flex items-center gap-4 px-4 py-3 transition-colors hover:border-k8s-500">
                    {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-signal-green" /> : <Circle className="h-5 w-5 shrink-0 text-tactical-line" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        {l.title}
                        {l.simulator && (
                          <span className="inline-flex items-center gap-1 rounded bg-k8s-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-k8s-400">
                            <FlaskConical className="h-3 w-3" /> simulador
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-tactical-label">{l.summary}</div>
                    </div>
                    {best !== undefined && <span className="font-mono text-xs text-tactical-dim">{Math.round(best * 100)}%</span>}
                    <span className="hidden items-center gap-1 font-mono text-xs text-tactical-label sm:flex">
                      <Clock className="h-3 w-3" /> {l.minutes}min
                    </span>
                  </Link>
                );
              })}
            </div>
          </li>
        ))}
        <li className="relative">
          <span className="absolute -left-[49px] flex h-8 w-8 items-center justify-center rounded-full border border-signal-amber bg-tactical-surface text-lg">🎓</span>
          <h2 className="text-xl font-semibold">Prova final</h2>
          <p className="text-sm text-tactical-dim">20 perguntas sorteadas de todo o conteúdo.</p>
          <Link to="/prova" className="btn-primary mt-3">Fazer a prova</Link>
        </li>
      </ol>

      <ResetButton onReset={reset} />
    </div>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mt-16 border-t border-tactical-border pt-6 text-right">
      {confirming ? (
        <span className="inline-flex items-center gap-2 text-sm text-tactical-dim">
          Apagar todo o progresso?
          <button className="btn-ghost border-signal-red text-signal-red" onClick={() => { onReset(); setConfirming(false); }}>Sim, apagar</button>
          <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancelar</button>
        </span>
      ) : (
        <button className="font-mono text-xs uppercase text-tactical-label hover:text-signal-red" onClick={() => setConfirming(true)}>
          Reiniciar progresso
        </button>
      )}
    </div>
  );
}
