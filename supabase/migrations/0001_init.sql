-- Sorrel restaurant starter: database schema, security rules and storage.
--
-- Run this whole file once in the Supabase SQL Editor (or `supabase db push`).
-- It is safe to run again: every statement is idempotent.
--
-- Security model
--   * Visitors (anon) can read the menu and the public settings. Nothing else.
--   * Signed-in users can change things only if they are listed in `admins`.
--   * Orders are written only by the website's server (secret key), after it
--     has validated the cart and recalculated every price itself.
--   * Access is granted explicitly, table by table, so nothing is exposed by
--     accident — including on projects where Supabase no longer grants
--     access to new tables automatically.

create extension if not exists pgcrypto;

-- Helpers live in a schema the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Timestamps
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settings (one row, stored as JSON so new settings never need a migration)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  note text not null default '' check (char_length(note) <= 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  price_cents integer not null check (price_cents between 0 and 10000000),
  image_url text check (image_url is null or char_length(image_url) <= 1000),
  image_alt text not null default '' check (char_length(image_alt) <= 200),
  ingredients text[] not null default '{}',
  allergens text[] not null default '{}',
  dietary text[] not null default '{}',
  accent text not null default '#e8967a' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  available boolean not null default true,
  featured boolean not null default false,
  in_showcase boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_position_idx on public.categories (position);
create index if not exists dishes_position_idx on public.dishes (position);
create index if not exists dishes_category_idx on public.dishes (category_id);

drop trigger if exists dishes_touch on public.dishes;
create trigger dishes_touch before update on public.dishes
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfillment_method as enum ('pickup', 'delivery');
exception when duplicate_object then null; end $$;

create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  status public.order_status not null default 'new',
  fulfillment public.fulfillment_method not null,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  phone text not null check (char_length(phone) between 6 and 32),
  email text not null default '' check (char_length(email) <= 200),
  address text not null default '' check (char_length(address) <= 300),
  notes text not null default '' check (char_length(notes) <= 500),
  requested_time text check (requested_time is null or requested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + delivery_fee_cents),
  client_ip_hash text,
  -- One key per checkout attempt: a resubmitted form returns the same order.
  idempotency_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrades from an earlier version of this file.
alter table public.orders add column if not exists idempotency_key uuid unique;

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_ip_idx on public.orders (client_ip_hash, created_at desc);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

-- Status changes must follow the kitchen workflow, whoever makes them:
-- new → accepted → preparing → ready → completed, or → cancelled before completion.
create or replace function private.check_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'new'       and new.status in ('accepted', 'cancelled'))
    or (old.status = 'accepted'  and new.status in ('preparing', 'ready', 'cancelled'))
    or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
    or (old.status = 'ready'     and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'invalid order status change: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.check_order_status() from public, anon, authenticated;

drop trigger if exists orders_status_flow on public.orders;
create trigger orders_status_flow before update of status on public.orders
  for each row execute function private.check_order_status();

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 100),
  line_total_cents integer not null check (line_total_cents = unit_price_cents * quantity)
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_dish_idx on public.order_items (dish_id);

