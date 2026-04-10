create or replace function public.set_refund_status(
  p_refund_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
begin
  if p_status not in ('pending', 'approved', 'refused') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  select sale_id
  into v_sale_id
  from public.refunds
  where id = p_refund_id;

  if v_sale_id is null then
    raise exception 'Refund not found: %', p_refund_id;
  end if;

  update public.refunds
  set status = p_status
  where id = p_refund_id;

  update public.sales
  set refunded = (p_status = 'approved')
  where id = v_sale_id;
end;
$$;

grant execute on function public.set_refund_status(uuid, text) to authenticated;
