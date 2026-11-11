-- Seguridad de Cobros (10/11/2026)
-- Desde aquí la base SOLO deja leer y cambiar a quien inició sesión (usuarios de
-- Authentication: cesar, tienda, facturacion). La clave pública (anon) sola ya no sirve.
-- Correr DESPUÉS de que Cobros (v2026-11-10.1) y Facturación rápida ya entren con usuario.
-- Se puede correr más de una vez sin problema.

-- 1) Todas las reglas (policies) de las tablas: solo para usuarios con sesión
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2) Tablas que no tenían reglas activadas: se activan con una regla "solo con sesión"
--    (así siguen funcionando igual para los usuarios, pero no para la clave pública)
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('drop policy if exists solo_con_sesion on public.%I', t.relname);
    execute format('create policy solo_con_sesion on public.%I for all to authenticated using (true) with check (true)', t.relname);
  end loop;
end $$;

-- 3) Quitarle todo a la clave pública (anon), también para lo que se cree después
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 4) Revisión: debe salir "anon_puede = 0" y "reglas_para_anon = 0"
select
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public') as anon_puede,
  (select count(*) from pg_policies
     where schemaname = 'public' and ('anon' = any(roles) or 'public' = any(roles))) as reglas_para_anon,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as tablas_sin_reglas;
