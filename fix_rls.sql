-- Disable RLS on all tables so the application can read and write freely
alter table public.users disable row level security;
alter table public.shops disable row level security;
alter table public.tenants disable row level security;
alter table public.sales disable row level security;
alter table public.installments disable row level security;
alter table public.payments disable row level security;
alter table public.documents disable row level security;

-- And just in case the admin user didn't get inserted, let's insert it now with the password
insert into public.users (username, password, role) 
values ('admin', 'admin', 'admin') 
on conflict (username) do update set password = 'admin';
