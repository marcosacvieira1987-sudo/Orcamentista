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

notify pgrst, 'reload schema';

select 'Espaço personalizado pronto' as resultado;
