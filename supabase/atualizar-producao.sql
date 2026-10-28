-- Atualização da base de dados de produção: migrações 0002 a 0008 numa só vez.
-- Seguro de repetir: o que já existir fica como está.
-- Supabase → SQL Editor → New query → colar tudo → Run.

-- ============ 0002: proposta completa, numeração e custo da IA ============
alter table public.empresas
  add column if not exists slogan          text not null default '',
  add column if not exists assinante       text not null default '',
  add column if not exists banco           text not null default '',
  add column if not exists iban            text not null default '',
  add column if not exists bic             text not null default '',
  add column if not exists seguro_apolice  text not null default '',
  add column if not exists seguro_validade text not null default '',
  add column if not exists garantia_texto  text not null default '',
  add column if not exists pag_adjudicacao numeric(5,2) not null default 20 check (pag_adjudicacao between 0 and 100),
  add column if not exists pag_inicio      numeric(5,2) not null default 40 check (pag_inicio between 0 and 100),
  add column if not exists pag_conclusao   numeric(5,2) not null default 40 check (pag_conclusao between 0 and 100),
  add column if not exists modelo          text not null default 'completo' check (modelo in ('rapido', 'completo')),
  add column if not exists mostrar_precos  text not null default 'capitulo' check (mostrar_precos in ('capitulo', 'detalhado')),
  add column if not exists prefixo         text not null default '',
  add column if not exists proximo_numero  integer not null default 1 check (proximo_numero > 0);

create or replace function public.proximo_numero_proposta() returns text
language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
  pre text;
  nom text;
begin
  update public.empresas
     set proximo_numero = proximo_numero + 1
   where user_id = auth.uid()
  returning proximo_numero - 1, prefixo, nome into n, pre, nom;
  if n is null then return null; end if;
  if coalesce(trim(pre), '') = '' then
    pre := upper(left(regexp_replace(split_part(trim(coalesce(nom, '')), ' ', 1), '[^A-Za-z0-9]', '', 'g'), 6));
    if pre = '' then pre := 'P'; end if;
  end if;
  return format('%s-%s-%s', upper(trim(pre)), to_char(now(), 'YYYY'), lpad(n::text, 3, '0'));
end $$;

alter table public.uso_ia
  add column if not exists orcamento_id uuid references public.orcamentos (id) on delete set null,
  add column if not exists tokens_in    integer not null default 0,
  add column if not exists tokens_out   integer not null default 0,
  add column if not exists custo_usd    numeric(10,4) not null default 0;
create index if not exists uso_ia_orcamento on public.uso_ia (orcamento_id);

