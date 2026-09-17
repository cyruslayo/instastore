-- Supabase may grant function EXECUTE directly to API roles through default
-- privileges. Order status changes are authenticated-admin only, so remove
-- anonymous execution explicitly.

revoke execute on function public.set_order_status(uuid, text) from anon;
