// Aceita a chave "publishable" (projetos novos) ou a "anon" (projetos antigos).
// O URL fica só com protocolo e domínio: ignora barras ou caminhos colados a mais (ex.: ".../rest/v1/").
function origem(url: string | undefined) {
  const s = (url || '').trim();
  try { return new URL(s).origin; } catch { return s; }
}
export const SUPABASE_URL = origem(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
