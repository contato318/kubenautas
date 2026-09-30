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
export function mergeValues(base: Val, over: Val, preserveNull = false): Val {
  if (!isMap(base) || !isMap(over)) return clone(over);
  const out: Record<string, Val> = clone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v === null && !preserveNull) delete out[k];
    else if (isMap(v) && Object.prototype.hasOwnProperty.call(out, k) && isMap(out[k])) put(out, k, mergeValues(out[k], v, preserveNull));
    else put(out, k, clone(v));
  }
  return out;
}

// Go maps treat __proto__ and constructor as ordinary keys.
function put(obj: object, key: string | number, value: Val) {
  Object.defineProperty(obj, key, { value, writable: true, configurable: true, enumerable: true });
}

/** User overrides are assembled first, then chart defaults are coalesced. */
export function coalesceValues(defaults: Val, user: Val): Val {
  if (!isMap(defaults) || !isMap(user)) return clone(user);
  const out = clone(user);
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) put(out, key, clone(value));
    else if (out[key] === null) delete out[key];
    else if (isMap(value) && isMap(out[key])) put(out, key, coalesceValues(value, out[key]));
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
      cur += '\\' + s[++i];
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
  let part = '';
  for (let i = 0; i < key.length; i++) {
    const ch = key[i];
    if (ch === '\\' && i + 1 < key.length) part += key[++i];
    else if (ch === '.') {
      if (part) { path.push(part); part = ''; }
      else if (key[i - 1] !== ']') throw new Error(`chave inválida: ${key}`);
    } else if (ch === '[') {
      if (part) { path.push(part); part = ''; }
      const end = key.indexOf(']', i);
      const index = key.slice(i + 1, end);
      if (end < 0 || !/^\d+$/.test(index) || Number(index) > 65536) throw new Error(`índice inválido: ${key}`);
      path.push(Number(index));
      i = end;
    } else part += ch;
  }
  if (part) path.push(part);
  if (!path.length || typeof path[0] !== 'string' || key.endsWith('.')) throw new Error(`chave inválida: ${key}`);
  return path;
}

const unescape = (s: string) => s.replace(/\\(.)/g, '$1');

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
          ? splitUnescaped(raw.slice(1, -1), ',')
              .filter((x) => x !== '')
              .map((x) => typedVal(unescape(x), asString))
          : typedVal(unescape(raw), asString);
      return { path, value };
    });
}

export function applySet(values: Val, entry: SetEntry, preserveNull = false): Val {
  const root: Val = isMap(values) ? clone(values) : {};
  let cur: any = root;
  entry.path.forEach((seg, i) => {
    const last = i === entry.path.length - 1;
    if (last) {
      if (entry.value === null && isMap(cur) && !preserveNull) delete cur[seg as string];
      else put(cur, seg, entry.value);
      return;
    }
    const nextIsIndex = typeof entry.path[i + 1] === 'number';
    if (!Object.prototype.hasOwnProperty.call(cur, seg) || cur[seg] === null || typeof cur[seg] !== 'object') put(cur, seg, nextIsIndex ? [] : {});
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
