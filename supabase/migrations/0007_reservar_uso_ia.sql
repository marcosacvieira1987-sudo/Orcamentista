-- 0007: limite diário da IA à prova de pedidos em simultâneo. Seguro de repetir.
-- Requer a 0002 (colunas de custo em uso_ia). Supabase → SQL Editor → New query → colar tudo → Run.
--
-- Antes, o servidor contava os pedidos das últimas 24 h, chamava o Claude e só no fim registava o uso,
-- com a sessão do utilizador. Pedidos em simultâneo passavam todos com a mesma contagem, e um cookie
-- adulterado podia fazer o registo falhar em silêncio. Agora o servidor reserva o pedido ANTES de chamar
-- o Claude, numa só transação, e com a chave secreta (o utilizador não consegue impedir o registo).

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

notify pgrst, 'reload schema';

select 'Limite da IA pronto' as resultado;
