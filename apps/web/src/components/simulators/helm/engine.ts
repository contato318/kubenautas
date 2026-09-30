import YAML from 'yaml';
import { GoInt, Val, goPrint, isMap } from './values';
import { sha256 } from './sha256';

/**
 * Motor de templates didático: subconjunto do Go text/template + Sprig usado pelo Helm.
 * Suporta: {{- -}}, comentários, pipelines, parênteses, variáveis ($x := / =), if/else if/else,
 * range (listas e mapas, com $i, $v), with, define/include/template, tpl e as funções mais usadas.
 * Como o Helm, troca "<no value>" por vazio na saída final.
 */

export class TemplateError extends Error {
  constructor(message: string, public line?: number, public exec = false) {
    super(message);
  }
}

type Tok = { kind: 'text'; text: string } | { kind: 'action'; src: string; line: number };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const lineAt = (pos: number) => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const open = src.indexOf('{{', i);
    if (open === -1) {
      out.push({ kind: 'text', text: src.slice(i) });
      break;
    }
    let text = src.slice(i, open);
    let start = open + 2;
    if (src[start] === '-' && /\s/.test(src[start + 1] ?? '')) {
      text = text.replace(/\s+$/, '');
      start += 1;
    }
    const close = src.indexOf('}}', start);
    if (close === -1) throw new TemplateError('unclosed action', lineAt(open));
    let end = close;
    let trimRight = false;
    if (src[close - 1] === '-' && /\s/.test(src[close - 2] ?? '')) {
      trimRight = true;
      end = close - 1;
    }
    out.push({ kind: 'text', text });
    const body = src.slice(start, end).trim();
    if (!body.startsWith('/*')) out.push({ kind: 'action', src: body, line: lineAt(open) });
    i = close + 2;
    if (trimRight) while (i < src.length && /\s/.test(src[i])) i++;
  }
  return out.filter((t) => t.kind === 'action' || t.text !== '');
}

// ---------------------------------------------------------------------------
// Expressões
// ---------------------------------------------------------------------------

type Term =
  | { t: 'field'; base: 'dot' | string; path: string[] }
  | { t: 'lit'; v: Val }
  | { t: 'ident'; name: string }
  | { t: 'sub'; pipe: Pipeline };
type Command = Term[];
interface Pipeline {
  decl?: { names: string[]; define: boolean };
  cmds: Command[];
}

function tokenizeExpr(src: string): string[] {
  const toks: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      toks.push(src.slice(i, j + 1));
      i = j + 1;
    } else if (ch === '`') {
      const j = src.indexOf('`', i + 1);
      toks.push(src.slice(i, j + 1));
      i = j + 1;
    } else if ('()|,'.includes(ch)) {
      toks.push(ch);
      i++;
    } else if (src.startsWith(':=', i)) {
      toks.push(':=');
      i += 2;
    } else if (ch === '=') {
      toks.push('=');
      i++;
    } else {
      let j = i;
      while (j < src.length && !/[\s()|,"=]/.test(src[j]) && !src.startsWith(':=', j)) j++;
      toks.push(src.slice(i, j));
      i = j;
    }
  }
  return toks;
}

function parsePipeline(src: string): Pipeline {
  const toks = tokenizeExpr(src);
  let pos = 0;
  let decl: Pipeline['decl'];
  const declIdx = toks.findIndex((t) => t === ':=' || t === '=');
  if (declIdx > 0 && toks.slice(0, declIdx).every((t) => t.startsWith('$') || t === ',')) {
    decl = { names: toks.slice(0, declIdx).filter((t) => t !== ','), define: toks[declIdx] === ':=' };
    pos = declIdx + 1;
  }
  const parse = (): Pipeline => {
    const cmds: Command[] = [];
    let cmd: Command = [];
    while (pos < toks.length) {
      const tok = toks[pos];
      if (tok === ')') break;
      pos++;
      if (tok === '|') {
        cmds.push(cmd);
        cmd = [];
      } else if (tok === '(') {
        const sub = parse();
        if (toks[pos] !== ')') throw new TemplateError('unclosed left paren');
        pos++;
        cmd.push({ t: 'sub', pipe: sub });
      } else cmd.push(term(tok));
    }
    cmds.push(cmd);
    if (cmds.some((c) => c.length === 0)) throw new TemplateError(`missing value for command in "${src}"`);
    return { cmds };
  };
  const p = parse();
  return { ...p, decl };
}

