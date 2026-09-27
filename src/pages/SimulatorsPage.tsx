import { Link, useParams } from 'react-router-dom';
import { simulators } from '../components/simulators/registry';
import SimulatorHost from '../components/simulators/SimulatorHost';
import { allLessons } from '../content/modules';

export default function SimulatorsPage() {
  const { simId } = useParams();
  const active = simulators.find((s) => s.id === simId) ?? simulators[0];
  const related = allLessons.filter(({ lesson }) => lesson.simulator === active.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="label mb-1">Laboratório</div>
      <h1 className="mb-6 text-3xl font-bold">Simuladores</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {simulators.map((s) => (
          <Link
            key={s.id}
            to={`/simuladores/${s.id}`}
            className={`rounded-md border px-3 py-2 text-sm ${s.id === active.id ? 'border-k8s-500 bg-k8s-500/15 text-white' : 'border-tactical-border text-tactical-dim hover:bg-tactical-raised'}`}
          >
            {s.emoji} {s.title}
          </Link>
        ))}
      </div>
      <p className="mb-4 text-tactical-dim">{active.description}</p>
      <SimulatorHost key={active.id} id={active.id} />
      {related.length > 0 && (
        <p className="mt-6 text-sm text-tactical-label">
          Teoria relacionada:{' '}
          {related.map(({ module, lesson }, i) => (
            <span key={lesson.slug}>
              {i > 0 && ', '}
              <Link className="text-k8s-400 underline" to={`/aprender/${module.id}/${lesson.slug}`}>{lesson.title}</Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
