begin;

create extension if not exists pgcrypto;

drop table if exists public.tracking_events cascade;
drop table if exists public.messages cascade;
drop table if exists public.shipments cascade;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  sender_name text not null,
  sender_address text not null,
  sender_phone text not null,
  sender_email text,
  origin text not null,
  recipient_name text not null,
  recipient_email text not null,
  recipient_address text not null,
  recipient_phone text,
  destination text not null,
  destination_country text not null,
  status text not null default 'Processing',
  current_location text not null,
  estimated_delivery date,
  declared_value numeric(12, 2) not null default 0,
  shipping_fee numeric(12, 2) not null default 0,
  currency varchar(3) not null default 'USD',
  package_description text not null default 'Standard Package',
  delivery_time text,
  service_level text not null default 'Express',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_tracking_number_format check (tracking_number ~ '^GSL-[0-9]{4}-[A-Z0-9]{8}$'),
  constraint shipments_status_check check (status in ('Processing', 'In Transit', 'On Hold', 'Delivering', 'Delivered', 'Cancelled')),
  constraint shipments_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint shipments_amounts_non_negative check (declared_value >= 0 and shipping_fee >= 0)
);

create table if not exists public.tracking_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  location text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tracking_events_status_check check (status in ('Processing', 'In Transit', 'On Hold', 'Delivering', 'Delivered', 'Cancelled'))
);

create index if not exists tracking_events_shipment_occurred_idx
  on public.tracking_events (shipment_id, occurred_at desc);

create or replace function public.record_tracking_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or old.status is distinct from new.status
     or old.current_location is distinct from new.current_location then
    insert into public.tracking_events (shipment_id, status, location)
    values (new.id, new.status, new.current_location);
  end if;
  return new;
end;
$$;

drop trigger if exists shipments_record_tracking_event on public.shipments;
create trigger shipments_record_tracking_event
after insert or update of status, current_location on public.shipments
for each row execute function public.record_tracking_event();

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  customer_email text not null,
  customer_name text,
  sender_type text not null,
  message text not null,
  is_read boolean not null default false,
  admin_name text,
  created_at timestamptz not null default now(),
  constraint messages_sender_type_check check (sender_type in ('customer', 'admin'))
);

create index if not exists messages_customer_created_idx
  on public.messages (lower(customer_email), created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shipments_set_updated_at on public.shipments;
create trigger shipments_set_updated_at
before update on public.shipments
for each row execute function public.set_updated_at();

alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;
alter table public.messages enable row level security;

revoke all on public.shipments from anon, authenticated;
revoke all on public.tracking_events from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on sequence public.tracking_events_id_seq from anon, authenticated;
revoke all on sequence public.messages_id_seq from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.record_tracking_event() from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on public.shipments, public.tracking_events, public.messages to service_role;
grant all on sequence public.tracking_events_id_seq, public.messages_id_seq to service_role;
grant execute on function public.set_updated_at(), public.record_tracking_event() to service_role;

commit;
