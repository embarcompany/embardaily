-- EmbarDaily: Supabase is the operational source of truth.
create extension if not exists pgcrypto;

create type public.staff_role as enum ('admin', 'operacao', 'marketing', 'leitura');
create type public.case_status as enum ('nao_iniciado', 'toque_1_enviado', 'aguardando_resposta', 'revisao_manual', 'avaliacao_solicitada', 'instagram_solicitado', 'concluido', 'opt_out');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'received');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.staff_role not null default 'leitura',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text not null unique,
  email text,
  language text not null default 'pt-BR',
  opt_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_format check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  external_reference text unique,
  summary text not null,
  company text,
  origin text,
  destination text,
  departure_at date,
  arrival_at date,
  drive_folder_url text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text,
  breed text,
  created_at timestamptz not null default now()
);

create table public.shipment_pets (
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete restrict,
  primary key (shipment_id, pet_id)
);

create table public.campaign_cases (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null unique references public.shipments(id) on delete cascade,
  status public.case_status not null default 'nao_iniciado',
  initial_contact_due_at timestamptz,
  initial_contact_sent_at timestamptz,
  replied_at timestamptz,
  next_action_at timestamptz,
  next_action_label text,
  owner_id uuid references public.profiles(id) on delete set null,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_case_id uuid references public.campaign_cases(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  direction public.message_direction not null,
  status public.message_status not null default 'queued',
  template_code text,
  content text not null,
  evolution_message_id text unique,
  occurred_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  content_type text,
  size_bytes bigint,
  drive_file_url text,
  created_at timestamptz not null default now()
);

create table public.activities (
  id bigint generated always as identity primary key,
  shipment_id uuid references public.shipments(id) on delete cascade,
  campaign_case_id uuid references public.campaign_cases(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index shipments_customer_id_idx on public.shipments(customer_id);
create index campaign_cases_due_idx on public.campaign_cases(initial_contact_due_at) where status = 'nao_iniciado';
create index messages_customer_occurred_idx on public.messages(customer_id, occurred_at desc);
create index activities_case_created_idx on public.activities(campaign_case_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();
create trigger campaign_cases_updated_at before update on public.campaign_cases for each row execute function public.set_updated_at();

-- Atomically claims the first automatic contact so two cron executions never send it twice.
create or replace function public.claim_due_initial_contacts(batch_size integer default 50)
returns setof public.campaign_cases
language sql security definer set search_path = public as $$
  with due as (
    select cc.id from public.campaign_cases cc
    join public.shipments s on s.id = cc.shipment_id
    join public.customers c on c.id = s.customer_id
    where cc.status = 'nao_iniciado'
      and cc.initial_contact_due_at <= now()
      and c.opt_out_at is null
      and (cc.locked_at is null or cc.locked_at < now() - interval '15 minutes')
    order by cc.initial_contact_due_at
    for update of cc skip locked
    limit greatest(batch_size, 1)
  )
  update public.campaign_cases cc
     set locked_at = now(), updated_at = now()
    from due
   where cc.id = due.id
  returning cc.*;
$$;

create or replace view public.crm_kanban with (security_invoker = true) as
select s.id::text as id, c.full_name as client, c.phone_e164 as phone, s.company, s.destination,
  s.departure_at as date, coalesce(string_agg(p.name, ', ' order by p.name), '') as pet,
  cc.status::text as status, cc.initial_contact_sent_at as touch_1_at, cc.replied_at as reply_at,
  cc.reminder_count, cc.next_action_at, cc.next_action_label, s.drive_folder_url as folder_url,
  s.summary, s.created_at
from public.shipments s
join public.customers c on c.id = s.customer_id
left join public.shipment_pets sp on sp.shipment_id = s.id
left join public.pets p on p.id = sp.pet_id
left join public.campaign_cases cc on cc.shipment_id = s.id
group by s.id, c.id, cc.id;

insert into storage.buckets (id, name, public) values ('embardaily-media', 'embardaily-media', false)
on conflict (id) do nothing;
