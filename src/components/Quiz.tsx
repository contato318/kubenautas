import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';
import type { Question } from '../types';

interface Props {
  questions: Question[];
  title?: string;
  onFinish?: (score: number) => void;
  passMark?: number;
}

export default function Quiz({ questions, title = 'Quiz', onFinish, passMark = 0.7 }: Props) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const correct = useMemo(() => answers.filter(Boolean).length, [answers]);
  const current = questions[idx];

  const confirm = () => {
    if (selected === null) return;
    const next = [...answers, selected === current.answer];
    setAnswers(next);
    if (next.length === questions.length) onFinish?.(next.filter(Boolean).length / questions.length);
  };

  const advance = () => {
    setIdx((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIdx(0);
    setSelected(null);
    setAnswers([]);
  };

  // idx passes the last question only after the user clicks "Ver resultado".
  if (idx >= questions.length) {
    const score = correct / questions.length;
    const passed = score >= passMark;
    return (
      <div className="panel p-6 text-center">
        <Trophy className={`mx-auto mb-3 h-10 w-10 ${passed ? 'text-signal-amber' : 'text-tactical-label'}`} />
        <div className="label mb-1">{title} · resultado</div>
        <div className="text-4xl font-bold">
          {correct}/{questions.length}
        </div>
        <p className={`mt-2 ${passed ? 'text-signal-green' : 'text-signal-red'}`}>
          {passed ? 'Aprovado! Lição concluída. 🎉' : `Você precisa de ${Math.round(passMark * 100)}% para concluir. Revise o conteúdo e tente de novo.`}
        </p>
        <button className="btn-ghost mt-5" onClick={restart}>
          <RotateCcw className="h-4 w-4" /> Refazer
        </button>
      </div>
    );
  }

  const answered = answers.length > idx;

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="label">{title}</span>
        <span className="font-mono text-xs text-tactical-label">
          {idx + 1} / {questions.length}
        </span>
      </div>
      <div className="mb-5 flex gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i < answers.length ? (answers[i] ? 'bg-signal-green' : 'bg-signal-red') : i === idx ? 'bg-k8s-500' : 'bg-tactical-raised'}`}
          />
        ))}
      </div>
      <h3 className="mb-4 text-lg font-semibold">{current.q}</h3>
      <div className="space-y-2">
        {current.options.map((opt, i) => {
          let style = 'border-tactical-border hover:border-tactical-line hover:bg-tactical-raised';
          if (answered) {
            if (i === current.answer) style = 'border-signal-green bg-signal-green/10';
            else if (i === selected) style = 'border-signal-red bg-signal-red/10';
            else style = 'border-tactical-border opacity-60';
          } else if (i === selected) style = 'border-k8s-500 bg-k8s-500/10';
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setSelected(i)}
              className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ${style}`}
            >
              <span className="font-mono text-tactical-label">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{opt}</span>
              {answered && i === current.answer && <CheckCircle2 className="h-5 w-5 shrink-0 text-signal-green" />}
              {answered && i === selected && i !== current.answer && <XCircle className="h-5 w-5 shrink-0 text-signal-red" />}
            </button>
          );
        })}
      </div>
      {answered && current.explanation && (
        <div className="mt-4 rounded-md border-l-4 border-signal-cyan bg-signal-cyan/10 px-4 py-3 text-sm text-tactical-dim">
          {current.explanation}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        {!answered ? (
          <button className="btn-primary" disabled={selected === null} onClick={confirm}>
            Confirmar
          </button>
        ) : idx < questions.length - 1 ? (
          <button className="btn-primary" onClick={advance}>
            Próxima
          </button>
        ) : (
          <button className="btn-primary" onClick={() => setIdx(questions.length)}>
            Ver resultado
          </button>
        )}
      </div>
    </div>
  );
}

