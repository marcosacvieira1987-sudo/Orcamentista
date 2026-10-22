-- Atualização da base de dados de produção: migrações 0002 e 0003 numa só vez.
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

select 'Base de dados atualizada' as resultado;
