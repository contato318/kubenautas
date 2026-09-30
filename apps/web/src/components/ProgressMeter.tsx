export default function ProgressMeter({ label, done, total, color = 'blue' }: { label: string; done: number; total: number; color?: 'blue' | 'green' | 'amber' }) {
  const percentage = total ? Math.round(done / total * 100) : 0;
  const colors = { blue: 'bg-k8s-400', green: 'bg-signal-green', amber: 'bg-signal-amber' };
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} de ${total} · ${percentage}%`} className="h-1.5 overflow-hidden rounded-full bg-tactical-line">
      <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${colors[color]}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}
