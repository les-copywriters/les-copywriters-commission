-- Enable RLS on core tables
alter table public.sales enable row level security;
alter table public.call_analyses enable row level security;
alter table public.profiles enable row level security;

-- 1. Sales Table Policies
drop policy if exists "Admins have full access to sales" on public.sales;
create policy "Admins have full access to sales"
  on public.sales
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Users can view their own sales" on public.sales;
create policy "Users can view their own sales"
  on public.sales
  for select
  using (
    closer_id = auth.uid() or setter_id = auth.uid()
  );

-- 2. Call Analyses Table Policies
drop policy if exists "Admins have full access to call_analyses" on public.call_analyses;
create policy "Admins have full access to call_analyses"
  on public.call_analyses
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Closers can view their own call analyses" on public.call_analyses;
create policy "Closers can view their own call analyses"
  on public.call_analyses
  for select
  using (
    closer_id = auth.uid()
  );

-- 3. Profiles Table Policies
drop policy if exists "Public read access for basic profile info" on public.profiles;
create policy "Public read access for basic profile info"
  on public.profiles
  for select
  using (true); -- Anyone authenticated can see names/roles for dropdowns

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Documentation
comment on policy "Users can view their own sales" on public.sales is 'Closers and setters can only see sales they are linked to.';
comment on policy "Closers can view their own call analyses" on public.call_analyses is 'Ensures call transcripts and feedback are private to the closer.';
