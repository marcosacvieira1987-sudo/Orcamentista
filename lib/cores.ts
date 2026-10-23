// Cores da marca: paleta tirada do logótipo (em código, sem IA) e contraste legível.

type RGB = [number, number, number];

export const hexParaRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as RGB;
};
export const rgbParaHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

function luminancia([r, g, b]: RGB) {
  const c = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contraste(a: string, b: string) {
  const la = luminancia(hexParaRgb(a)), lb = luminancia(hexParaRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const saturacao = ([r, g, b]: RGB) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };

// Escurece a cor até ter contraste suficiente com o fundo (texto e botões legíveis, também ao sol).
export function corLegivel(hex: string, fundo = '#FFFFFF', minimo = 4.5) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#1F3F8F';
  let rgb = hexParaRgb(hex);
  for (let i = 0; i < 40 && contraste(rgbParaHex(rgb), fundo) < minimo; i++) rgb = rgb.map((v) => v * 0.92) as RGB;
  return rgbParaHex(rgb);
}
// Texto por cima de uma cor: branco ou grafite, o que tiver mais contraste.
export const textoSobre = (hex: string) => (contraste(hex, '#FFFFFF') >= contraste(hex, '#101315') ? '#FFFFFF' : '#101315');

// Paleta dominante a partir dos píxeis (RGBA). Ignora transparência e fundos quase brancos;
// agrupa cores parecidas e devolve as mais presentes, com as cores vivas primeiro.
export function paletaDePixeis(px: ArrayLike<number>, max = 5): string[] {
  const grupos = new Map<string, { n: number; soma: [number, number, number] }>();
  for (let i = 0; i + 3 < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    const k = `${r >> 4},${g >> 4},${b >> 4}`;
    const x = grupos.get(k) || { n: 0, soma: [0, 0, 0] as [number, number, number] };
    x.n++; x.soma[0] += r; x.soma[1] += g; x.soma[2] += b;
    grupos.set(k, x);
  }
  const cores = [...grupos.values()].sort((a, b) => b.n - a.n).map((x) => ({ n: x.n, rgb: x.soma.map((v) => v / x.n) as RGB }));
  const finais: { n: number; rgb: RGB }[] = [];
  for (const c of cores) {
    const perto = finais.find((f) => Math.hypot(f.rgb[0] - c.rgb[0], f.rgb[1] - c.rgb[1], f.rgb[2] - c.rgb[2]) < 48);
    if (perto) perto.n += c.n; else finais.push({ ...c });
  }
  const total = finais.reduce((s, f) => s + f.n, 0) || 1;
  return finais
    .filter((f) => f.n / total > 0.02)
    .sort((a, b) => (b.n / total) * (0.4 + saturacao(b.rgb)) - (a.n / total) * (0.4 + saturacao(a.rgb)))
    .slice(0, max)
    .map((f) => rgbParaHex(f.rgb));
}

// Sugestão: principal = a cor mais presente que se lê sobre branco; secundária = a seguinte.
// Guarda-se a cor verdadeira; o app escurece-a só onde precisa de contraste (corLegivel).
export function sugerirCores(paleta: string[]) {
  if (!paleta.length) return { cor: '#1F3F8F', cor2: '' };
  const principal = paleta.find((c) => contraste(c, '#FFFFFF') >= 3) || paleta[0];
  const segunda = paleta.find((c) => c !== principal) || '';
  return { cor: principal, cor2: segunda };
}
