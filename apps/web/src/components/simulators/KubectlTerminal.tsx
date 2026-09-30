import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { ArrowRight, Boxes, Check, CircleHelp, Eraser, Layers3, Network, RotateCcw, Server, Square, Target, Terminal, TriangleAlert } from 'lucide-react';
import { SimulatorSession } from './kube-sim/session';
import { TerminalText } from './kube-sim/TerminalText';
import { CompletionNotice, MissionTaskCard, ObjectiveProgress, useObjectiveCompletion } from './kube-sim/MissionFeedback';

function TerminalConfirmation({ action, onConfirm, onCancel }: { action: 'clear' | 'reset'; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const resetting = action === 'reset';
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  const close = (callback: () => void) => { dialog.current?.close(); callback(); };
  return <dialog ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); close(onCancel); }} className="lab-dialog w-[440px] max-w-[calc(100vw-2rem)] p-5 sm:p-6">
    <TriangleAlert aria-hidden="true" className="mb-4 h-6 w-6 text-signal-amber" />
    <h2 id={`${id}-title`} className="text-lg font-semibold">{resetting ? 'Reiniciar o terminal?' : 'Limpar a saída do terminal?'}</h2>
    <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-tactical-dim">{resetting ? 'Todos os recursos criados, arquivos, histórico e progresso das missões serão apagados. O cluster voltará ao estado inicial. Esta ação não pode ser desfeita.' : 'O texto exibido no terminal será apagado. Os recursos do cluster, arquivos, histórico e progresso das missões serão mantidos.'}</p>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" autoFocus onClick={() => close(onCancel)} className="btn-ghost">Cancelar</button>
      <button type="button" onClick={() => close(onConfirm)} className="btn border-signal-red/50 bg-signal-red/10 text-signal-red hover:bg-signal-red/20">{resetting ? 'Confirmar reset' : 'Confirmar limpeza'}</button>
    </div>
  </dialog>;
}

function ManifestEditor({ path, content, onClose }: { path: string; content: string; onClose: (value: string | null) => void }) {
  const [value, setValue] = useState(content);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="manifest-title" onCancel={(event) => { event.preventDefault(); onClose(null); }} className="w-[min(900px,92vw)] rounded-xl border border-tactical-border bg-tactical-surface p-5 text-tactical-text backdrop:bg-black/70">
    <h2 id="manifest-title" className="mb-3 break-all font-mono text-sm">Editar {path}</h2>
    <textarea autoFocus aria-label="Conteúdo do arquivo" spellCheck={false} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); onClose(value); } }} className="h-[60vh] w-full rounded-lg border border-tactical-border bg-tactical-bg p-4 font-mono text-xs leading-6 outline-none focus:border-k8s-400" />
    <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => onClose(null)} className="rounded border border-tactical-border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => onClose(value)} className="rounded bg-k8s-500 px-4 py-2 text-sm text-white">Salvar arquivo</button></div>
  </dialog>;
}

