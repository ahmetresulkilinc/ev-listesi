-- Ev Listesi — Supabase şeması
-- Supabase Dashboard > SQL Editor > New query > bu dosyanın tamamını yapıştır > Run

create extension if not exists pgcrypto;

-- Ürünler
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  house_key   text not null,
  name        text not null,
  category    text not null default 'acil'     check (category in ('acil','orta','sonra')),
  status      text not null default 'bekliyor' check (status in ('bekliyor','alindi')),
  planned     boolean not null default false,
  price       numeric,
  link        text,
  note        text,
  image       text,
  emoji       text,
  sort_order  integer not null default 0,
  bought_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_house_key_idx on public.items (house_key);

-- Ev ayarları (başlık, bütçe)
create table if not exists public.settings (
  house_key    text primary key,
  title        text,
  budget       numeric default 0,
  budget_month text,
  updated_at   timestamptz not null default now()
);

-- Ev anahtarı: tarayıcıdan "x-house-key" başlığıyla gelir.
create or replace function public.house_key()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.headers', true)::json ->> 'x-house-key', '');
$$;

alter table public.items    enable row level security;
alter table public.settings enable row level security;

drop policy if exists "house items" on public.items;
create policy "house items" on public.items
  for all
  to anon, authenticated
  using      (public.house_key() <> '' and house_key = public.house_key())
  with check (public.house_key() <> '' and house_key = public.house_key());

drop policy if exists "house settings" on public.settings;
create policy "house settings" on public.settings
  for all
  to anon, authenticated
  using      (public.house_key() <> '' and house_key = public.house_key())
  with check (public.house_key() <> '' and house_key = public.house_key());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.items, public.settings to anon, authenticated;
