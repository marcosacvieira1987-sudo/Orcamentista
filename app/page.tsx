import { redirect } from 'next/navigation';
import { utilizadorAtual } from '@/lib/supabase/server';

export default async function Inicio() {
  redirect((await utilizadorAtual()) ? '/orcamentos' : '/entrar');
}
