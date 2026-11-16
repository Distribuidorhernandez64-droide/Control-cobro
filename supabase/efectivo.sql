-- Control de Efectivo de las tiendas (14/11/2026) · app en efectivo/
-- Tiendas: La Canasta y Morelia. Cada encargada anota sus ventas y entrega dinero;
-- administración recibe, ingresa mercadería y ve el balance contra el tope.
--
-- Esta app NO usa los usuarios de Authentication (cesar, tienda, facturacion):
-- tiene sus propios usuarios (tabla ce_usuarios) y solo se entra por funciones (ce_...).
-- Las tablas ce_ no se pueden leer ni cambiar directo: ni con la clave pública ni con sesión de Cobros.
--
-- Solo agrega tablas y funciones nuevas (todas empiezan con ce_ o cei_). No toca ninguna otra.
-- Se puede correr más de una vez sin problema.

create extension if not exists pgcrypto with schema extensions;

-- ===================== TABLAS =====================

create table if not exists public.ce_tiendas (
  id         text primary key,
  nombre     text not null,
  saldo_ini  numeric(12,2) not null default 0,
  fecha_ini  date not null default ((now() at time zone 'America/Guatemala')::date),
  tope       numeric(12,2) not null default 4000,
  orden      integer not null default 0
);
insert into public.ce_tiendas (id, nombre, orden) values
  ('canasta', 'Tienda La Canasta', 1),
  ('morelia', 'Tienda Morelia', 2)
on conflict (id) do nothing;

create table if not exists public.ce_usuarios (
  id               uuid primary key default gen_random_uuid(),
  usuario          text not null unique,
  nombre           text not null default '',
  pass_hash        text not null,
  rol              text not null check (rol in ('admin','tienda')),
  tienda_id        text references public.ce_tiendas(id),
  activo           boolean not null default true,
  fallos           integer not null default 0,
  bloqueado_hasta  timestamptz,
  creado_en        timestamptz not null default now(),
  check (rol = 'admin' or tienda_id is not null)
);

