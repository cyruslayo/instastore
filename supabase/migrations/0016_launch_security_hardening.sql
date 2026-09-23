-- Close the anonymous execute path to merchant-only tenant helpers, optimize
-- the own-profile RLS predicate, and index the order delivery-zone foreign key.

revoke execute on function public.current_store_id() from anon;
grant execute on function public.current_store_id() to authenticated;

revoke execute on function public.current_store_slug() from anon;
grant execute on function public.current_store_slug() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create index if not exists orders_delivery_zone_id_idx
  on public.orders (delivery_zone_id);
