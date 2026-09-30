import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Shuffle } from 'lucide-react';
import { allLessons } from '../content/modules';
import { useProgress } from '../hooks/useProgress';
import Quiz from '../components/Quiz';
import type { Question } from '../types';

export const EXAM_SIZE = 35;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles the options too, remapping the answer index. */
function draw(): Question[] {
  const pool = allLessons.flatMap(({ lesson }) => lesson.quiz);
  return shuffle(pool)
    .slice(0, EXAM_SIZE)
    .map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
    });
}

export default function ExamPage() {
  const { progress, recordExam } = useProgress();
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  const start = () => {
    setQuestions(draw());
    setRound((r) => r + 1);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="label mb-1">Certificação Kubenautas</div>
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <GraduationCap className="h-8 w-8 text-signal-amber" /> Prova final
      </h1>
      <p className="mt-2 text-tactical-dim">
        {EXAM_SIZE} perguntas sorteadas de todas as lições, com alternativas embaralhadas. Aprovação com 70%.
        {progress.examBest !== undefined && <> Sua melhor nota: <strong className="text-signal-green">{Math.round(progress.examBest * 100)}%</strong>.</>}
      </p>
      <div className="mt-8">
        {questions ? (
          <>
            <Quiz key={round} questions={questions} title="Prova final" onFinish={recordExam} />
            <button className="btn-ghost mt-4" onClick={start}>
              <Shuffle className="h-4 w-4" /> Sortear nova prova
            </button>
          </>
        ) : (
          <div className="panel p-8 text-center">
            <p className="mb-6 text-tactical-dim">
              Recomendado depois de concluir a <Link to="/trilha" className="text-k8s-400 underline">trilha</Link>, mas você pode tentar quando quiser.
            </p>
            <button className="btn-primary px-6 py-3 text-sm" onClick={start}>Iniciar prova</button>
          </div>
        )}
      </div>
    </div>
  );
}