-- Creates an order and its lines in one transaction. Only the website's
-- server (secret key) may call it, after it has re-priced the cart itself.
--
-- Inside one lock it also:
--   * returns the existing order when the same checkout is submitted twice;
--   * enforces a per-connection and a site-wide order limit, so the limits
--     hold even when the website runs on several servers at once.
drop function if exists public.place_order(jsonb, jsonb);
create or replace function public.place_order(
  p_order jsonb,
  p_items jsonb,
  p_max_per_client integer default 4,
  p_max_total integer default 60,
  p_window_minutes integer default 10
)
returns table (order_id uuid, order_number bigint, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key uuid := nullif(p_order->>'idempotency_key', '')::uuid;
  v_ip text := p_order->>'client_ip_hash';
  v_since timestamptz := now() - make_interval(mins => p_window_minutes);
  v_id uuid;
  v_number bigint;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order has no items' using errcode = 'check_violation';
  end if;

  -- One order at a time: makes the duplicate and rate checks race-free.
  perform pg_advisory_xact_lock(hashtext('sorrel:place_order'));

  if v_key is not null then
    select o.id, o.number into v_id, v_number from public.orders o where o.idempotency_key = v_key;
    if found then
      return query select v_id, v_number, true;
      return;
    end if;
  end if;

  if v_ip is not null and (
    select count(*) from public.orders o where o.client_ip_hash = v_ip and o.created_at >= v_since
  ) >= p_max_per_client then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'client';
  end if;

  if (select count(*) from public.orders o where o.created_at >= v_since) >= p_max_total then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'total';
  end if;

  insert into public.orders (
    fulfillment, customer_name, phone, email, address, notes, requested_time,
    subtotal_cents, delivery_fee_cents, total_cents, client_ip_hash, idempotency_key
  ) values (
    (p_order->>'fulfillment')::public.fulfillment_method,
    p_order->>'customer_name',
    p_order->>'phone',
    coalesce(p_order->>'email', ''),
    coalesce(p_order->>'address', ''),
    coalesce(p_order->>'notes', ''),
    nullif(p_order->>'requested_time', ''),
    (p_order->>'subtotal_cents')::integer,
    (p_order->>'delivery_fee_cents')::integer,
    (p_order->>'total_cents')::integer,
    v_ip,
    v_key
  )
  returning id, number into v_id, v_number;

  insert into public.order_items (order_id, dish_id, name, unit_price_cents, quantity, line_total_cents)
  select v_id,
         (item->>'dish_id')::uuid,
         item->>'name',
         (item->>'unit_price_cents')::integer,
         (item->>'quantity')::integer,
         (item->>'line_total_cents')::integer
  from jsonb_array_elements(p_items) as item;

  if (select coalesce(sum(i.line_total_cents), 0) from public.order_items i where i.order_id = v_id)
     <> (p_order->>'subtotal_cents')::integer then
    raise exception 'order lines do not add up to the subtotal' using errcode = 'check_violation';
  end if;

  return query select v_id, v_number, false;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Grants: who can reach which table at all (RLS then decides which rows)
-- ---------------------------------------------------------------------------
revoke all on table public.admins, public.settings, public.categories, public.dishes,
  public.orders, public.order_items from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- Visitors: read the public menu and settings.
grant select on table public.settings, public.categories, public.dishes to anon;

-- Signed-in users: same reads; writes are limited to admins by RLS below.
grant select on table public.settings, public.categories, public.dishes to authenticated;
grant insert, update, delete on table public.settings, public.categories, public.dishes to authenticated;
grant select on table public.admins to authenticated;
grant select on table public.orders, public.order_items to authenticated;
grant update (status) on table public.orders to authenticated; -- staff can only change the status

-- The website's server.
grant select, insert, update, delete on table public.admins, public.settings, public.categories,
  public.dishes, public.orders, public.order_items to service_role;
grant usage, select on sequence public.order_number_seq to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings admin write" on public.settings;
drop policy if exists "settings admin insert" on public.settings;
create policy "settings admin insert" on public.settings
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "settings admin update" on public.settings;
create policy "settings admin update" on public.settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
drop policy if exists "categories admin write" on public.categories;
drop policy if exists "categories admin insert" on public.categories;
create policy "categories admin insert" on public.categories
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "categories admin update" on public.categories;
create policy "categories admin update" on public.categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "categories admin delete" on public.categories;
create policy "categories admin delete" on public.categories
  for delete to authenticated using ((select private.is_admin()));

drop policy if exists "dishes public read" on public.dishes;
create policy "dishes public read" on public.dishes for select to anon, authenticated using (true);
drop policy if exists "dishes admin write" on public.dishes;
drop policy if exists "dishes admin insert" on public.dishes;
create policy "dishes admin insert" on public.dishes
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "dishes admin update" on public.dishes;
create policy "dishes admin update" on public.dishes
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "dishes admin delete" on public.dishes;
create policy "dishes admin delete" on public.dishes
  for delete to authenticated using ((select private.is_admin()));

-- Orders: no public access at all. Customers never read orders back from the
-- database; the server returns the confirmation directly.
drop policy if exists "orders admin read" on public.orders;
create policy "orders admin read" on public.orders
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "order items admin read" on public.order_items;
create policy "order items admin read" on public.order_items
  for select to authenticated using ((select private.is_admin()));

-- Clean up the helper from earlier versions of this file.
drop function if exists public.is_admin();

-- ---------------------------------------------------------------------------
-- Image storage: public to view, only admins can upload, replace or delete
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dish images admin insert" on storage.objects;
create policy "dish images admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'dish-images' and (select private.is_admin()));
drop policy if exists "dish images admin update" on storage.objects;
create policy "dish images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'dish-images' and (select private.is_admin()))
  with check (bucket_id = 'dish-images' and (select private.is_admin()));
drop policy if exists "dish images admin delete" on storage.objects;
create policy "dish images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'dish-images' and (select private.is_admin()));
-- Admins can list the bucket (needed to replace or delete files); the public
-- reaches images only by their direct URL, never by listing.
drop policy if exists "dish images admin read" on storage.objects;
create policy "dish images admin read" on storage.objects
  for select to authenticated using (bucket_id = 'dish-images' and (select private.is_admin()));

-- Default settings row so the storefront has something to read.
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
