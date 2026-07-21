-- Server-only repository reads for the local staff workspace. These grants are
-- never used by browser code and do not replace staff Auth/RLS on command APIs.
grant select on public.branches, public.restaurant_tables, public.dining_sessions, public.orders, public.order_items, public.service_requests, public.payments, public.payment_allocations, public.receipts, public.menu_categories, public.menu_items, public.menu_item_variants, public.modifier_groups, public.modifier_options, public.menu_item_modifier_groups, public.kitchen_stations, public.staff_memberships to service_role;
