create table public.commission_audit_log (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  old_amount numeric not null, 
  new_amount numeric not null,
  changed_at timestamptz default now() not null
);

-- Enable RLS
alter table public.commission_audit_log enable row level security;

-- Only admins can view audit logs
create policy "Admins can view commission audit logs"
  on public.commission_audit_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Only admins can insert audit logs (when they perform an override)
create policy "Admins can insert commission audit logs"
  on public.commission_audit_log
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Documentation comment
comment on table public.commission_audit_log is 'Tracks manual overrides of commission amounts for dispute resolution.';
