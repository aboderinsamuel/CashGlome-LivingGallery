-- Run after the migration, in the Supabase SQL Editor. Every row should say ok = true.

select 'tables exist' as check, count(*) = 4 as ok
  from information_schema.tables
 where table_schema = 'public' and table_name in ('profiles', 'entries', 'goals', 'memories')
union all
select 'row-level security is on for all four', bool_and(c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('profiles', 'entries', 'goals', 'memories')
union all
select 'each table has the "own rows" policy', count(*) = 4
  from pg_policies
 where schemaname = 'public' and policyname = 'own rows'
union all
select 'sync triggers are in place', count(*) = 4
  from pg_trigger
 where tgname in ('profiles_touch', 'entries_touch', 'goals_touch', 'memories_touch')
union all
select 'signed-out visitors cannot read entries', not has_table_privilege('anon', 'public.entries', 'select')
union all
select 'signed-in people can write entries', has_table_privilege('authenticated', 'public.entries', 'insert')
union all
select 'delete_my_account exists', count(*) = 1
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'delete_my_account'
union all
select 'only signed-in people can delete an account', not has_function_privilege('anon', 'public.delete_my_account()', 'execute');