function term(tok: string): Term {
  if (tok.startsWith('"')) return { t: 'lit', v: JSON.parse(tok) };
  if (tok.startsWith('`')) return { t: 'lit', v: tok.slice(1, -1) };
  if (/^-?\d+$/.test(tok)) return { t: 'lit', v: new GoInt(Number(tok)) };
  if (/^-?\d*\.\d+$/.test(tok)) return { t: 'lit', v: Number(tok) };
  if (tok === 'true' || tok === 'false') return { t: 'lit', v: tok === 'true' };
  if (tok === 'nil') return { t: 'lit', v: null };
  if (tok === '.') return { t: 'field', base: 'dot', path: [] };
  if (tok.startsWith('.')) return { t: 'field', base: 'dot', path: tok.slice(1).split('.') };
  if (tok.startsWith('$')) {
    const [name, ...path] = tok.split('.');
    return { t: 'field', base: name, path };
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) return { t: 'ident', name: tok };
  throw new TemplateError(`unexpected "${tok}" in operand`);
}

// ---------------------------------------------------------------------------
// Árvore
// ---------------------------------------------------------------------------

type Node =
  | { t: 'text'; v: string }
  | { t: 'out'; pipe: Pipeline; line: number }
  | { t: 'if'; branches: { cond: Pipeline; body: Node[] }[]; els?: Node[]; line: number }
  | { t: 'range'; pipe: Pipeline; body: Node[]; els?: Node[]; line: number }
  | { t: 'with'; pipe: Pipeline; body: Node[]; els?: Node[]; line: number }
  | { t: 'template'; name: string; pipe?: Pipeline; line: number };

function parseTree(toks: Tok[], defines: Map<string, Node[]>): Node[] {
  let i = 0;
  const block = (terminators: string[]): { nodes: Node[]; end: string } => {
    const nodes: Node[] = [];
    while (i < toks.length) {
      const tok = toks[i++];
      if (tok.kind === 'text') {
        nodes.push({ t: 'text', v: tok.text });
        continue;
      }
      const s = tok.src;
      const kw = s.split(/\s+/)[0];
      if (terminators.includes(kw) || (kw === 'else' && terminators.includes('else'))) return { nodes, end: s };
      const line = tok.line;
      try {
        if (kw === 'if') {
          const branches = [{ cond: parsePipeline(s.slice(2)), body: [] as Node[] }];
          let els: Node[] | undefined;
          for (;;) {
            const r = block(['else', 'end']);
            if (els) {
              els = r.nodes;
            } else branches[branches.length - 1].body = r.nodes;
            if (r.end === 'end') break;
            if (/^else\s+if\s/.test(r.end)) branches.push({ cond: parsePipeline(r.end.replace(/^else\s+if/, '')), body: [] });
            else els = [];
            if (els && r.end === 'else') {
              const r2 = block(['end']);
              els = r2.nodes;
              break;
            }
          }
          nodes.push({ t: 'if', branches, els, line });
        } else if (kw === 'range' || kw === 'with') {
          const pipe = parsePipeline(s.slice(kw.length));
          const r = block(['else', 'end']);
          let els: Node[] | undefined;
          if (r.end !== 'end') els = block(['end']).nodes;
          nodes.push({ t: kw, pipe, body: r.nodes, els, line } as Node);
        } else if (kw === 'define') {
          const name = JSON.parse(s.slice(6).trim());
          defines.set(name, block(['end']).nodes);
        } else if (kw === 'template' || kw === 'block') {
          const rest = s.slice(kw.length).trim();
          const m = rest.match(/^"([^"]+)"\s*(.*)$/);
          if (!m) throw new TemplateError('template: nome inválido');
          nodes.push({ t: 'template', name: m[1], pipe: m[2] ? parsePipeline(m[2]) : undefined, line });
        } else if (kw === 'end' || kw === 'else') {
          throw new TemplateError(`unexpected {{${kw}}}`);
        } else nodes.push({ t: 'out', pipe: parsePipeline(s), line });
      } catch (e) {
        if (e instanceof TemplateError && e.line === undefined) e.line = line;
        throw e;
      }
    }
    if (terminators.length) throw new TemplateError(`unexpected EOF (faltou {{ end }})`);
    return { nodes, end: '' };
  };
  return block([]).nodes;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

export const truthy = (v: Val): boolean => {
  if (v === undefined || v === null || v === false || v === '') return false;
  if (v instanceof GoInt) return v.n !== 0;
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (isMap(v)) return Object.keys(v).length > 0;
  return true;
};

const str = (v: Val) => (v === undefined || v === null ? '' : goPrint(v));
const num = (v: Val) => (v instanceof GoInt ? v.n : typeof v === 'number' ? v : Number(v));

