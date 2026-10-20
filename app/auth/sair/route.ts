import { redirecionar } from '@/lib/redirecionar';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return redirecionar('/entrar');
}
