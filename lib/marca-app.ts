import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { corLegivel, textoSobre } from './cores';
import type { Acesso } from './plano';

export type MarcaApp = { cor: string; ink: string; logoUrl: string } | null;

// Espaço personalizado (Pro, Premium, experiência): o app usa o logótipo e a cor da marca.
// A cor é escurecida até se ler bem sobre branco (botões e ligações legíveis ao sol).
export async function marcaDaConta(sb: SupabaseClient, acesso: Acesso, emp: { cor?: string | null; logo_path?: string | null } | null): Promise<MarcaApp> {
  if (!acesso.marca || !emp) return null;
  const cor = corLegivel(/^#[0-9a-f]{6}$/i.test(emp.cor || '') ? emp.cor! : '#2B2A28');
  let logoUrl = '';
  if (emp.logo_path) {
    const { data } = await sb.storage.from('logos').createSignedUrl(emp.logo_path, 3600);
    logoUrl = data?.signedUrl || '';
  }
  return { cor, ink: textoSobre(cor), logoUrl };
}