interface Scope {
  vars: Map<string, Val>;
}

export interface RenderContext {
  Values: Val;
  Release: Record<string, Val>;
  Chart: Record<string, Val>;
  Capabilities?: Record<string, Val>;
  Template?: Record<string, Val>;
}

export class Engine {
  defines = new Map<string, Node[]>();
  private trees = new Map<string, Node[]>();
  private currentFile = '';

  add(name: string, src: string) {
    try {
      this.trees.set(name, parseTree(lex(src), this.defines));
    } catch (e) {
      if (e instanceof TemplateError) throw new TemplateError(`template: ${name}:${e.line ?? 1}: ${e.message}`, e.line);
      throw e;
    }
  }

  render(name: string, root: RenderContext): string {
    const tree = this.trees.get(name);
    if (!tree) throw new TemplateError(`template ${name} não encontrado`);
    this.currentFile = name;
    const scope: Scope = { vars: new Map([['$', root as unknown as Val]]) };
    return this.exec(tree, root as unknown as Val, scope).replaceAll('<no value>', '');
  }

  private exec(nodes: Node[], dot: Val, scope: Scope): string {
    let out = '';
    for (const n of nodes) {
      try {
        out += this.node(n, dot, scope);
      } catch (e) {
        if (e instanceof TemplateError && e.line === undefined && 'line' in n) {
          e.line = n.line;
          e.message = e.exec
            ? `execution error at (${this.currentFile}:${n.line}): ${e.message}`
            : `template: ${this.currentFile}:${n.line}: ${e.message}`;
        }
        throw e;
      }
    }
    return out;
  }

  private node(n: Node, dot: Val, scope: Scope): string {
    switch (n.t) {
      case 'text':
        return n.v;
      case 'out': {
        const v = this.pipe(n.pipe, dot, scope);
        return n.pipe.decl ? '' : v === undefined ? '<no value>' : goPrint(v);
      }
      case 'if': {
        for (const b of n.branches) if (truthy(this.pipe(b.cond, dot, scope))) return this.exec(b.body, dot, this.child(scope));
        return n.els ? this.exec(n.els, dot, this.child(scope)) : '';
      }
      case 'with': {
        const v = this.pipe(n.pipe, dot, scope);
        if (truthy(v)) return this.exec(n.body, v, this.child(scope));
        return n.els ? this.exec(n.els, dot, this.child(scope)) : '';
      }
      case 'range': {
        const v = this.pipe({ cmds: n.pipe.cmds }, dot, scope);
        const entries: [Val, Val][] = Array.isArray(v)
          ? v.map((x, i) => [new GoInt(i), x])
          : isMap(v)
            ? Object.keys(v)
                .sort()
                .map((k) => [k, v[k]])
            : v instanceof GoInt
              ? Array.from({ length: v.n }, (_, i) => [new GoInt(i), new GoInt(i)])
              : [];
        if (!entries.length) return n.els ? this.exec(n.els, dot, this.child(scope)) : '';
        const names = n.pipe.decl?.names ?? [];
        return entries
          .map(([k, x]) => {
            const s = this.child(scope);
            if (names.length === 1) s.vars.set(names[0], x);
            if (names.length === 2) {
              s.vars.set(names[0], k);
              s.vars.set(names[1], x);
            }
            return this.exec(n.body, x, s);
          })
          .join('');
      }
      case 'template': {
        const body = this.defines.get(n.name);
        if (!body) throw new TemplateError(`no template "${n.name}" associated with template`);
        const data = n.pipe ? this.pipe(n.pipe, dot, scope) : null;
        return this.exec(body, data, { vars: new Map([['$', data]]) });
      }
    }
  }

  private child(scope: Scope): Scope {
    return { vars: new Map(scope.vars) };
  }

  private pipe(p: Pipeline, dot: Val, scope: Scope): Val {
    let value: Val = undefined;
    p.cmds.forEach((cmd, i) => {
      value = this.command(cmd, dot, scope, i > 0 ? { v: value } : undefined);
    });
    if (p.decl) {
      for (const name of p.decl.names) {
        if (!p.decl.define && !scope.vars.has(name)) throw new TemplateError(`undefined variable: ${name}`);
        scope.vars.set(name, value);
      }
    }
    return value;
  }

