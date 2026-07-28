-- Plaza Management System - Supabase Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  username text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We are using a custom users table here for simplicity to mirror the local version. 
-- In a real production Supabase app, you would typically use auth.users and link to a profiles table.

-- 2. Shops Table
create table public.shops (
  id uuid default uuid_generate_v4() primary key,
  shop_number text not null,
  block text not null,
  floor text not null,
  status text not null default 'Available' check (status in ('Available', 'Occupied')),
  price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tenants Table
create table public.tenants (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  cnic text not null,
  mobile text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Sales Table (Links Shops and Tenants)
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  shop_id uuid references public.shops(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete restrict,
  date date not null,
  total_amount numeric not null,
  advance_payment numeric not null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Installments Table
create table public.installments (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  due_date date not null,
  amount numeric not null,
  status text not null default 'Pending' check (status in ('Pending', 'Paid')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Payments Table
create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  date date not null,
  amount numeric not null,
  receipt_no text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Documents Table
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  type text not null,
  file_url text not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- For a secure app, we should enforce policies. For now, we allow authenticated access to all tables.

-- Insert initial Admin user
insert into public.users (username, role) values ('admin', 'admin');