-- ============ 0003: PDFs enviados por link (WhatsApp, email) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propostas', 'propostas', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "propostas: ler as suas" on storage.objects;
drop policy if exists "propostas: carregar as suas" on storage.objects;
drop policy if exists "propostas: substituir as suas" on storage.objects;
drop policy if exists "propostas: apagar as suas" on storage.objects;
create policy "propostas: ler as suas" on storage.objects for select
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: carregar as suas" on storage.objects for insert
  with check (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: substituir as suas" on storage.objects for update
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: apagar as suas" on storage.objects for delete
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- a API passa a ver as colunas novas de imediato
notify pgrst, 'reload schema';

-- ============ 0004: subscrições e período experimental ============
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

-- ============ 0005: planos, lançamento e garantia ============
-- Plano Essencial, pagamento mensal ou anual, preço de lançamento e garantia de 30 dias.
-- Seguro de repetir: pode colar tudo no SQL Editor do Supabase e correr.

alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas add constraint assinaturas_plano_check check (plano in ('essencial', 'pro', 'premium'));

alter table public.assinaturas
  add column if not exists periodo         text check (periodo in ('mensal', 'anual')),
  add column if not exists lancamento      boolean not null default false,  -- comprou ao preço de lançamento
  add column if not exists primeira_compra timestamptz;                      -- garantia de 30 dias só na primeira compra

-- ============ 0006: espaço personalizado e página da proposta ============
-- Espaço personalizado: cores e textos da marca, modelo de apresentação e página da proposta para o cliente.
-- Seguro de repetir: pode colar tudo no SQL Editor do Supabase e correr.

alter table public.empresas
  add column if not exists cor2           text  not null default '',          -- cor secundária (tirada do logótipo)
  add column if not exists estilo         text  not null default 'classico',  -- modelo de apresentação
  add column if not exists apresentacao   text  not null default '',          -- "Sobre a empresa"
  add column if not exists condicoes_texto text not null default '',          -- condições gerais
  add column if not exists questionario   jsonb not null default '{}'::jsonb; -- respostas usadas para escrever os textos

-- cor por omissão das contas novas: grafite neutro (antes era o azul do protótipo)
alter table public.empresas alter column cor set default '#2B2A28';

alter table public.empresas drop constraint if exists empresas_estilo_check;
alter table public.empresas add constraint empresas_estilo_check check (estilo in ('classico', 'moderno', 'sobrio'));

-- Página da proposta que o cliente abre (uma por orçamento). Guarda uma cópia do que foi enviado,
-- para o cliente ver e aceitar essa versão, mesmo que o orçamento seja alterado depois.
create table if not exists public.propostas (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique check (length(token) >= 32),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  orcamento_id uuid not null unique references public.orcamentos (id) on delete cascade,
  dados        jsonb not null,
  pdf_path     text,
  publicada_em timestamptz not null default now(),
  vista_em     timestamptz,                     -- primeira vez que o cliente abriu
  vistas       integer not null default 0,
  aceite_nome  text,
  aceite_em    timestamptz,
  aceite_nota  text
);
create index if not exists propostas_user on public.propostas (user_id);

alter table public.propostas enable row level security;
drop policy if exists "propostas: ler as suas" on public.propostas;
drop policy if exists "propostas: publicar" on public.propostas;
drop policy if exists "propostas: atualizar" on public.propostas;
drop policy if exists "propostas: apagar" on public.propostas;
create policy "propostas: ler as suas" on public.propostas for select using ((select auth.uid()) = user_id);
create policy "propostas: publicar" on public.propostas for insert with check ((select auth.uid()) = user_id);
create policy "propostas: atualizar" on public.propostas for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propostas: apagar" on public.propostas for delete using ((select auth.uid()) = user_id);
-- O cliente não tem conta: a página e o "Aceitar" passam pelo servidor, que procura a proposta pelo token.

-- ============ 0007: só se publica a proposta de um orçamento da própria conta ============
-- Só se publica a página de uma proposta de um orçamento da própria conta.
-- Seguro de repetir.
drop policy if exists "propostas: publicar" on public.propostas;
drop policy if exists "propostas: atualizar" on public.propostas;
create policy "propostas: publicar" on public.propostas for insert
  with check ((select auth.uid()) = user_id and exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = (select auth.uid())));
create policy "propostas: atualizar" on public.propostas for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = (select auth.uid())));

-- ============ 0008: limite diário da IA reservado antes de cada chamada ============
-- Reserva um pedido se o utilizador ainda estiver abaixo do limite; devolve o id da linha, ou null.
create or replace function public.reservar_uso_ia(p_user uuid, p_acao text, p_orcamento uuid, p_limite integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  orc uuid;
  novo bigint;
begin
  -- um pedido de cada vez por utilizador: o próximo espera até este terminar a transação
  perform pg_advisory_xact_lock(hashtextextended('uso_ia:' || p_user::text, 0));
  select count(*) into n from public.uso_ia
   where user_id = p_user and criado_em >= now() - interval '24 hours';
  if n >= p_limite then return null; end if;
  -- só liga ao orçamento se for do próprio utilizador
  select id into orc from public.orcamentos where id = p_orcamento and user_id = p_user;
  insert into public.uso_ia (user_id, acao, orcamento_id)
  values (p_user, left(coalesce(p_acao, ''), 20), orc)
  returning id into novo;
  return novo;
end $$;

-- Grava o consumo na linha reservada (só tokens e custo; não mexe na data nem no dono).
create or replace function public.registar_custo_uso_ia(p_id bigint, p_user uuid, p_tokens_in integer, p_tokens_out integer, p_custo_usd numeric)
returns void language sql security definer set search_path = '' as $$
  update public.uso_ia
     set tokens_in = greatest(coalesce(p_tokens_in, 0), 0),
         tokens_out = greatest(coalesce(p_tokens_out, 0), 0),
         custo_usd = greatest(coalesce(p_custo_usd, 0), 0)
   where id = p_id and user_id = p_user;
$$;

-- Só o servidor (chave secreta) as pode chamar; o browser não.
revoke all on function public.reservar_uso_ia(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.registar_custo_uso_ia(bigint, uuid, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.reservar_uso_ia(uuid, text, uuid, integer) to service_role;
grant execute on function public.registar_custo_uso_ia(bigint, uuid, integer, integer, numeric) to service_role;

-- a API passa a ver as colunas novas de imediato
notify pgrst, 'reload schema';

select 'Base de dados atualizada (0002 a 0008)' as resultado;
