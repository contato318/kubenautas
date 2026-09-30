import { useState } from 'react';
import { Badge, MetricBox, RangeField, SimFrame } from './kit';

/**
 * Exit codes de containers e o backoff do CrashLoopBackOff.
 * - 128 + N = processo terminado pelo sinal N (137 = SIGKILL, 143 = SIGTERM, 139 = SIGSEGV…);
 * - o kubelet espera 10s, 20s, 40s… até 5 minutos entre reinícios; o contador zera após 10 minutos rodando bem.
 */

const SIGNALS: Record<number, [string, string]> = {
  1: ['SIGHUP', 'Terminal/controle encerrado'],
  2: ['SIGINT', 'Interrupção (Ctrl+C)'],
  6: ['SIGABRT', 'abort() — falha interna do runtime (ex.: assert, JVM fatal)'],
  9: ['SIGKILL', 'Morte forçada: OOMKilled pelo kernel, ou SIGKILL após o grace period'],
  11: ['SIGSEGV', 'Falha de segmentação: acesso inválido à memória (bug nativo, lib incompatível)'],
  15: ['SIGTERM', 'Encerramento pedido (delete do Pod, rollout, drain) — normal se foi você que pediu'],
};

export function decodeExit(code: number): { title: string; detail: string; tone: 'green' | 'amber' | 'red' } {
  if (code === 0) return { title: 'Sucesso', detail: 'O processo terminou normalmente. Em Deployment isso vira reinício infinito: processos de servidor não devem terminar. Tarefas finitas são Jobs.', tone: 'green' };
  if (code === 1) return { title: 'Erro genérico da aplicação', detail: 'A própria aplicação decidiu sair com erro: config inválida, dependência indisponível, exceção não tratada. Veja kubectl logs --previous.', tone: 'red' };
  if (code === 2) return { title: 'Uso incorreto do comando/shell', detail: 'Argumentos inválidos ou erro de sintaxe em script shell.', tone: 'red' };
  if (code === 126) return { title: 'Comando sem permissão de execução', detail: 'O arquivo existe mas não é executável (chmod +x) ou é um diretório.', tone: 'red' };
  if (code === 127) return { title: 'Comando não encontrado', detail: 'O executável de command/args não existe na imagem ou não está no PATH. Confira a imagem e o entrypoint.', tone: 'red' };
  if (code > 128 && code < 160) {
    const sig = SIGNALS[code - 128];
    return sig
      ? { title: `Compatível com sinal ${code - 128} (${sig[0]})`, detail: sig[1] + '. Confirme Reason, signal e logs: a aplicação também pode retornar esse código explicitamente.', tone: code === 143 ? 'amber' : 'red' }
      : { title: `Compatível com sinal ${code - 128}`, detail: 'Processo morto por um sinal (128 + número do sinal).', tone: 'red' };
  }
  if (code === 255) return { title: 'Saída 255 / -1', detail: 'Código fora do intervalo ou erro fatal genérico (ex.: ssh, alguns runtimes).', tone: 'red' };
  return { title: `Código ${code} definido pela aplicação`, detail: 'Códigos de 3 a 125 têm o significado que a aplicação escolher — consulte a documentação ou os logs.', tone: 'red' };
}

/** Atraso antes do reinício N (1 = primeiro reinício). */
export const backoffDelay = (restart: number) => Math.min(10 * 2 ** (restart - 1), 300);

const COMMON = [0, 1, 126, 127, 134, 137, 139, 143];

export default function TsExitCodeSim() {
  const [code, setCode] = useState(137);
  const [restarts, setRestarts] = useState(6);
  const d = decodeExit(code);
  const delays = Array.from({ length: restarts }, (_, i) => backoffDelay(i + 1));
  const total = delays.reduce((a, b) => a + b, 0);

  return (
    <SimFrame title="Last State: Terminated · Exit Code">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="flex flex-col gap-1">
            <span className="label">Exit code</span>
            <input type="number" min={0} max={255} value={code} onChange={(e) => setCode(Math.max(0, Math.min(255, Number(e.target.value))))} className="w-32 rounded-md border border-tactical-border bg-tactical-bg px-3 py-2 font-mono text-lg" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMON.map((c) => <button key={c} className="btn-ghost px-2 py-1" onClick={() => setCode(c)}>{c}</button>)}
          </div>
          <div className="mt-4 rounded-md border border-tactical-border p-4">
            <Badge tone={d.tone}>{code === 137 ? 'OOMKilled ou SIGKILL' : d.tone === 'green' ? 'ok' : 'falha'}</Badge>
            <h3 className="mt-2 text-lg font-semibold">{d.title}</h3>
            <p className="mt-1 text-sm text-tactical-dim">{d.detail}</p>
            {code === 137 && <p className="mt-2 text-xs text-signal-amber">Diferencie pelo Reason: OOMKilled (limit de memória) × Error com 137 (morto por SIGKILL após o grace period, ou pelo OOM do nó).</p>}
          </div>
        </div>
        <div>
          <RangeField label={`Reinícios: ${restarts}`} min={1} max={10} value={restarts} onChange={setRestarts} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetricBox label="Próxima espera" value={`${backoffDelay(restarts)}s`} tone="text-signal-amber" />
            <MetricBox label="Tempo total em backoff" value={`${Math.floor(total / 60)}m${total % 60}s`} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {delays.map((dl, i) => (
              <div key={i} className="rounded border border-signal-red/50 bg-signal-red/10 px-2 py-1 font-mono text-[10px] text-signal-red">#{i + 1}: {dl}s</div>
            ))}
          </div>
          <p className="mt-3 text-xs text-tactical-label">
            CrashLoopBackOff não é a causa — é o kubelet esperando cada vez mais (10s, 20s, 40s… até 5 min) entre reinícios de um container que continua morrendo. A causa está no exit
            code e nos logs da execução anterior.
          </p>
        </div>
      </div>
    </SimFrame>
  );
}
