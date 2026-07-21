alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.shipments enable row level security;
alter table public.pets enable row level security;
alter table public.shipment_pets enable row level security;
alter table public.campaign_cases enable row level security;
alter table public.messages enable row level security;
alter table public.media_assets enable row level security;
alter table public.activities enable row level security;
alter table public.google_sheet_sync_runs enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operacao', 'marketing'));
$$;

create policy "staff reads profiles" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "admin manages profiles" on public.profiles for all to authenticated using ((select role from public.profiles where id = auth.uid()) = 'admin') with check ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "staff manages customers" on public.customers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages shipments" on public.shipments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages pets" on public.pets for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages shipment pets" on public.shipment_pets for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages campaign cases" on public.campaign_cases for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages messages" on public.messages for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages media" on public.media_assets for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages activities" on public.activities for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin reads sync runs" on public.google_sheet_sync_runs for select to authenticated using ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "staff uploads shipment media" on storage.objects for insert to authenticated with check (bucket_id = 'embardaily-media' and public.is_staff());
create policy "staff reads shipment media" on storage.objects for select to authenticated using (bucket_id = 'embardaily-media' and public.is_staff());
create policy "staff deletes shipment media" on storage.objects for delete to authenticated using (bucket_id = 'embardaily-media' and public.is_staff());