  private command(cmd: Command, dot: Val, scope: Scope, piped?: { v: Val }): Val {
    const [head, ...rest] = cmd;
    if (head.t === 'ident') {
      if (head.name === 'and' || head.name === 'or') {
        if (!rest.length && !piped) throw new TemplateError(`wrong number of args for ${head.name}`);
        let value: Val;
        for (const term of rest) {
          value = this.term(term, dot, scope);
          if (truthy(value) === (head.name === 'or')) return value;
        }
        return piped ? piped.v : value;
      }
      const args = rest.map((a) => this.term(a, dot, scope));
      if (piped) args.push(piped.v);
      return this.call(head.name, args, dot);
    }
    if (rest.length || piped) throw new TemplateError(`can't give argument to non-function ${this.describe(head)}`);
    return this.term(head, dot, scope);
  }

  private describe(t: Term) {
    return t.t === 'field' ? (t.base === 'dot' ? '.' : t.base) + t.path.map((p) => `.${p}`).join('') : 'operand';
  }

  private term(t: Term, dot: Val, scope: Scope): Val {
    if (t.t === 'lit') return t.v;
    if (t.t === 'sub') return this.pipe(t.pipe, dot, scope);
    if (t.t === 'ident') return this.call(t.name, [], dot);
    let cur: Val;
    if (t.base === 'dot') cur = dot;
    else {
      if (!scope.vars.has(t.base)) throw new TemplateError(`undefined variable "${t.base}"`);
      cur = scope.vars.get(t.base);
    }
    for (const key of t.path) {
      if (cur === undefined || cur === null) throw new TemplateError(`nil pointer evaluating interface {}.${key}`);
      if (!isMap(cur)) throw new TemplateError(`can't evaluate field ${key} in type ${Array.isArray(cur) ? '[]interface {}' : typeof cur}`);
      cur = Object.prototype.hasOwnProperty.call(cur, key) ? cur[key] : undefined;
    }
    return cur;
  }

  private call(name: string, a: Val[], dot: Val): Val {
    const need = (n: number) => {
      if (a.length < n) throw new TemplateError(`wrong number of args for ${name}: want ${n} got ${a.length}`);
    };
    switch (name) {
      case 'default':
        need(1);
        return a.length < 2 || !truthy(a[1]) ? a[0] : a[1];
      case 'required':
        need(2);
        if (a[1] === undefined || a[1] === null || a[1] === '') throw new TemplateError(str(a[0]), undefined, true);
        return a[1];
      case 'fail':
        throw new TemplateError(str(a[0]), undefined, true);
      case 'quote':
        return a.filter((x) => x !== null && x !== undefined).map((x) => JSON.stringify(str(x))).join(' ');
      case 'squote':
        return a.map((x) => `'${str(x)}'`).join(' ');
      case 'upper':
        return str(a[0]).toUpperCase();
      case 'lower':
        return str(a[0]).toLowerCase();
      case 'title':
        return str(a[0]).replace(/\b\w/g, (c) => c.toUpperCase());
      case 'trim':
        return str(a[0]).trim();
      case 'trunc': {
        need(2);
        const n = num(a[0]);
        const s = str(a[1]);
        return n >= 0 ? s.slice(0, n) : s.slice(Math.max(0, s.length + n));
      }
      case 'trimSuffix':
        need(2);
        return str(a[1]).endsWith(str(a[0])) ? str(a[1]).slice(0, -str(a[0]).length || undefined) : str(a[1]);
      case 'trimPrefix':
        need(2);
        return str(a[1]).startsWith(str(a[0])) ? str(a[1]).slice(str(a[0]).length) : str(a[1]);
      case 'replace':
        need(3);
        return str(a[2]).split(str(a[0])).join(str(a[1]));
      case 'contains':
        need(2);
        return str(a[1]).includes(str(a[0]));
      case 'hasPrefix':
        return str(a[1]).startsWith(str(a[0]));
      case 'hasSuffix':
        return str(a[1]).endsWith(str(a[0]));
      case 'indent':
      case 'nindent': {
        need(2);
        const pad = ' '.repeat(num(a[0]));
        const body = pad + str(a[1]).replaceAll('\n', `\n${pad}`);
        return name === 'nindent' ? `\n${body}` : body;
      }
      case 'toYaml':
        return a[0] === undefined || a[0] === null ? 'null' : YAML.stringify(toPlain(a[0])).replace(/\n$/, '');
      case 'toJson':
        return JSON.stringify(toPlain(a[0]));
      case 'b64enc':
        return btoa(unescape(encodeURIComponent(str(a[0]))));
      case 'sha256sum':
        return sha256(str(a[0]));
      case 'printf':
        return sprintf(str(a[0]), a.slice(1));
      case 'print':
        return a.map(str).join('');
      case 'toString':
        return str(a[0]);
      case 'int':
        return new GoInt(Math.trunc(num(a[0])));
      case 'len':
        return new GoInt(Array.isArray(a[0]) ? a[0].length : isMap(a[0]) ? Object.keys(a[0]).length : str(a[0]).length);
      case 'empty':
        return !truthy(a[0]);
      case 'not':
        return !truthy(a[0]);
      case 'and':
        return a.find((x) => !truthy(x)) ?? a[a.length - 1];
      case 'or':
        return a.find((x) => truthy(x)) ?? a[a.length - 1];
      case 'eq':
        need(2);
        return a.slice(1).some((x) => same(a[0], x));
      case 'ne':
        return !same(a[0], a[1]);
      case 'lt':
        return num(a[0]) < num(a[1]);
      case 'le':
        return num(a[0]) <= num(a[1]);
      case 'gt':
        return num(a[0]) > num(a[1]);
      case 'ge':
        return num(a[0]) >= num(a[1]);
      case 'ternary':
        return truthy(a[2]) ? a[0] : a[1];
      case 'coalesce':
        return a.find(truthy) ?? null;
      case 'list':
        return a;
      case 'dict': {
        const d: Record<string, Val> = {};
        for (let i = 0; i + 1 < a.length; i += 2) d[str(a[i])] = a[i + 1];
        return d;
      }
      case 'join':
        return Array.isArray(a[1]) ? a[1].map(str).join(str(a[0])) : str(a[1]);
      case 'include': {
        need(2);
        const body = this.defines.get(str(a[0]));
        if (!body) throw new TemplateError(`error calling include: template: no template "${str(a[0])}" associated with template`);
        return this.exec(body, a[1], { vars: new Map([['$', a[1]]]) });
      }
      case 'tpl': {
        need(2);
        const sub = new Engine();
        sub.defines = this.defines;
        sub.add('tpl', str(a[0]));
        return sub.render('tpl', a[1] as unknown as RenderContext);
      }
      default:
        throw new TemplateError(`function "${name}" not defined`);
    }
    void dot;
  }
}

