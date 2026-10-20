-- Prumo Orçamentista: esquema inicial.
-- Cada profissional só vê e altera os seus dados (RLS em todas as tabelas e nos ficheiros).

-- ============ empresa (1 por utilizador) ============
create table public.empresas (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nome         text not null default '',
  nif          text not null default '',
  telefone     text not null default '',
  email        text not null default '',
  site         text not null default '',
  morada       text not null default '',
  alvara       text not null default '',
  seguro       text not null default '',
  cor          text not null default '#1F3F8F' check (cor ~* '^#[0-9a-f]{6}$'),
  logo_path    text,
  iva          numeric(5,2) not null default 23 check (iva between 0 and 30),
  validade     integer not null default 30 check (validade between 1 and 365),
  imprevistos  numeric(5,2) not null default 0 check (imprevistos between 0 and 50),
  pagamento    text not null default '',
  prazo        text not null default '',
  garantia     text not null default '',
  nunca_inclui text not null default '',
  extras       text not null default '',
  rodape       boolean not null default true,
  -- preçário: [{ "descricao": text, "unidade": text, "preco": number | null }]
  precos       jsonb not null default '[]'::jsonb check (jsonb_typeof(precos) = 'array'),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============ orçamentos ============
create table public.orcamentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  estado        text not null default 'rascunho' check (estado in ('rascunho', 'aprovado')),
  numero        text not null default '',
  tipo          text not null default '',
  localidade    text not null default '',
  dono          text not null default '',
  total         numeric(12,2),
  -- estado completo do assistente (pedido, leitura, perguntas, medidas, orçamento, meta)
  dados         jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index orcamentos_user_atualizado on public.orcamentos (user_id, atualizado_em desc);

-- ============ registo de uso da IA (limite diário por utilizador) ============
create table public.uso_ia (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  acao      text not null,
  criado_em timestamptz not null default now()
);
create index uso_ia_user_criado on public.uso_ia (user_id, criado_em desc);

-- ============ atualizado_em automático ============
create function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger empresas_tocar before update on public.empresas for each row execute function public.tocar_atualizado();
create trigger orcamentos_tocar before update on public.orcamentos for each row execute function public.tocar_atualizado();

-- ============ empresa criada no registo ============
create function public.criar_empresa() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.empresas (user_id, nome) values (new.id, coalesce(new.raw_user_meta_data ->> 'empresa', ''));
  return new;
end $$;
create trigger ao_criar_utilizador after insert on auth.users for each row execute function public.criar_empresa();

-- ============ RLS ============
alter table public.empresas   enable row level security;
alter table public.orcamentos enable row level security;
alter table public.uso_ia     enable row level security;

create policy "empresa: ler a sua"     on public.empresas for select using ((select auth.uid()) = user_id);
create policy "empresa: alterar a sua" on public.empresas for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "orcamentos: ler os seus"   on public.orcamentos for select using ((select auth.uid()) = user_id);
create policy "orcamentos: criar"         on public.orcamentos for insert with check ((select auth.uid()) = user_id);
create policy "orcamentos: alterar"       on public.orcamentos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "orcamentos: apagar"        on public.orcamentos for delete using ((select auth.uid()) = user_id);

-- uso_ia: só ler e acrescentar (sem apagar, para o limite não poder ser contornado)
create policy "uso_ia: ler o seu"  on public.uso_ia for select using ((select auth.uid()) = user_id);
create policy "uso_ia: registar"   on public.uso_ia for insert with check ((select auth.uid()) = user_id);

-- ============ ficheiros: fotos das obras e logótipos (privados) ============
-- Caminho obrigatório: <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos',  'fotos',  false, 5242880, array['image/jpeg']),
  ('logos',  'logos',  false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "ficheiros: ler os seus" on storage.objects for select
  using (bucket_id in ('fotos', 'logos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ficheiros: carregar os seus" on storage.objects for insert
  with check (bucket_id in ('fotos', 'logos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ficheiros: substituir os seus" on storage.objects for update
  using (bucket_id in ('fotos', 'logos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ficheiros: apagar os seus" on storage.objects for delete
  using (bucket_id in ('fotos', 'logos') and (storage.foldername(name))[1] = (select auth.uid())::text);
