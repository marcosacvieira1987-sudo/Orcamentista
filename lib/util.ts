// Utilidades partilhadas (cliente e servidor), herdadas do protótipo.

export const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/\s/g, '').replace(/[€%a-zA-Z²³]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export const r2 = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const k = parseFloat((Math.abs(v) * 100).toFixed(6));
  return (Math.sign(v) * Math.round(k)) / 100;
};

export const fmtN = (n: number, d = 2): string => {
  const s = Math.abs(r2(n)).toFixed(d);
  const [i, f] = s.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (r2(n) < 0 ? '-' : '') + (f ? g + ',' + f : g);
};
export const fmtEUR = (n: number) => fmtN(n) + ' €';
export const fmtC = (n: number) => (Number.isInteger(r2(n)) ? fmtN(n, 0) : fmtN(n)) + ' €';
export const fmtQ = (n: number) => fmtN(n, Number.isInteger(r2(n)) ? 0 : 2);
export const fmtInput = (n: number | null | undefined | '') =>
  n === null || n === undefined || n === '' ? '' : String(r2(n)).replace('.', ',');
export const fmtPreco = (n: unknown) =>
  n === null || n === undefined || n === '' ? '' : r2(num(n)).toFixed(2).replace('.', ',');

export const pad = (n: number) => String(n).padStart(2, '0');
export const fmtData = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
export const isoHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const deIso = (s: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date();
};

let seq = 0;
export const uid = (p = 'L') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

export const arr = (v: unknown): unknown[] =>
  Array.isArray(v)
    ? v.filter((x) => x !== null && x !== undefined && String(typeof x === 'object' ? 'o' : x).trim() !== '')
    : [];
export const strs = (v: unknown): string[] =>
  arr(v)
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (typeof x === 'object' && x) {
        const o = x as Record<string, unknown>;
        return String(o.texto || o.descricao || o.nome || '');
      }
      return String(x);
    })
    .filter(Boolean);
export const uniq = (a: string[]) => [...new Set(a.map((s) => String(s).trim()))].filter(Boolean);

const UN: Record<string, string> = { m2: 'm²', 'm^2': 'm²', 'm²': 'm²', m3: 'm³', 'm^3': 'm³', 'm³': 'm³', ml: 'ml', un: 'un', und: 'un', vg: 'vg', h: 'h', kg: 'kg', m: 'm', l: 'l' };
export const un = (u: unknown) => UN[String(u || '').toLowerCase().trim()] || String(u || '');

export const norm = (s: unknown) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const iniciais = (nome: string) => {
  const ws = norm(nome).split(' ').filter(Boolean);
  return ws
    .filter((w) => w.length > 2 || ws.length < 3)
    .map((w) => w[0].toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('');
};

export const maiuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
