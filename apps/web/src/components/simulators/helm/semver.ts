/**
 * Restrições de versão no estilo Masterminds/semver (usado pelo Helm em dependencies e --version):
 * =, !=, >, <, >=, <=, ~ (patch), ^ (compatível), curingas x/X/* , intervalos "a - b",
 * E com espaço ou vírgula, OU com "||". Versões prerelease só casam se a restrição também tiver prerelease.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
  pre: string[];
  raw: string;
}

export function parseVersion(raw: string): Version | null {
  const m = raw.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [], raw: raw.trim() };
}

export function compare(a: Version, b: Version): number {
  for (const k of ['major', 'minor', 'patch'] as const) if (a[k] !== b[k]) return a[k] - b[k];
  if (!a.pre.length && !b.pre.length) return 0;
  if (!a.pre.length) return 1;
  if (!b.pre.length) return -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny && +x !== +y) return +x - +y;
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

type Op = '=' | '!=' | '>' | '<' | '>=' | '<=';
interface Clause {
  op: Op;
  v: Version;
}

const v = (major: number, minor: number, patch: number, pre: string[] = []): Version => ({ major, minor, patch, pre, raw: `${major}.${minor}.${patch}` });

/** Expande um termo ("^1.2", "~1.2.3", "1.x", ">=2.0.0-0") em cláusulas simples. */
function expand(term: string): Clause[] {
  const m = term.match(/^(\^|~>?|!=|>=|<=|>|<|=)?\s*v?([0-9xX*]+)(?:\.([0-9xX*]+))?(?:\.([0-9xX*]+))?(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) throw new Error(`restrição inválida: "${term}"`);
  const [, rawOp = '', a, b, c, preRaw] = m;
  const wild = (s?: string) => s === undefined || /^[xX*]$/.test(s);
  const pre = preRaw ? preRaw.split('.') : [];
  const M = wild(a) ? null : +a;
  const mi = wild(b) ? null : +b!;
  const p = wild(c) ? null : +c!;
  const op = rawOp === '~>' ? '~' : rawOp;

  if (M === null) return op === '!=' || op === '<' ? [{ op: '<', v: v(0, 0, 0) }] : [{ op: '>=', v: v(0, 0, 0) }];
  const base = v(M, mi ?? 0, p ?? 0, pre);

  if (op === '^') {
    if (M > 0 || mi === null) return [{ op: '>=', v: base }, { op: '<', v: v(M + 1, 0, 0) }];
    if (mi > 0 || p === null) return [{ op: '>=', v: base }, { op: '<', v: v(0, mi + 1, 0) }];
    return [{ op: '>=', v: base }, { op: '<', v: v(0, 0, p + 1) }];
  }
  if (op === '~') {
    return mi === null ? [{ op: '>=', v: base }, { op: '<', v: v(M + 1, 0, 0) }] : [{ op: '>=', v: base }, { op: '<', v: v(M, mi + 1, 0) }];
  }
  const partial = mi === null || p === null;
  const upper = mi === null ? v(M + 1, 0, 0) : v(M, mi + 1, 0);
  if (op === '' || op === '=') return partial ? [{ op: '>=', v: base }, { op: '<', v: upper }] : [{ op: '=', v: base }];
  if (op === '!=') return partial ? [{ op: '<', v: base }, { op: '>=', v: upper }] : [{ op: '!=', v: base }];
  if (op === '>') return partial ? [{ op: '>=', v: upper }] : [{ op: '>', v: base }];
  if (op === '<=') return partial ? [{ op: '<', v: upper }] : [{ op: '<=', v: base }];
  return [{ op: op as Op, v: base }];
}

const test = (x: Version, c: Clause) => {
  const r = compare(x, c.v);
  return { '=': r === 0, '!=': r !== 0, '>': r > 0, '<': r < 0, '>=': r >= 0, '<=': r <= 0 }[c.op];
};

export interface Constraint {
  groups: { clauses: Clause[]; hasPre: boolean }[];
  /** forma expandida, para exibir */
  expanded: string;
}

export function parseConstraint(input: string): Constraint {
  const groups = input.split('||').map((g) => {
    const normalized = g.trim().replace(/(\S+)\s+-\s+(\S+)/g, '>=$1 <=$2').replace(/,/g, ' ');
    const terms = normalized.split(/\s+/).filter(Boolean);
    // junta operadores separados do número por espaço (">= 1.2")
    const merged: string[] = [];
    for (const t of terms) {
      if (merged.length && /^(\^|~>?|!=|>=|<=|>|<|=)$/.test(merged[merged.length - 1])) merged[merged.length - 1] += t;
      else merged.push(t);
    }
    if (!merged.length) throw new Error('restrição vazia');
    const clauses = merged.flatMap(expand);
    return { clauses, hasPre: clauses.some((c) => c.v.pre.length > 0) };
  });
  const fmt = (c: Clause) => `${c.op}${c.v.major}.${c.v.minor}.${c.v.patch}${c.v.pre.length ? `-${c.v.pre.join('.')}` : ''}`;
  return { groups, expanded: groups.map((g) => g.clauses.map(fmt).join(' ')).join(' || ') };
}

export function satisfies(version: Version, c: Constraint): boolean {
  return c.groups.some((g) => (version.pre.length === 0 || g.hasPre) && g.clauses.every((cl) => test(version, cl)));
}

export function resolve(versions: string[], constraint: string) {
  const c = parseConstraint(constraint);
  const parsed = versions.map(parseVersion).filter((x): x is Version => x !== null);
  const matching = parsed.filter((x) => satisfies(x, c)).sort((a, b) => compare(b, a));
  return { constraint: c, matching, chosen: matching[0] ?? null };
}
