-- Proposta completa (estilo MMGS), numeração sequencial e custo da IA por orçamento.

-- ============ empresa: novos campos ============
alter table public.empresas
  add column slogan          text not null default '',
  add column assinante       text not null default '',
  add column banco           text not null default '',
  add column iban            text not null default '',
  add column bic             text not null default '',
  add column seguro_apolice  text not null default '',
  add column seguro_validade text not null default '',
  add column garantia_texto  text not null default '',
  -- plano de pagamentos: % do total na adjudicação; % de cada fase no início e na conclusão (somam 100)
  add column pag_adjudicacao numeric(5,2) not null default 20 check (pag_adjudicacao between 0 and 100),
  add column pag_inicio      numeric(5,2) not null default 40 check (pag_inicio between 0 and 100),
  add column pag_conclusao   numeric(5,2) not null default 40 check (pag_conclusao between 0 and 100),
  -- modelo da proposta por omissão e como se mostram os preços no PDF
  add column modelo          text not null default 'completo' check (modelo in ('rapido', 'completo')),
  add column mostrar_precos  text not null default 'capitulo' check (mostrar_precos in ('capitulo', 'detalhado')),
  -- numeração: PREFIXO-AAAA-NNN
  add column prefixo         text not null default '',
  add column proximo_numero  integer not null default 1 check (proximo_numero > 0);

-- Próximo número de proposta da empresa do utilizador (atómico; respeita RLS).
create function public.proximo_numero_proposta() returns text
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
    -- sem prefixo: primeira palavra do nome, só letras e números, até 6 caracteres
    pre := upper(left(regexp_replace(split_part(trim(coalesce(nom, '')), ' ', 1), '[^A-Za-z0-9]', '', 'g'), 6));
    if pre = '' then pre := 'P'; end if;
  end if;
  return format('%s-%s-%s', upper(trim(pre)), to_char(now(), 'YYYY'), lpad(n::text, 3, '0'));
end $$;

-- ============ custo da IA por pedido ============
alter table public.uso_ia
  add column orcamento_id  uuid references public.orcamentos (id) on delete set null,
  add column tokens_in     integer not null default 0,
  add column tokens_out    integer not null default 0,
  add column custo_usd     numeric(10,4) not null default 0;
create index uso_ia_orcamento on public.uso_ia (orcamento_id);
