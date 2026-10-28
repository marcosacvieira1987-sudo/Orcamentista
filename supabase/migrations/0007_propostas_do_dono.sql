-- Só se publica a página de uma proposta de um orçamento da própria conta.
-- Seguro de repetir.
drop policy if exists "propostas: publicar" on public.propostas;
drop policy if exists "propostas: atualizar" on public.propostas;
create policy "propostas: publicar" on public.propostas for insert
  with check ((select auth.uid()) = user_id and exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = (select auth.uid())));
create policy "propostas: atualizar" on public.propostas for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = (select auth.uid())));

notify pgrst, 'reload schema';

select 'Regras das propostas atualizadas' as resultado;