create table if not exists public.ce_sesiones (
  token       text primary key,
  usuario_id  uuid not null references public.ce_usuarios(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  expira      timestamptz not null
);

create table if not exists public.ce_ventas (
  id            uuid primary key,                 -- lo genera el celular (así no se duplica si se reenvía)
  tienda_id     text not null references public.ce_tiendas(id),
  fecha         date not null,                    -- día de la venta
  monto         numeric(12,2) not null check (monto > 0),
  usuario_id    uuid references public.ce_usuarios(id),
  quien         text not null default '',
  entrega_id    uuid,                             -- con qué entrega se mandó el dinero
  tarde         boolean not null default false,   -- se anotó otro día
  creado_local  timestamptz,                      -- hora del celular al anotar (sirve sin internet)
  creado_en     timestamptz not null default now(),
  cambiado_en   timestamptz
);
create index if not exists ce_ventas_tienda on public.ce_ventas (tienda_id, fecha);

create table if not exists public.ce_entregas (
  id              uuid primary key,
  tienda_id       text not null references public.ce_tiendas(id),
  fecha_envio     date not null,
  total           numeric(12,2) not null,
  usuario_id      uuid references public.ce_usuarios(id),
  quien           text not null default '',
  estado          text not null default 'enviado' check (estado in ('enviado','recibido')),
  fecha_recibido  date,
  recibido_en     timestamptz,
  creado_local    timestamptz,
  creado_en       timestamptz not null default now()
);
create index if not exists ce_entregas_tienda on public.ce_entregas (tienda_id, fecha_envio);

create table if not exists public.ce_ingresos (
  id          uuid primary key,
  tienda_id   text not null references public.ce_tiendas(id),
  factura     text not null,
  fecha       date not null,
  monto       numeric(12,2) not null check (monto > 0),
  creado_en   timestamptz not null default now(),
  editado_en  timestamptz
);
create index if not exists ce_ingresos_tienda on public.ce_ingresos (tienda_id, fecha);

create table if not exists public.ce_cambios (
  id         bigserial primary key,
  tienda_id  text not null references public.ce_tiendas(id),
  tipo       text not null check (tipo in ('correccion','tarde')),
  venta_id   uuid,
  fecha      date not null,          -- día de la venta
  antes      numeric(12,2),
  despues    numeric(12,2),
  quien      text not null default '',
  cuando     timestamptz not null,   -- hora del celular
  creado_en  timestamptz not null default now()
);

-- Nadie entra directo a las tablas: solo por las funciones de abajo
alter table public.ce_tiendas  enable row level security;
alter table public.ce_usuarios enable row level security;
alter table public.ce_sesiones enable row level security;
alter table public.ce_ventas   enable row level security;
alter table public.ce_entregas enable row level security;
alter table public.ce_ingresos enable row level security;
alter table public.ce_cambios  enable row level security;
revoke all on public.ce_tiendas, public.ce_usuarios, public.ce_sesiones, public.ce_ventas,
              public.ce_entregas, public.ce_ingresos, public.ce_cambios from anon, authenticated;
revoke all on sequence public.ce_cambios_id_seq from anon, authenticated;

-- ===================== FUNCIONES INTERNAS (cei_) =====================

create or replace function public.cei_hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Guatemala')::date $$;

create or replace function public.cei_dia(p timestamptz) returns date
language sql immutable as $$ select (p at time zone 'America/Guatemala')::date $$;

-- La hora que manda el celular, sin dejar que venga del futuro
create or replace function public.cei_hora_local(p timestamptz) returns timestamptz
language sql stable as $$ select least(coalesce(p, now()), now() + interval '10 minutes') $$;

create or replace function public.cei_usuario(p_token text) returns public.ce_usuarios
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios;
begin
  select us.* into u
    from public.ce_sesiones s join public.ce_usuarios us on us.id = s.usuario_id
   where s.token = p_token and s.expira > now() and us.activo;
  if not found then raise exception 'SESION'; end if;
  return u;
end $$;

create or replace function public.cei_admin(p_token text) returns public.ce_usuarios
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios;
begin
  u := public.cei_usuario(p_token);
  if u.rol <> 'admin' then raise exception 'Solo administración puede hacer esto.'; end if;
  return u;
end $$;

create or replace function public.cei_tienda(u public.ce_usuarios, p_tienda text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if u.rol = 'tienda' then return u.tienda_id; end if;
  if not exists (select 1 from public.ce_tiendas where id = p_tienda) then raise exception 'Tienda no encontrada.'; end if;
  return p_tienda;
end $$;

create or replace function public.cei_sesion_nueva(p_usuario uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare t text; u public.ce_usuarios;
begin
  delete from public.ce_sesiones where expira < now();
  t := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.ce_sesiones (token, usuario_id, expira) values (t, p_usuario, now() + interval '120 days');
  select * into u from public.ce_usuarios where id = p_usuario;
  return json_build_object('token', t, 'usuario', u.usuario, 'nombre', u.nombre, 'rol', u.rol, 'tienda_id', u.tienda_id);
end $$;

-- ===================== FUNCIONES DE LA APP (ce_) =====================

-- ¿Ya hay administrador? (la primera vez la app pide crearlo)
create or replace function public.ce_hay_admin() returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from public.ce_usuarios where rol = 'admin')
$$;

-- Crear el administrador: solo funciona mientras no exista ninguno
create or replace function public.ce_crear_admin(p_usuario text, p_nombre text, p_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; usr text := lower(trim(coalesce(p_usuario, '')));
begin
  perform pg_advisory_xact_lock(4242001);
  if exists (select 1 from public.ce_usuarios where rol = 'admin') then raise exception 'Ya existe un administrador.'; end if;
  if usr !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Usuario: de 3 a 30 letras o números, sin espacios.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres.'; end if;
  insert into public.ce_usuarios (usuario, nombre, pass_hash, rol)
  values (usr, trim(coalesce(p_nombre, '')), extensions.crypt(p_pass, extensions.gen_salt('bf')), 'admin')
  returning id into uid;
  return public.cei_sesion_nueva(uid);
end $$;

-- Entrar. Devuelve {error} en vez de fallar, para que cuenten los intentos.
create or replace function public.ce_login(p_usuario text, p_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; usr text := lower(trim(coalesce(p_usuario, '')));
begin
  select * into u from public.ce_usuarios where usuario = usr;
  if not found or not u.activo then
    return json_build_object('error', 'Usuario o contraseña incorrectos.');
  end if;
  if u.bloqueado_hasta is not null and u.bloqueado_hasta > now() then
    return json_build_object('error', 'Demasiados intentos. Espera unos minutos.');
  end if;
  if extensions.crypt(coalesce(p_pass, ''), u.pass_hash) <> u.pass_hash then
    update public.ce_usuarios
       set fallos = case when fallos + 1 >= 5 then 0 else fallos + 1 end,
           bloqueado_hasta = case when fallos + 1 >= 5 then now() + interval '10 minutes' else bloqueado_hasta end
     where id = u.id;
    return json_build_object('error', 'Usuario o contraseña incorrectos.');
  end if;
  update public.ce_usuarios set fallos = 0, bloqueado_hasta = null where id = u.id;
  return public.cei_sesion_nueva(u.id);
end $$;

create or replace function public.ce_salir(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.ce_sesiones where token = p_token
$$;

-- Todo lo de una tienda (la encargada solo recibe la suya)
create or replace function public.ce_datos(p_token text, p_tienda text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; t text; r json;
begin
  u := public.cei_usuario(p_token);
  t := public.cei_tienda(u, p_tienda);
  select json_build_object(
    'hoy', public.cei_hoy(),
    'yo', json_build_object('usuario', u.usuario, 'nombre', u.nombre, 'rol', u.rol, 'tienda_id', u.tienda_id),
    'tiendas', case when u.rol = 'admin' then
        (select json_agg(json_build_object('id', id, 'nombre', nombre) order by orden) from public.ce_tiendas)
      else null end,
    'tienda', (select json_build_object('id', id, 'nombre', nombre, 'saldo_ini', saldo_ini, 'fecha_ini', fecha_ini, 'tope', tope)
                 from public.ce_tiendas where id = t),
    'ventas', coalesce((select json_agg(json_build_object('id', id, 'fecha', fecha, 'monto', monto, 'quien', quien,
                 'entrega_id', entrega_id, 'creado_en', coalesce(creado_local, creado_en)) order by fecha, coalesce(creado_local, creado_en))
                 from public.ce_ventas where tienda_id = t), '[]'::json),
    'entregas', coalesce((select json_agg(json_build_object('id', id, 'fecha_envio', fecha_envio, 'total', total, 'quien', quien,
                 'estado', estado, 'fecha_recibido', fecha_recibido, 'creado_en', coalesce(creado_local, creado_en)) order by fecha_envio, creado_en)
                 from public.ce_entregas where tienda_id = t), '[]'::json),
    'ingresos', coalesce((select json_agg(json_build_object('id', id, 'factura', factura, 'fecha', fecha, 'monto', monto,
                 'creado_en', creado_en) order by fecha, creado_en)
                 from public.ce_ingresos where tienda_id = t), '[]'::json),
    'cambios', coalesce((select json_agg(json_build_object('id', id, 'tipo', tipo, 'venta_id', venta_id, 'fecha', fecha, 'antes', antes, 'despues', despues,
                 'quien', quien, 'cuando', cuando) order by id)
                 from public.ce_cambios where tienda_id = t and (u.rol = 'admin' or tipo = 'correccion')), '[]'::json)
  ) into r;
  return r;
end $$;

-- Anotar una venta (encargada). Si el día ya pasó queda como "anotada tarde".
create or replace function public.ce_venta(p_token text, p_id uuid, p_fecha date, p_monto numeric, p_creado timestamptz) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; hl timestamptz; dia date; m numeric(12,2);
begin
  u := public.cei_usuario(p_token);
  if u.rol <> 'tienda' then raise exception 'Solo la tienda anota ventas.'; end if;
  if exists (select 1 from public.ce_ventas where id = p_id) then return; end if;   -- ya llegó antes
  m := round(coalesce(p_monto, 0), 2);
  if m <= 0 then raise exception 'Escribe un monto mayor a 0.'; end if;
  if p_fecha is null then raise exception 'Falta el día.'; end if;
  hl := public.cei_hora_local(p_creado);
  dia := public.cei_dia(hl);
  if p_fecha > dia or p_fecha > public.cei_hoy() then raise exception 'No se puede anotar un día que todavía no pasa.'; end if;
  insert into public.ce_ventas (id, tienda_id, fecha, monto, usuario_id, quien, tarde, creado_local)
  values (p_id, u.tienda_id, p_fecha, m, u.id, coalesce(nullif(u.nombre, ''), u.usuario), p_fecha < dia, hl);
  if p_fecha < dia then
    insert into public.ce_cambios (tienda_id, tipo, venta_id, fecha, despues, quien, cuando)
    values (u.tienda_id, 'tarde', p_id, p_fecha, m, coalesce(nullif(u.nombre, ''), u.usuario), hl);
  end if;
end $$;

-- Corregir una venta: solo la del mismo día y si no se ha entregado. Queda registrado.
create or replace function public.ce_corregir(p_token text, p_venta uuid, p_monto numeric, p_creado timestamptz) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; v public.ce_ventas; hl timestamptz; m numeric(12,2);
begin
  u := public.cei_usuario(p_token);
  if u.rol <> 'tienda' then raise exception 'Solo la tienda corrige sus ventas.'; end if;
  select * into v from public.ce_ventas where id = p_venta and tienda_id = u.tienda_id for update;
  if not found then raise exception 'No se encontró la venta.'; end if;
  m := round(coalesce(p_monto, 0), 2);
  if m <= 0 then raise exception 'Escribe un monto mayor a 0.'; end if;
  if v.entrega_id is not null then raise exception 'Esa venta ya fue entregada; ya no se puede corregir.'; end if;
  hl := public.cei_hora_local(p_creado);
  if v.fecha <> public.cei_dia(hl) or hl < coalesce(v.creado_local, v.creado_en) - interval '10 minutes' then
    raise exception 'Solo se pueden corregir las ventas de hoy.';
  end if;
  if m = v.monto then return; end if;
  update public.ce_ventas set monto = m, cambiado_en = now() where id = v.id;
  insert into public.ce_cambios (tienda_id, tipo, venta_id, fecha, antes, despues, quien, cuando)
  values (u.tienda_id, 'correccion', v.id, v.fecha, v.monto, m, coalesce(nullif(u.nombre, ''), u.usuario), hl);
end $$;

-- Entregar dinero de varias ventas (encargada)
create or replace function public.ce_entregar(p_token text, p_id uuid, p_ventas uuid[], p_creado timestamptz) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; hl timestamptz; n integer; tot numeric(12,2);
begin
  u := public.cei_usuario(p_token);
  if u.rol <> 'tienda' then raise exception 'Solo la tienda entrega dinero.'; end if;
  if exists (select 1 from public.ce_entregas where id = p_id) then return; end if;   -- ya llegó antes
  if p_ventas is null or array_length(p_ventas, 1) is null then raise exception 'Marca al menos una venta.'; end if;
  perform 1 from public.ce_ventas where id = any(p_ventas) for update;
  select count(*), coalesce(sum(monto), 0) into n, tot
    from public.ce_ventas where id = any(p_ventas) and tienda_id = u.tienda_id and entrega_id is null;
  if n <> (select count(distinct x) from unnest(p_ventas) x) then
    raise exception 'Alguna de esas ventas ya fue entregada. Revisa y vuelve a marcar.';
  end if;
  hl := public.cei_hora_local(p_creado);
  insert into public.ce_entregas (id, tienda_id, fecha_envio, total, usuario_id, quien, creado_local)
  values (p_id, u.tienda_id, public.cei_dia(hl), tot, u.id, coalesce(nullif(u.nombre, ''), u.usuario), hl);
  update public.ce_ventas set entrega_id = p_id where id = any(p_ventas);
end $$;

-- Aceptar dinero recibido (administración)
create or replace function public.ce_aceptar(p_token text, p_entrega uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.cei_admin(p_token);
  update public.ce_entregas set estado = 'recibido', fecha_recibido = public.cei_hoy(), recibido_en = now()
   where id = p_entrega and estado = 'enviado';
end $$;

-- Ingresar o editar una factura de mercadería (administración)
create or replace function public.ce_ingreso(p_token text, p_tienda text, p_id uuid, p_factura text, p_fecha date, p_monto numeric) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; t text; m numeric(12,2); f text := trim(coalesce(p_factura, ''));
begin
  u := public.cei_admin(p_token);
  t := public.cei_tienda(u, p_tienda);
  m := round(coalesce(p_monto, 0), 2);
  if f = '' then raise exception 'Escribe el número de factura.'; end if;
  if p_fecha is null then raise exception 'Falta la fecha.'; end if;
  if m <= 0 then raise exception 'Escribe un monto mayor a 0.'; end if;
  if exists (select 1 from public.ce_ingresos where id = p_id) then
    update public.ce_ingresos set factura = f, fecha = p_fecha, monto = m, editado_en = now() where id = p_id and tienda_id = t;
  else
    insert into public.ce_ingresos (id, tienda_id, factura, fecha, monto) values (p_id, t, f, p_fecha, m);
  end if;
end $$;

-- Devolver a la tienda una entrega que se mandó por error (administración, solo si no se ha aceptado)
create or replace function public.ce_devolver(p_token text, p_entrega uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.cei_admin(p_token);
  if not exists (select 1 from public.ce_entregas where id = p_entrega and estado = 'enviado') then
    raise exception 'Esa entrega ya fue recibida o ya no existe.';
  end if;
  update public.ce_ventas set entrega_id = null where entrega_id = p_entrega;
  delete from public.ce_entregas where id = p_entrega and estado = 'enviado';
end $$;

-- Saldo inicial y tope (administración)
create or replace function public.ce_ajustes(p_token text, p_tienda text, p_saldo numeric, p_fecha date, p_tope numeric) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u public.ce_usuarios; t text;
begin
  u := public.cei_admin(p_token);
  t := public.cei_tienda(u, p_tienda);
  if p_saldo is null or p_saldo < 0 then raise exception 'Escribe el saldo inicial.'; end if;
  if p_fecha is null then raise exception 'Escoge la fecha.'; end if;
  if p_tope is null or p_tope <= 0 then raise exception 'Escribe un tope mayor a 0.'; end if;
  update public.ce_tiendas set saldo_ini = round(p_saldo, 2), fecha_ini = p_fecha, tope = round(p_tope, 2) where id = t;
end $$;

-- Usuarios (administración)
create or replace function public.ce_usuarios_lista(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.cei_admin(p_token);
  return coalesce((select json_agg(json_build_object('id', id, 'usuario', usuario, 'nombre', nombre, 'rol', rol,
            'tienda_id', tienda_id, 'activo', activo) order by rol, tienda_id, usuario) from public.ce_usuarios), '[]'::json);
end $$;

-- Crear (p_id vacío) o cambiar un usuario. La contraseña solo cambia si viene escrita.
create or replace function public.ce_guardar_usuario(p_token text, p_id uuid, p_usuario text, p_nombre text, p_pass text,
                                                     p_tienda text, p_activo boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a public.ce_usuarios; x public.ce_usuarios; usr text := lower(trim(coalesce(p_usuario, '')));
begin
  a := public.cei_admin(p_token);
  if usr !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Usuario: de 3 a 30 letras o números, sin espacios.'; end if;
  if exists (select 1 from public.ce_usuarios where usuario = usr and id is distinct from p_id) then
    raise exception 'Ese usuario ya existe.';
  end if;
  if coalesce(p_pass, '') <> '' and length(p_pass) < 4 then raise exception 'La contraseña debe tener al menos 4 caracteres.'; end if;
  if p_id is null then
    if coalesce(p_pass, '') = '' then raise exception 'Escribe la contraseña.'; end if;
    if not exists (select 1 from public.ce_tiendas where id = p_tienda) then raise exception 'Escoge la tienda.'; end if;
    insert into public.ce_usuarios (usuario, nombre, pass_hash, rol, tienda_id, activo)
    values (usr, trim(coalesce(p_nombre, '')), extensions.crypt(p_pass, extensions.gen_salt('bf')), 'tienda', p_tienda, coalesce(p_activo, true));
    return;
  end if;
  select * into x from public.ce_usuarios where id = p_id for update;
  if not found then raise exception 'No se encontró el usuario.'; end if;
  if x.rol = 'admin' and x.id <> a.id then raise exception 'No se puede cambiar otro administrador.'; end if;
  if x.id = a.id and coalesce(p_activo, true) = false then raise exception 'No puedes desactivar tu propio usuario.'; end if;
  if x.rol = 'tienda' and not exists (select 1 from public.ce_tiendas where id = p_tienda) then raise exception 'Escoge la tienda.'; end if;
  update public.ce_usuarios
     set usuario = usr,
         nombre = trim(coalesce(p_nombre, '')),
         tienda_id = case when x.rol = 'tienda' then p_tienda else null end,
         activo = coalesce(p_activo, true),
         pass_hash = case when coalesce(p_pass, '') <> '' then extensions.crypt(p_pass, extensions.gen_salt('bf')) else pass_hash end,
         fallos = 0, bloqueado_hasta = null
   where id = x.id;
  -- Si cambió la contraseña de otra persona, la tienda de la persona o la desactivaron: que vuelva a entrar
  if x.id <> a.id and (coalesce(p_pass, '') <> '' or coalesce(p_activo, true) = false or x.tienda_id is distinct from p_tienda) then
    delete from public.ce_sesiones where usuario_id = x.id;
  end if;
end $$;

-- ===================== PERMISOS =====================
-- Las internas (cei_) no se pueden llamar desde afuera. Las de la app (ce_) sí, con la clave pública:
-- cada una revisa el usuario y la sesión por dentro.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'ce\_%' or p.proname like 'cei\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname like 'ce\_%' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    end if;
  end loop;
end $$;

-- Revisión: deben salir 0 y 0
select
  (select count(*) from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated') and table_schema = 'public' and table_name like 'ce\_%') as tablas_abiertas,
  (select count(*) from pg_policies where schemaname = 'public' and tablename like 'ce\_%') as reglas_en_tablas_ce;
