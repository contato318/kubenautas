import { parse, parseAllDocuments } from 'yaml';
import util from './core/util';
import schema from './core/schema';
import sh from './core/sh';
import images from './core/images';
import cluster from './core/cluster';
import controllers from './core/controllers';
import printers from './core/printers';
import kubectl from './core/kubectl';
import kubectl2 from './core/kubectl2';
import examples from './core/examples';
import shell from './core/shell';
import missions from './core/missions';

const plain = (value) => String(value).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
const banner = 'Jack Academy · Terminal Linux e Kubernetes v1.31 simulado\n1 control-plane + 2 workers · 23 missões guiadas\n\nExplore: ls · cd examples · pwd · cat nginx-deployment.yaml\nUse help para ver os comandos do shell e do kubectl.\n';

export class SimulatorSession {
  constructor() {
    this.listeners = new Set();
    this.generation = 0;
    this.runtime = { KS: {}, console, jsyaml: {
      load: (text) => parse(text),
      loadAll: (text) => parseAllDocuments(text).map((doc) => {
        if (doc.errors.length) throw doc.errors[0];
        return doc.toJS();
      }),
    } };
    for (const install of [util, schema, sh, images, cluster, controllers, printers, kubectl, kubectl2, examples, shell, missions]) install(this.runtime);
    this.KS = this.runtime.KS;
    this.missions = this.KS.missions;
    this.levels = this.KS.missionLevels;
    this.reset();
  }
  subscribe = (callback) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  getSnapshot = () => this.snapshot;
  emit() {
    const list = (id) => this.cluster.rawList(this.KS.schema.byId(id));
    const pods = list('pods');
    this.snapshot = {
      lines: this.lines, busy: this.busy && !this.lineWaiter, prompt: plain(this.currentPrompt()), promptAnsi: this.currentPrompt(),
      interactive: this.sessions.length > 0, pending: !!this.pending,
      namespace: this.curNs(), active: this.active, done: this.done.map((x) => [...x]),
      prepared: [...this.prepared], editing: this.editing && { path: this.editing.path, content: this.editing.content },
      nodes: list('nodes').map((n) => ({ name: n.metadata.name, schedulable: !n.spec.unschedulable })),
      pods: pods.map((p) => ({ name: p.metadata.name, namespace: p.metadata.namespace, node: p.spec.nodeName || 'Não agendado', status: this.KS.printers.podStatus(p).status })),
      deployments: list('deployments.apps').length, services: list('services').length,
    };
    for (const listener of this.listeners) listener();
  }
  write(text, kind = 'out') {
    if (!text) return;
    const ansi = String(text).replace(/\r/g, '');
    const value = plain(ansi);
    const last = this.lines.at(-1);
    this.lines = last?.kind === kind && kind !== 'in'
      ? [...this.lines.slice(-499, -1), { kind, text: (last.text + value).slice(-150000), ansi: ((last.ansi || last.text) + ansi).slice(-150000) }]
      : [...this.lines.slice(-499), { kind, text: value.slice(-150000), ansi: ansi.slice(-150000) }];
    this.emit();
  }
  clear = () => { this.lines = []; this.emit(); };
  stop() {
    this.generation++;
    if (this.signal) this.signal.aborted = true;
    for (const job of this.shell?.jobs || []) job.signal.aborted = true;
    for (const session of this.sessions || []) session.resolve(130);
    this.sessions = [];
    this.editing?.resolve(null);
    this.editing = null;
    this.lineWaiter?.resolve('');
    this.lineWaiter = null;
    this.busy = false;
    this.pending = '';
  }
  reset = () => {
    this.stop();
    this.cluster = new this.KS.Cluster();
    this.vfs = new this.KS.VFS();
    this.KS.bootstrapFS(this.vfs, this.cluster);
    this.KS.attachStaticPodSync(this.vfs, this.cluster);
    this.history = [];
    this.commands = [];
    this.shell = new this.KS.HostShell({ cluster: this.cluster, fs: this.vfs, term: this.shellTerm(), history: this.history });
    this.KS.term = this;
    this.done = this.missions.map((m) => m.tasks.map(() => false));
    this.prepared = this.missions.map(() => false);
    this.historyStarts = this.missions.map(() => null);
    this.historyStarts[0] = 0;
    this.active = 0;
    this.lines = [{ kind: 'out', text: banner }];
    this.emit();
  };
  shellTerm() {
    // Commands started before a reset/unmount cannot reopen an editor or clear
    // the replacement session after their asynchronous work settles.
    const generation = this.generation;
    const guard = (callback, fallback) => (...args) => generation === this.generation ? callback(...args) : fallback;
    return {
      clear: guard(this.clear), resetCluster: guard(this.resetCluster),
      editor: guard(this.editor.bind(this), Promise.resolve(null)),
      interactive: guard(this.interactive.bind(this), Promise.resolve(130)),
      readLine: guard(this.readLine.bind(this), Promise.resolve('')),
      helpText: () => this.helpText(),
    };
  }
  resume = () => { this.shell.term = this.shellTerm(); this.emit(); };
  resetCluster = () => this.reset();
  curNs() {
    try {
      const config = parse(this.vfs.read('/root/.kube/config'));
      return config.contexts.find((c) => c.name === config['current-context'])?.context.namespace || 'default';
    } catch { return 'default'; }
  }
  currentPrompt() {
    return this.lineWaiter?.prompt || (this.pending ? '> ' : this.sessions.at(-1)?.sh.prompt() || this.shell.prompt());
  }
  tick = () => { this.cluster.tick(); this.check(); this.emit(); };
  check() {
    const index = this.active, mission = this.missions[index];
    if (mission.scenario && !this.prepared[index]) return;
    const helpers = this.KS.missionHelpers(this);
    helpers.ran = (regex) => this.commands.slice(this.historyStarts[index] ?? this.commands.length).some((line) => regex.test(line));
    for (let i = 0; i < mission.tasks.length; i++) {
      if (this.done[index][i]) continue;
      try { this.done[index][i] = !!mission.tasks[i].check(helpers); } catch { /* The requested resource may not exist yet. */ }
      if (!this.done[index][i]) break;
    }
  }
  select = (index) => {
    if (!this.missions[index]) return;
    this.active = index;
    this.historyStarts[index] ??= this.commands.length;
    this.check(); this.emit();
  };
  prepare = () => {
    if (this.busy || this.sessions.length) return;
    const mission = this.missions[this.active];
    if (!mission.setup) return;
    for (const [id, ns, name] of mission.cleanup || []) {
      const type = this.KS.schema.byId(id), resource = this.cluster.raw(type, ns, name);
      if (resource) this.cluster.removeRaw(type, resource);
    }
    try {
      mission.setup(this);
      this.done[this.active] = mission.tasks.map(() => false);
      this.historyStarts[this.active] = this.commands.length;
      this.prepared[this.active] = true;
      this.write(`\nCenário preparado: ${mission.title}. Investigue pelo terminal.\n`);
      this.tick();
    } catch (error) { this.write(`Não foi possível preparar o cenário: ${error.message}\n`, 'err'); }
  };
  helpText() {
    return `${banner}\n\x1b[1mArquivos e diretórios\x1b[0m\n  ls -la · pwd · cd examples · cd ..\n  cat arquivo · head arquivo · tail arquivo\n  mkdir pasta · touch arquivo · cp origem destino · mv origem destino · rm arquivo\n  vi arquivo.yaml                   (editor; Ctrl+S salva)\n\n\x1b[1mShell\x1b[0m\n  echo · printf · grep · sed · awk · sort · uniq · wc · jq\n  ls examples | grep nginx\n  echo ola > notas.txt && cat notas.txt\n  export APP=web; echo "$APP"\n  alias k=kubectl · history · jobs · fg\n  Pipes, redirecionamentos, heredocs, $(...), &&, ||, for/while e jobs com &.\n\n\x1b[1mCluster e containers\x1b[0m\n  kubectl get nodes -o wide\n  kubectl apply -f examples/nginx-deployment.yaml\n  kubectl get pods -w                (Ctrl+C para parar)\n  kubectl exec -it deploy/app -- bash\n  kubectl edit deploy app\n  curl · wget · openssl · crictl\n\nTab completa · ↑/↓ histórico · Shift+Enter nova linha\nCtrl+A/E início/fim · Ctrl+U/K apaga até início/fim · Ctrl+W apaga palavra\nCtrl+C interrompe · Ctrl+L limpa · Ctrl+D sai do container\nreset-cluster reinicia o cluster, os arquivos e as missões.\n`;
  }
  editor(path, content) {
    return new Promise((resolve) => { this.editing = { path, content, resolve }; this.emit(); });
  }
  finishEdit = (content) => {
    const editing = this.editing;
    this.editing = null; editing?.resolve(content); this.emit();
  };
  readLine(prompt) {
    return new Promise((resolve) => { this.lineWaiter = { prompt, resolve }; this.emit(); });
  }
  async interactive(s, io) {
    const podShell = new this.KS.PodShell(this.cluster, s.pod, s.container, io);
    const argv = s.argv;
    const isShell = argv && ['sh', 'bash', 'ash', 'zsh', 'dash'].includes(argv[0].split('/').pop()) && !argv.includes('-c');
    if (argv && !isShell) {
      const code = await podShell.execArgv(argv, '');
      if (code === 'notfound') { io.err(`exec: ${argv[0]}: executable file not found in $PATH\n`); return 1; }
      return code;
    }
    if (argv ? !podShell.hasTool(argv[0].split('/').pop()) : !podShell.prof.shell) {
      io.err('error: container has no requested shell\n'); return 1;
    }
    return new Promise((resolve) => { this.sessions.push({ sh: podShell, resolve }); this.busy = false; this.emit(); });
  }
  interrupt = (input = '') => {
    if (this.lineWaiter) { this.lineWaiter.resolve(''); this.lineWaiter = null; }
    else if (this.busy && this.signal) this.signal.aborted = true;
    const prefix = this.busy ? '' : this.currentPrompt() + input;
    this.pending = '';
    this.write(prefix + '^C\n', 'in');
  };
  async submit(line) {
    if (this.lineWaiter) {
      const waiter = this.lineWaiter; this.lineWaiter = null;
      this.write(waiter.prompt + line + '\n', 'in'); waiter.resolve(line); return;
    }
    if (this.busy) return;
    const generation = this.generation, session = this.sessions.at(-1);
    this.write(this.currentPrompt() + line + '\n', 'in');
    const src = this.pending ? `${this.pending}\n${line}` : line;
    if (!src.trim()) return;
    try { this.KS.sh.parse(src); } catch (error) {
      if (error.incomplete) { this.pending = src; this.emit(); return; }
    }
    this.pending = '';
    if (this.history.at(-1) !== src) this.history.push(src);
    this.commands.push(src);
    this.busy = true;
    this.signal = { aborted: false };
    const current = () => generation === this.generation;
    const io = {
      out: (text) => { if (current()) this.write(text); },
      err: (text) => { if (current()) this.write(text, 'err'); },
      stdin: null, signal: this.signal, clear: () => { if (current()) this.clear(); },
    };
    this.emit();
    let code = 0;
    try {
      if (session) {
        session.sh.io.signal = this.signal;
        const result = await session.sh.runLine(src, io);
        if (!current()) return;
        code = result.code || 0;
        if (result.exit) { this.sessions.pop(); session.resolve(result.code || 0); }
      } else {
        code = await this.shell.runLine(src, io);
        if (current()) io.out(this.shell.reapJobs());
      }
    } catch (error) { code = 1; io.err(`${error.message || error}\n`); }
    finally {
      if (current()) { this.busy = false; this.tick(); }
    }
    return code;
  }
    complete(val, caret = val.length) {
      const KS = this.KS, S = KS.schema;
      const before = val.slice(0, caret);
      const words = before.split(/\s+/);
      const cur = words[words.length - 1];
      const prev = words.slice(0, -1).filter(Boolean);
      let cands = [];
      const session = this.sessions[this.sessions.length - 1];
      const fsys = session ? session.sh.fs : this.vfs;
      const fileCands = () => {
        const dir = cur.includes('/') ? cur.slice(0, cur.lastIndexOf('/') + 1) : '';
        try { return fsys.list(dir || '.').map((n) => dir + n); } catch (e) { return []; }
      };
      const isK = prev[0] === 'kubectl' || prev[0] === 'k';
      if (!prev.length) {
        cands = session ? [] : Object.keys(this.shell.interp.commands).filter((n) => !n.startsWith('__')).concat(Object.keys(this.shell.interp.aliases));
        if (cur.includes('/')) cands = fileCands();
      } else if (isK && !session) {
        const args = prev.slice(1).filter((a, i, arr) => !a.startsWith('-') && !['-n', '--namespace', '-o', '--output', '-f', '--filename', '-l', '-c', '--container'].includes(arr[i - 1]));
        const flagPrev = prev[prev.length - 1];
        const nsIdx = prev.findIndex((a) => a === '-n' || a === '--namespace');
        const ns = nsIdx >= 0 ? prev[nsIdx + 1] : this.curNs();
        const C = KS.kubectl.CMD;
        const def0 = C[args[0]];
        const def = def0 && def0.sub && args[1] && def0.sub[args[1]] ? def0.sub[args[1]] : def0;
        if (cur.startsWith('-')) cands = [...Object.keys({ ...((def && def.flags) || {}), namespace: 1, context: 1 }).map((f) => '--' + f), '-n', '-o', '-A', '-l', '-f', '-w'];
        else if (flagPrev === '-n' || flagPrev === '--namespace') cands = this.cluster.rawList(S.byId('namespaces')).map((n) => n.metadata.name);
        else if (flagPrev === '-o' || flagPrev === '--output') cands = ['yaml', 'json', 'wide', 'name', 'jsonpath=', 'custom-columns=', 'go-template='];
        else if (flagPrev === '-f' || flagPrev === '--filename') cands = fileCands();
        else if (flagPrev === '-c' || flagPrev === '--container') cands = [];
        else if (!args.length) cands = Object.keys(C);
        else if (def0 && def0.sub && Object.keys(def0.sub).length && args.length === 1) cands = Object.keys(def0.sub);
        else if (args[0] === 'config') {
          try { cands = (this.runtime.jsyaml.load(this.vfs.read('/root/.kube/config')).contexts || []).map((c) => c.name); } catch (e) { cands = []; }
        } else {
          const rest = def0 && def0.sub && def0.sub[args[1]] ? args.slice(2) : args.slice(1);
          const podCmds = ['logs', 'exec', 'attach', 'port-forward', 'cp'];
          const nodeCmds = ['cordon', 'uncordon', 'drain'];
          if (cur.includes('/')) {
            const [tn, pre] = cur.split('/');
            const t = S.resolve(tn);
            if (t) cands = this.cluster.rawList(t, t.namespaced ? ns : null).map((o) => `${tn}/${o.metadata.name}`).filter((x) => x.startsWith(`${tn}/${pre}`));
          } else if (podCmds.includes(args[0]) || nodeCmds.includes(args[0]) || args[0] === 'top' || (args[0] === 'taint' && rest.length === 1)) {
            const t = nodeCmds.includes(args[0]) || args[0] === 'taint' || (args[0] === 'top' && /^no/.test(args[1] || '')) ? S.byId('nodes') : S.byId('pods');
            cands = this.cluster.rawList(t, t.namespaced ? ns : null).map((o) => o.metadata.name);
          } else if (!rest.length) cands = [...new Set(S.types.filter((t) => t.group !== 'metrics.k8s.io').flatMap((t) => [t.plural, ...t.short]))].sort();
          else {
            const t = S.resolve(rest[0].split(',')[0]);
            if (t) cands = this.cluster.rawList(t, t.namespaced ? ns : null).map((o) => o.metadata.name);
          }
        }
      } else cands = fileCands();
      const matches = [...new Set(cands)].filter((c) => c.startsWith(cur)).sort();
      if (!matches.length) return { value: val, caret };
      let common = matches[0];
      for (const m of matches) while (!m.startsWith(common)) common = common.slice(0, -1);
      if (matches.length === 1) common = matches[0] + (/[/=]$/.test(matches[0]) ? '' : ' ');
      if (common.length > cur.length) {
        const value = before.slice(0, before.length - cur.length) + common + val.slice(caret);
        const p = before.length - cur.length + common.length;
        return { value, caret: p };
      } else if (matches.length > 1) {
        this.write(matches.slice(0, 300).join('   ') + '\n');
      }
      return { value: val, caret };
    }

}
