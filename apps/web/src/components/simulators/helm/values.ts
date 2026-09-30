/**
 * Valores no estilo do Helm (Go):
 * - números vindos de YAML viram float64 (o Helm converte YAML → JSON → interface{});
 * - --set cria int64 para inteiros, bool para true/false, nil para null e string para o resto;
 * - o merge mescla mapas recursivamente, substitui listas e escalares, e null apaga a chave.
 */

/** Inteiro Go (int64), para diferenciar do float64 dos arquivos YAML. */
export class GoInt {
  constructor(public readonly n: number) {}
}

export type Val = null | undefined | boolean | number | string | GoInt | Val[] | { [k: string]: Val };

export const isMap = (v: unknown): v is Record<string, Val> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof GoInt);

/** strconv.FormatFloat(f, 'g', -1, 64): notação exponencial quando o expoente é < -4 ou >= 6. */
export function formatGoFloat(f: number): string {
  if (!Number.isFinite(f)) return f > 0 ? '+Inf' : f < 0 ? '-Inf' : 'NaN';
  if (f === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(f)));
  if (exp < -4 || exp >= 6) {
    const [mant, e] = f.toExponential().split('e');
    const n = Number(e);
    return `${mant}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
  }
  return String(f);
}

/** Como o Go text/template imprime um valor ({{ . }}). */
export function goPrint(v: Val): string {
  if (v === undefined || v === null) return '<no value>';
  if (v instanceof GoInt) return String(v.n);
  if (typeof v === 'number') return formatGoFloat(v);
  if (typeof v === 'boolean' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return `[${v.map(goPrint).join(' ')}]`;
  return `map[${Object.keys(v)
    .sort()
    .map((k) => `${k}:${goPrint(v[k])}`)
    .join(' ')}]`;
}

export function goType(v: Val): string {
  if (v === undefined || v === null) return 'nil';
  if (v instanceof GoInt) return 'int64';
  if (typeof v === 'number') return 'float64';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'string') return 'string';
  return Array.isArray(v) ? 'list' : 'map';
}

export function clone<T extends Val>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T;
  if (isMap(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) as T;
  return v;
}

/** Merge do Helm: override por cima de base. */
export function mergeValues(base: Val, over: Val): Val {
  if (!isMap(base) || !isMap(over)) return clone(over);
  const out: Record<string, Val> = clone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete out[k];
    else if (isMap(v) && isMap(out[k])) out[k] = mergeValues(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}

/** typedVal do pacote strvals do Helm. */
export function typedVal(raw: string, asString: boolean): Val {
  if (asString) return raw;
  const lower = raw.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return null;
  if (raw === '0') return new GoInt(0);
  if (/^-?[1-9]\d*$/.test(raw) && Math.abs(Number(raw)) <= Number.MAX_SAFE_INTEGER) return new GoInt(Number(raw));
  return raw;
}

export interface SetEntry {
  path: (string | number)[];
  value: Val;
}

function splitUnescaped(s: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      cur += s[++i];
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parsePath(key: string): (string | number)[] {
  const path: (string | number)[] = [];
  for (const part of splitUnescaped(key, '.')) {
    const m = part.match(/^([^[\]]*)((\[\d+\])*)$/);
    if (!m) throw new Error(`chave inválida: ${key}`);
    if (m[1]) path.push(m[1]);
    for (const idx of m[2].match(/\d+/g) ?? []) path.push(Number(idx));
  }
  return path;
}

/** Interpreta "a.b=1,c[0]=x,lista={a,b}" como o --set (ou --set-string) do Helm. */
export function parseSet(expr: string, asString = false): SetEntry[] {
  return splitUnescaped(expr, ',')
    .filter((p) => p.trim())
    .map((assignment) => {
      const eq = assignment.indexOf('=');
      if (eq === -1) throw new Error(`key "${assignment}" has no value`);
      const path = parsePath(assignment.slice(0, eq).trim());
      const raw = assignment.slice(eq + 1);
      const value =
        raw.startsWith('{') && raw.endsWith('}')
          ? raw
              .slice(1, -1)
              .split(',')
              .filter((x) => x !== '')
              .map((x) => typedVal(x, asString))
          : typedVal(raw, asString);
      return { path, value };
    });
}

export function applySet(values: Val, entry: SetEntry): Val {
  const root: Val = isMap(values) ? clone(values) : {};
  let cur: any = root;
  entry.path.forEach((seg, i) => {
    const last = i === entry.path.length - 1;
    if (last) {
      if (entry.value === null && isMap(cur)) delete cur[seg as string];
      else cur[seg] = entry.value;
      return;
    }
    const nextIsIndex = typeof entry.path[i + 1] === 'number';
    if (cur[seg] === undefined || cur[seg] === null || typeof cur[seg] !== 'object') cur[seg] = nextIsIndex ? [] : {};
    cur = cur[seg];
  });
  return root;
}

/** Folhas do mapa como caminho → valor (para exibir a origem de cada chave). */
export function leaves(v: Val, prefix = ''): [string, Val][] {
  if (isMap(v)) {
    const entries = Object.entries(v);
    if (entries.length === 0) return [[prefix, v]];
    return entries.flatMap(([k, x]) => leaves(x, prefix ? `${prefix}.${k}` : k));
  }
  return [[prefix, v]];
}
