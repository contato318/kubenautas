import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FlaskConical, Terminal } from 'lucide-react';
import { simulatorGroups } from '../content/home';
import { simulators } from './simulators/registry';

export default function HomeSimulators() {
  const [groupId, setGroupId] = useState(simulatorGroups[0].id);
  const group = simulatorGroups.find((item) => item.id === groupId)!;

  return (
    <section id="laboratorios" aria-labelledby="simulators-title" className="scroll-mt-24 border-y border-tactical-border bg-tactical-surface/50">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="label mb-3">Aprenda executando</p>
            <h2 id="simulators-title" className="text-3xl font-bold tracking-tight md:text-4xl">Mude uma variável. Entenda o resultado.</h2>
            <p className="mt-4 leading-relaxed text-tactical-dim">Provoque falhas, ajuste configurações e acompanhe a resposta do cluster. São {simulators.length} simuladores no navegador para conectar a teoria ao comportamento do Kubernetes.</p>
          </div>
          <Link to="/simuladores" className="btn-ghost shrink-0">Ver todos os simuladores <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-10 grid overflow-hidden rounded-xl border border-k8s-500/30 bg-tactical-bg lg:grid-cols-2">
          <div className="p-6 md:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-k8s-500/30 bg-k8s-500/10 px-3 py-1 text-xs text-k8s-400"><Terminal className="h-3.5 w-3.5" />Um bom primeiro laboratório</span>
            <h3 className="mt-5 text-2xl font-semibold">Seu primeiro contato com o kubectl.</h3>
            <p className="mt-3 text-sm leading-relaxed text-tactical-dim">Um terminal com cluster simulado e missões guiadas. Liste nós, crie um Deployment e veja como os Pods se distribuem, sem instalar um ambiente local.</p>
            <Link to="/simuladores/terminal" className="btn-primary mt-6">Abrir terminal interativo <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="min-w-0 border-t border-tactical-border bg-tactical-raised/40 p-6 md:p-8 lg:border-l lg:border-t-0">
            <p className="label mb-5">O que você vai experimentar</p>
            <ol className="space-y-5">
              {[
                { command: 'kubectl get nodes', description: 'Conheça os nós disponíveis no cluster.' },
                { command: 'kubectl get pods -o wide', description: 'Descubra em qual nó cada Pod foi agendado.' },
                { command: 'kubectl scale deployment web --replicas=5', description: 'Depois de criar o Deployment web, mude o estado desejado e observe as novas réplicas.' },
              ].map((step) => (
                <li key={step.command}>
                  <code className="block break-words font-mono text-xs leading-relaxed text-signal-green sm:text-sm"><span aria-hidden="true" className="mr-2 text-tactical-label">$</span>{step.command}</code>
                  <p className="mt-1.5 text-sm text-tactical-dim">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold">Escolha o que quer investigar</h3>
          <div role="group" aria-label="Objetivo dos simuladores" className="mt-4 flex flex-wrap gap-2">
            {simulatorGroups.map((item) => (
              <button key={item.id} type="button" aria-pressed={groupId === item.id} aria-controls="home-simulator-results" onClick={() => setGroupId(item.id)} className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-k8s-400 ${groupId === item.id ? 'border-k8s-400 bg-k8s-500/15 text-white' : 'border-tactical-line text-tactical-dim hover:border-tactical-label hover:text-white'}`}>{item.title}</button>
            ))}
          </div>
          <div id="home-simulator-results">
            <p className="my-6 max-w-3xl text-sm leading-relaxed text-tactical-dim">{group.description}</p>
            <div className="grid gap-4 md:grid-cols-3">
              {group.experiments.map((experiment) => {
                const simulator = simulators.find((item) => item.id === experiment.id)!;
                return (
                  <article key={simulator.id} className="flex flex-col rounded-lg border border-tactical-border bg-tactical-bg p-5 md:p-6">
                    <div className="flex items-center gap-3"><span aria-hidden="true" className="text-2xl">{simulator.emoji}</span><h4 className="text-lg font-semibold">{simulator.title}</h4></div>
                    <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-tactical-label"><FlaskConical className="h-3.5 w-3.5" />O experimento</p>
                    <p className="mt-2 text-sm leading-relaxed text-tactical-dim">{simulator.description}</p>
                    <div className="mb-6 mt-5 border-t border-tactical-border pt-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-signal-green"><CheckCircle2 className="h-3.5 w-3.5" />O que você vai entender</p>
                      <p className="mt-2 text-sm leading-relaxed text-tactical-dim">{experiment.outcome}</p>
                    </div>
                    <Link to={`/simuladores/${simulator.id}`} className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-k8s-400 hover:underline" aria-label={`Explorar simulador: ${simulator.title}`}>Explorar simulador <ArrowRight className="h-4 w-4" /></Link>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
