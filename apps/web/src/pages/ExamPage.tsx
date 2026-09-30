import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { GraduationCap, Shuffle } from 'lucide-react';
import { allLessons } from '../content/modules';
import { useProgress } from '../hooks/useProgress';
import Quiz from '../components/Quiz';
import CertificateSection from '../components/CertificateSection';
import ExamIntro from '../components/ExamIntro';
import type { Question } from '../types';
import { useActivity } from '../hooks/useActivity';
import { useAccount } from '../auth/AccountProvider';

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
  const { user, status } = useAccount();
  const canStart = !!user && status === 'ready';
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  const track = useActivity();

  useEffect(() => {
    if (!questions || !heading.current) return;
    heading.current.focus({ preventScroll: true });
    window.scrollTo({ top: heading.current.getBoundingClientRect().top + window.scrollY - 120, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [questions, round, reducedMotion]);

  const start = () => {
    if (!canStart) return;
    track('exam_started', 'final');
    setQuestions(draw());
    setRound((r) => r + 1);
  };

  return (
    <motion.div
      key={questions ? 'exam' : 'intro'}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
      className={`mx-auto px-4 py-8 sm:px-6 sm:py-12 ${questions ? 'max-w-3xl' : 'max-w-6xl'}`}
    >
        {questions ? (
          <>
            <header className="mb-7">
              <p className="label mb-3">Certificação Jack Academy</p>
              <h1 ref={heading} tabIndex={-1} className="flex items-center gap-3 text-3xl font-bold tracking-tight outline-none sm:text-4xl"><GraduationCap aria-hidden="true" className="h-7 w-7 shrink-0 text-signal-amber" />Prova final</h1>
              <p className="mt-3 text-sm leading-6 text-tactical-dim">Uma questão de cada vez. Leia, escolha sua resposta e continue no seu ritmo.</p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-tactical-border pt-4 text-xs text-tactical-label"><span>{EXAM_SIZE} perguntas</span><span>Aprovação com 70%</span>{progress.examBest !== undefined && <span>Sua melhor nota: <strong className={progress.examBest >= 0.7 ? 'text-signal-green' : 'text-signal-amber'}>{Math.round(progress.examBest * 100)}%</strong></span>}</div>
            </header>
            <Quiz key={round} questions={questions} title="Prova final" onFinish={recordExam} resultContent={<CertificateSection />} />
            <button type="button" className="btn-ghost mt-5 min-h-11" disabled={!canStart} onClick={start}>
              <Shuffle aria-hidden="true" className="h-4 w-4" /> Sortear nova prova
            </button>
          </>
        ) : (
          <ExamIntro size={EXAM_SIZE} onStart={start}><CertificateSection /></ExamIntro>
        )}
    </motion.div>
  );
}
