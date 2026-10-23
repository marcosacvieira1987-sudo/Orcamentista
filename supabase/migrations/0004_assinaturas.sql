-- Subscrições (Stripe). Seguro de repetir: pode colar tudo no SQL Editor do Supabase e correr.
-- Cada conta tem uma linha: período experimental e o estado da subscrição, que só o servidor altera
-- (webhook do Stripe com a chave secreta). O utilizador só consegue ler a sua.

create table if not exists public.assinaturas (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  experimental_ate    timestamptz not null default now() + interval '14 days',
  plano               text check (plano in ('pro', 'premium')),
  estado              text not null default '',   -- estado da subscrição no Stripe (active, past_due, canceled…)
  periodo_fim         timestamptz,
  cancela_no_fim      boolean not null default false,
  stripe_customer     text unique,
  stripe_subscription text unique,
  atualizado_em       timestamptz not null default now()
);

alter table public.assinaturas enable row level security;
drop policy if exists "assinatura: ler a sua" on public.assinaturas;
create policy "assinatura: ler a sua" on public.assinaturas for select using ((select auth.uid()) = user_id);
-- sem políticas de inserir, alterar ou apagar: ninguém muda o próprio plano a partir do browser

-- contas novas: 14 dias de experiência com tudo incluído
create or replace function public.criar_assinatura() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assinaturas (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_utilizador_assinatura on auth.users;
create trigger ao_criar_utilizador_assinatura after insert on auth.users for each row execute function public.criar_assinatura();

-- contas que já existiam: 30 dias de aviso antes de precisarem de subscrição
insert into public.assinaturas (user_id, experimental_ate)
select id, now() + interval '30 days' from auth.users
on conflict (user_id) do nothing;

notify pgrst, 'reload schema';

select 'Subscrições prontas' as resultado;
