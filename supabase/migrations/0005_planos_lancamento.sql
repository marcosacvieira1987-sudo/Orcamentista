-- Plano Essencial, pagamento mensal ou anual, preço de lançamento e garantia de 30 dias.
-- Seguro de repetir: pode colar tudo no SQL Editor do Supabase e correr.

alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas add constraint assinaturas_plano_check check (plano in ('essencial', 'pro', 'premium'));

alter table public.assinaturas
  add column if not exists periodo         text check (periodo in ('mensal', 'anual')),
  add column if not exists lancamento      boolean not null default false,  -- comprou ao preço de lançamento
  add column if not exists primeira_compra timestamptz;                      -- garantia de 30 dias só na primeira compra

notify pgrst, 'reload schema';

select 'Planos e lançamento prontos' as resultado;