export default function KubectlTerminal({ workspace = false }: { workspace?: boolean }) {
  const [session] = useState(() => new SimulatorSession());
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState<'missions' | 'cluster'>('missions');
  const [catalog, setCatalog] = useState(false);
  const [confirmation, setConfirmation] = useState<'clear' | 'reset' | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const mission = session.missions[state.active];
  const done = state.done[state.active];
  const completed = state.done.filter((tasks) => tasks.every(Boolean)).length;
  const missionComplete = done.every(Boolean);
  const completion = useObjectiveCompletion(state.done, session.missions);

  useEffect(() => { session.resume(); const timer = window.setInterval(session.tick, 500); return () => { window.clearInterval(timer); session.stop(); }; }, [session]);
  useLayoutEffect(() => {
    const resize = () => {
      const field = inputRef.current;
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${Math.min(384, Math.max(24, field.scrollHeight))}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [input, state.busy]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [state.lines, input, state.busy]);
  useEffect(() => { if (!state.busy && !state.editing && !document.querySelector('dialog[open]')) inputRef.current?.focus({ preventScroll: true }); }, [state.busy, state.editing]);
  useEffect(() => {
    const interrupt = (event: globalThis.KeyboardEvent) => {
      if (state.busy && !state.editing && !document.querySelector('dialog[open]') && event.ctrlKey && event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        event.preventDefault(); session.interrupt();
      }
    };
    document.addEventListener('keydown', interrupt);
    return () => document.removeEventListener('keydown', interrupt);
  }, [session, state.busy, state.editing]);

  const suggest = useCallback((command: string) => { setInput(command); setHistoryIndex(-1); inputRef.current?.focus(); }, []);
  const run = () => { if (state.busy) return; void session.submit(input); setInput(''); setHistoryIndex(-1); inputRef.current?.focus(); };
  const reset = () => { session.reset(); setInput(''); setHistoryIndex(-1); setDraft(''); setCatalog(false); inputRef.current?.focus(); };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    const field = event.currentTarget;
    const key = event.key.toLowerCase();
    const setLine = (value: string, caret: number) => {
      setInput(value);
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(caret, caret));
    };
    if (event.ctrlKey && ['a', 'e', 'u', 'k', 'w'].includes(key)) {
      event.preventDefault();
      const start = field.selectionStart, end = field.selectionEnd;
      if (key === 'a') field.setSelectionRange(0, 0);
      else if (key === 'e') field.setSelectionRange(input.length, input.length);
      else if (key === 'u') setLine(input.slice(end), 0);
      else if (key === 'k') setLine(input.slice(0, start), start);
      else {
        const before = input.slice(0, start).replace(/\S+\s*$/, '');
        setLine(before + input.slice(end), before.length);
      }
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); run(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); session.clear(); }
    else if (event.ctrlKey && key === 'c' && !state.busy && !window.getSelection()?.toString() && field.selectionStart === field.selectionEnd) { event.preventDefault(); session.interrupt(input); setInput(''); setHistoryIndex(-1); }
    else if (event.ctrlKey && key === 'd' && !input) { event.preventDefault(); if (state.interactive) void session.submit('exit'); }
    else if (event.key === 'Tab' && !event.shiftKey && input.trim()) {
      event.preventDefault();
      const result = session.complete(input, event.currentTarget.selectionStart);
      setInput(result.value);
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(result.caret, result.caret));
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (input.includes('\n') && (event.key === 'ArrowUp' ? input.slice(0, field.selectionStart).includes('\n') : input.slice(field.selectionEnd).includes('\n'))) return;
      event.preventDefault();
      const length = session.history.length;
      if (!length) return;
      if (historyIndex === -1) setDraft(input);
      const next = event.key === 'ArrowUp' ? Math.min(historyIndex + 1, length - 1) : Math.max(historyIndex - 1, -1);
      const value = next < 0 ? draft : session.history[length - 1 - next];
      setHistoryIndex(next); setLine(value, value.length);
    }
  };
  const select = (index: number) => { session.select(index); setCatalog(false); };
  const buttonClass = 'rounded-md border border-tactical-border px-3 py-2 text-[11px] text-tactical-dim hover:border-k8s-400 hover:text-k8s-400 disabled:opacity-40';

  return <div className={`kubectl-workbench grid min-w-0 gap-3 ${workspace ? 'kubectl-workbench-expanded' : 'kubectl-workbench-embedded lg:grid-cols-[minmax(0,1fr)_340px]'}`}>
    <section aria-label="Console kubectl" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-tactical-border bg-[#080a0e]">
      <div className="flex shrink-0 items-center gap-2 border-b border-tactical-border bg-tactical-surface px-4">
        <div className="-mb-px flex min-h-12 items-center gap-2 border-b-2 border-k8s-400 px-1 font-mono text-xs"><Terminal aria-hidden="true" className="h-4 w-4 text-k8s-400" />kubectl</div>
        <span className="ml-2 hidden font-mono text-[10px] text-tactical-label sm:inline">{state.interactive ? 'container' : 'bash · Linux'}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="lab-icon-button" aria-label="Ajuda de comandos" title="Ajuda de comandos" disabled={state.busy} onClick={() => { void session.submit('help'); }}><CircleHelp aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" className="lab-icon-button" aria-label="Limpar terminal" title="Limpar terminal (Ctrl+L)" onClick={() => setConfirmation('clear')}><Eraser aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" className="lab-icon-button" aria-label="Reiniciar cluster" title="Reiniciar cluster, arquivos e missões" onClick={() => setConfirmation('reset')}><RotateCcw aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-4 divide-x divide-tactical-border border-b border-tactical-border bg-tactical-surface/40">
        {[{ title: 'Nós', value: state.nodes.length, icon: Server }, { title: 'Pods', value: state.pods.length, icon: Boxes }, { title: 'Deploys', value: state.deployments, icon: Layers3 }, { title: 'Services', value: state.services, icon: Network }].map((metric) => <div key={metric.title} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-3"><metric.icon aria-hidden="true" className="hidden h-3.5 w-3.5 text-tactical-label sm:block" /><span className="font-mono text-[10px] text-tactical-label">{metric.title}</span><span className="ml-auto font-mono text-sm">{metric.value}</span></div>)}
      </div>
      <div ref={scroller} onMouseUp={(event) => { if (!window.getSelection()?.toString() && !(event.target as HTMLElement).closest('button, a, textarea')) inputRef.current?.focus({ preventScroll: true }); }} className="kubectl-output lab-scroll min-h-0 flex-1 overflow-auto overscroll-y-contain p-4 font-mono text-xs leading-6 sm:p-5">
        <div role="log" aria-label="Saída do terminal" aria-live="polite" aria-relevant="additions text">
          {state.lines.map((line, index) => <pre key={index} className={`whitespace-pre-wrap break-words ${line.kind === 'in' ? 'text-white' : line.kind === 'err' ? 'text-signal-red' : 'text-tactical-dim'}`}><TerminalText value={line.ansi || line.text} /></pre>)}
        </div>
        {state.busy ? <div className="flex items-center gap-3 py-2 text-[10px] text-tactical-label"><span role="status">Em execução · Ctrl+C para interromper</span><button type="button" aria-label="Interromper comando" title="Interromper comando (Ctrl+C)" onClick={() => session.interrupt()} className={buttonClass}><Square aria-hidden="true" className="h-3 w-3" /></button></div> : <div className="flex flex-wrap items-start gap-x-1">
          <span className="min-w-0 break-all text-white" aria-hidden="true"><TerminalText value={state.promptAnsi} /></span>
          <textarea ref={inputRef} value={input} rows={Math.min(16, Math.max(1, input.split('\n').length))} onChange={(event) => setInput(event.target.value)} onKeyDown={onKey} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" aria-label="Terminal kubectl" aria-describedby="kubectl-shortcuts" className="kubectl-command-input min-h-6 min-w-[10ch] flex-1 resize-none bg-transparent p-0 leading-6 text-white caret-signal-green outline-none" />
          <button type="button" aria-label="Executar comando" title="Executar comando (Enter)" disabled={!input.trim() && !state.pending} onClick={run} className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center text-tactical-label hover:text-k8s-400 disabled:opacity-30"><ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
        </div>}
      </div>
      <CompletionNotice completion={completion} />
      <div id="kubectl-shortcuts" className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-tactical-border bg-tactical-surface/60 px-4 py-2.5 font-mono text-[9px] text-tactical-label"><span>Tab completa</span><span>↑ ↓ histórico</span><span>Shift Enter nova linha</span><span>Ctrl C interrompe</span><span>Ctrl L limpa</span><span>Shift Tab sai do terminal</span></div>
    </section>

    <aside aria-label="Acompanhamento do cluster" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-tactical-border bg-tactical-surface">
      <div role="group" aria-label="Painel do terminal" className="flex shrink-0 border-b border-tactical-border px-4">
        {(['missions', 'cluster'] as const).map((tab) => <button key={tab} type="button" aria-pressed={panel === tab} onClick={() => setPanel(tab)} className={`-mb-px flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 text-xs ${panel === tab ? 'border-k8s-400 text-white' : 'border-transparent text-tactical-label'}`}>{tab === 'missions' ? <><Target aria-hidden="true" className="h-3.5 w-3.5" />Missões <span className="font-mono text-[10px]">{completed}/23</span></> : <><Boxes aria-hidden="true" className="h-3.5 w-3.5" />Cluster</>}</button>)}
      </div>
      <div role="region" aria-label={panel === 'missions' ? 'Missões do terminal' : 'Recursos do cluster'} tabIndex={0} className="lab-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-k8s-400">
        {panel === 'missions' ? <>
          <progress aria-label="Missões concluídas" value={completed} max={session.missions.length} className="lab-progress mb-3 h-1.5 w-full" />
          {catalog ? <>
            <p className="mb-4 text-xs leading-5 text-tactical-label">23 missões em cinco níveis. Siga a ordem: alguns exercícios usam os recursos das missões anteriores.</p>
            {session.levels.map(([level, title]) => <div key={level} className="mb-5"><h3 className="label mb-2">{title}</h3><ol className="space-y-1">{session.missions.map((item, index) => item.level !== level ? null : <li key={item.id}><button type="button" onClick={() => select(index)} className="flex w-full items-center gap-2 rounded-lg border border-tactical-border p-3 text-left text-xs hover:border-k8s-400"><span className="font-mono text-k8s-400">{state.done[index].every(Boolean) ? <Check aria-label="Concluída" className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1">{item.title}{item.scenario && <span className="mt-1 block text-[9px] text-tactical-label">Cenário de investigação</span>}</span></button></li>)}</ol></div>)}
          </> : <div key={mission.id}>
            <button type="button" onClick={() => setCatalog(true)} className="mb-4 text-[11px] text-k8s-400">← Todas as missões</button>
            <label htmlFor="terminal-mission" className="label mb-2 block">Missão {state.active + 1} de 23</label>
            <select id="terminal-mission" value={state.active} onChange={(event) => select(Number(event.target.value))} className="mb-4 w-full min-w-0 rounded-md border border-tactical-border bg-tactical-bg px-2 py-2 text-xs">
              {session.levels.map(([level, title]) => <optgroup key={level} label={title}>{session.missions.map((item, index) => item.level === level ? <option key={item.id} value={index}>{index + 1}. {item.title}</option> : null)}</optgroup>)}
            </select>
            <h3 className="mb-2 text-sm font-semibold">{mission.title}</h3><p className="mb-4 text-xs leading-5 text-tactical-dim">{mission.intro}</p>
            {mission.scenario && <div className="mb-4 rounded-lg border border-k8s-400/30 bg-k8s-500/5 p-3"><button type="button" onClick={session.prepare} disabled={state.busy} className={buttonClass}>{state.prepared[state.active] ? 'Preparar de novo' : 'Preparar cenário'}</button><p className="mt-2 text-[10px] leading-4 text-tactical-label">Cria os recursos com problema para você investigar.</p></div>}
            <div className="mb-3 flex items-center justify-between text-[10px] text-tactical-label"><span>Objetivos concluídos</span><span>{done.filter(Boolean).length}/{done.length}</span></div>
            <ObjectiveProgress complete={done.filter(Boolean).length} total={done.length} />
            <ol className="space-y-3">{mission.tasks.map((task, index) => <MissionTaskCard key={index} task={task} index={index} done={done[index]} onSuggest={suggest} />)}</ol>
            {missionComplete && <p role="status" className="mt-4 text-xs text-signal-green">Missão concluída!</p>}
            {state.active < session.missions.length - 1 && <button type="button" onClick={() => select(state.active + 1)} className={`${buttonClass} mt-4 w-full`}>Próxima missão →</button>}
            {completed === session.missions.length && <p role="status" className="mt-4 text-xs text-signal-green">Todas as 23 missões concluídas!</p>}
          </div>}
        </> : <>
          <h3 className="label mb-3">Nós · {state.nodes.length}</h3><ul className="space-y-2">{state.nodes.map((node) => <li key={node.name} className="rounded-lg border border-tactical-border p-3"><p className="break-all font-mono text-[11px]">{node.name}</p><p className="mt-1 text-[10px] text-tactical-label">{node.schedulable ? 'Agendável' : 'Não agendável'}</p></li>)}</ul>
          <h3 className="label mb-3 mt-5">Pods · {state.pods.length}</h3><ul className="space-y-2">{state.pods.map((pod) => <li key={`${pod.namespace}/${pod.name}`} className="rounded-lg border border-tactical-border p-3"><p className="break-all font-mono text-[10px] leading-5">{pod.name}</p><p className="text-[9px] text-tactical-label">{pod.namespace} · {pod.node}</p><p className={`mt-1 text-[10px] ${pod.status === 'Running' ? 'text-signal-green' : 'text-signal-amber'}`}>{pod.status}</p></li>)}</ul>
        </>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-tactical-border px-4 py-3 font-mono text-[9px] text-tactical-label"><span>ns <span className="text-tactical-dim">{state.namespace}</span></span><span>K8s v1.31 · kind-sim</span></div>
    </aside>
    {state.editing && <ManifestEditor path={state.editing.path} content={state.editing.content} onClose={session.finishEdit} />}
    {confirmation && <TerminalConfirmation action={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); if (confirmation === 'reset') reset(); else session.clear(); }} />}
  </div>;
}
