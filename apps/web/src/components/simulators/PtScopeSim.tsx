import { useState } from 'react';
import { Badge, Choice, SimFrame, Toggle } from './kit';

/** Regras de engajamento: antes de qualquer teste, a ação está dentro do escopo autorizado? */

export interface Engagement {
  authorizationSigned: boolean;
  scope: 'staging-only' | 'prod-readonly' | 'prod-full';
  destructiveAllowed: boolean;
  dataExfilAllowed: boolean;
  windowOpen: boolean;
}
export interface PtAction {
  id: string;
  label: string;
  target: 'staging' | 'prod';
  destructive: boolean;
  readsData: boolean;
}
export const ACTIONS: PtAction[] = [
  { id: 'scan-staging', label: 'Varredura de superfície no cluster de staging', target: 'staging', destructive: false, readsData: false },
  { id: 'list-prod', label: 'Enumerar recursos (get/list) em produção', target: 'prod', destructive: false, readsData: false },
  { id: 'read-secret', label: 'Ler um Secret de produção para comprovar acesso', target: 'prod', destructive: false, readsData: true },
  { id: 'delete-pod', label: 'Apagar um Pod para testar recuperação', target: 'prod', destructive: true, readsData: false },
  { id: 'exfil', label: 'Copiar dados de clientes para fora do cluster', target: 'prod', destructive: false, readsData: true },
];
export type Verdict = 'autorizado' | 'precisa-aprovacao' | 'proibido';

export function checkAction(a: PtAction, e: Engagement): { verdict: Verdict; reason: string } {
  if (!e.authorizationSigned) return { verdict: 'proibido', reason: 'Sem autorização por escrito assinada, nenhum teste pode começar.' };
  if (!e.windowOpen) return { verdict: 'proibido', reason: 'Fora da janela de testes acordada.' };
  if (a.target === 'prod' && e.scope === 'staging-only') return { verdict: 'proibido', reason: 'Produção está fora do escopo (staging-only).' };
  if (a.destructive) {
    if (!e.destructiveAllowed) return { verdict: 'proibido', reason: 'Ações destrutivas não foram autorizadas.' };
    if (a.target === 'prod' && e.scope !== 'prod-full') return { verdict: 'proibido', reason: 'Produção é read-only neste engajamento.' };
    return { verdict: 'precisa-aprovacao', reason: 'Destrutivo em produção: confirme com o responsável antes de executar.' };
  }
  if (a.readsData && a.id === 'exfil') {
    if (!e.dataExfilAllowed) return { verdict: 'proibido', reason: 'Exfiltração de dados reais nunca deve ser feita; comprove com um marcador, não com dados de clientes.' };
    return { verdict: 'precisa-aprovacao', reason: 'Manipular dados reais exige aprovação explícita e registro.' };
  }
  if (a.readsData && a.target === 'prod') return { verdict: 'precisa-aprovacao', reason: 'Leitura de segredo em prod: registre a evidência mínima (nome/hash), não o valor.' };
  return { verdict: 'autorizado', reason: 'Dentro do escopo e das regras de engajamento.' };
}

export default function PtScopeSim() {
  const [e, setE] = useState<Engagement>({ authorizationSigned: false, scope: 'prod-readonly', destructiveAllowed: false, dataExfilAllowed: false, windowOpen: true });
  const set = (p: Partial<Engagement>) => setE((x) => ({ ...x, ...p }));
  const tone = (v: Verdict) => (v === 'autorizado' ? 'green' : v === 'precisa-aprovacao' ? 'amber' : 'red');

  return (
    <SimFrame title="regras de engajamento · a ação está autorizada?">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <Toggle checked={e.authorizationSigned} onChange={(v) => set({ authorizationSigned: v })}><span className="text-xs">Autorização por escrito assinada</span></Toggle>
          <Choice label="Escopo" value={e.scope} onChange={(v) => set({ scope: v })} options={[{ value: 'staging-only', label: 'apenas staging' }, { value: 'prod-readonly', label: 'produção somente leitura' }, { value: 'prod-full', label: 'produção completa' }]} />
          <Toggle checked={e.destructiveAllowed} onChange={(v) => set({ destructiveAllowed: v })}><span className="text-xs">Ações destrutivas autorizadas</span></Toggle>
          <Toggle checked={e.dataExfilAllowed} onChange={(v) => set({ dataExfilAllowed: v })}><span className="text-xs">Manipulação de dados reais autorizada</span></Toggle>
          <Toggle checked={e.windowOpen} onChange={(v) => set({ windowOpen: v })}><span className="text-xs">Dentro da janela de testes</span></Toggle>
        </div>
        <ul className="min-w-0 space-y-2">
          {ACTIONS.map((a) => {
            const r = checkAction(a, e);
            return (
              <li key={a.id} className="rounded-md border border-tactical-border p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span>{a.label}</span><Badge tone={tone(r.verdict)}>{r.verdict}</Badge></div>
                <div className="mt-1 text-xs text-tactical-dim">{r.reason}</div>
              </li>
            );
          })}
          <li className="text-xs text-tactical-label">Um pentest ético começa e termina no papel: autorização assinada, escopo, janela, contatos de emergência e regra de "parar e avisar" se algo crítico ou fora do escopo aparecer. Comprove acesso com o mínimo de impacto — nunca com dados reais de clientes.</li>
        </ul>
      </div>
    </SimFrame>
  );
}