function same(x: Val, y: Val) {
  const nx = x instanceof GoInt || typeof x === 'number';
  const ny = y instanceof GoInt || typeof y === 'number';
  if (nx && ny) return num(x) === num(y);
  return x === y;
}

/** printf do Go para %s, %d, %v, %q e %%: %d com float64 imprime %!d(float64=...), como no Go. */
function sprintf(fmt: string, args: Val[]): string {
  let i = 0;
  return fmt.replace(/%([sdvq%])/g, (_, verb) => {
    if (verb === '%') return '%';
    const v = args[i++];
    if (v === undefined) return `%!${verb}(MISSING)`;
    if (verb === 'd') {
      if (v instanceof GoInt) return String(v.n);
      return `%!d(${typeof v === 'number' ? 'float64' : typeof v}=${goPrint(v)})`;
    }
    if (verb === 'q') return JSON.stringify(str(v));
    return goPrint(v);
  });
}

function toPlain(v: Val): unknown {
  if (v instanceof GoInt) return v.n;
  if (Array.isArray(v)) return v.map(toPlain);
  if (isMap(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]));
  return v;
}

export interface ChartFile {
  name: string;
  src: string;
}

export interface RenderResult {
  outputs: { name: string; text: string; yamlError?: string }[];
  error?: string;
}

/** Renderiza como "helm template": arquivos que começam com _ só fornecem defines. */
export function renderChart(files: ChartFile[], ctx: RenderContext): RenderResult {
  const engine = new Engine();
  try {
    for (const f of files) engine.add(f.name, f.src);
    const outputs = files
      .filter((f) => !f.name.split('/').pop()!.startsWith('_'))
      .map((f) => {
        const text = engine.render(f.name, { ...ctx, Template: { Name: f.name, BasePath: 'templates' } });
        let yamlError: string | undefined;
        try {
          for (const doc of YAML.parseAllDocuments(text)) if (doc.errors.length) throw doc.errors[0];
        } catch (e) {
          yamlError = `YAML parse error on ${f.name}: ${(e as Error).message.split('\n')[0]}`;
        }
        return { name: f.name, text, yamlError };
      });
    return { outputs };
  } catch (e) {
    return { outputs: [], error: `Error: ${(e as Error).message}` };
  }
}

/** Converte números do YAML para float64 (como o Helm), mantendo o resto. */
export function parseValuesYaml(src: string): Val {
  const parsed = YAML.parse(src, { intAsBigInt: false, version: '1.1' });
  return (parsed ?? {}) as Val;
}
