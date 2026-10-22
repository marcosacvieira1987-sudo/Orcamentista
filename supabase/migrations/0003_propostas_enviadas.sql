-- PDFs das propostas enviadas por link (WhatsApp, email). Privados: o cliente só abre com o link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propostas', 'propostas', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

-- Caminho obrigatório: <user_id>/<orçamento>/proposta.pdf
create policy "propostas: ler as suas" on storage.objects for select
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: carregar as suas" on storage.objects for insert
  with check (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: substituir as suas" on storage.objects for update
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "propostas: apagar as suas" on storage.objects for delete
  using (bucket_id = 'propostas' and (storage.foldername(name))[1] = (select auth.uid())::text);
