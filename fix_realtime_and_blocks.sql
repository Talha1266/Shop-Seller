-- Create missing Blocks table
create table if not exists public.blocks (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create missing Floors table
create table if not exists public.floors (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS on the new tables so the app can use them
alter table public.blocks disable row level security;
alter table public.floors disable row level security;

-- Enable Realtime for all tables (so the UI updates automatically without refreshing!)
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for all tables;
commit;
