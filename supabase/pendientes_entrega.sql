-- Pendientes de entregar: notas de entrega de Monica que Facturación rápida sube para Cobros.
-- Solo agrega tablas nuevas. NO toca 'dias' ni 'respaldos'.

create table if not exists public.pendientes_entrega (
  nro               bigint primary key,            -- número de nota de entrega en Monica
  fecha             date not null,                 -- fecha de la nota
  hora              text,                          -- hora de la nota (HH:MM)
  cliente           text not null default '',
  codigo_cliente    text default '',
  vendedor          text default '',
  vendedor_id       integer,
  total             numeric(12,2) not null default 0,
  lineas            integer default 0,
  anulada           boolean not null default false,
  motivo            text,                          -- por qué ya no va (anulada / cambió de vendedor)
  monica_actualizado text,                         -- última modificación en Monica
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente','asignada','enviada','descartada')),
  rutero            text,
  viaje_uid         text,
  asignada_en       timestamptz,
  enviada_en        timestamptz,
  total_enviado     numeric(12,2),
  quien             text,
  creado_en         timestamptz not null default now(),
  cambiado_en       timestamptz not null default now()
);
-- Envases que lleva la nota (cajas, vidrio, cilindros), calculados por Facturación rápida
alter table public.pendientes_entrega add column if not exists envases jsonb;
-- Vista previa: productos de la nota (código, descripción, cantidad, precio, descuento, comentario) tal como están en Monica
alter table public.pendientes_entrega add column if not exists detalle jsonb;
-- 'Para mañana': el maestro deja una nota pendiente para otro día; no sale en la lista de hoy y regresa sola ese día
alter table public.pendientes_entrega add column if not exists pospuesta_hasta date;
create index if not exists pendientes_entrega_estado_fecha on public.pendientes_entrega (estado, fecha);

-- Aviso: si en Monica modifican una nota que YA salió en ruta, Facturación rápida lo anota aquí
-- (solo estas 4 columnas; lo que salió en la ruta nunca cambia).
alter table public.pendientes_entrega add column if not exists monica_cambio boolean not null default false;
alter table public.pendientes_entrega add column if not exists monica_total numeric(12,2);
alter table public.pendientes_entrega add column if not exists monica_anulada boolean not null default false;
alter table public.pendientes_entrega add column if not exists monica_cambio_en timestamptz;

-- Guardia: una factura ENVIADA ya no se puede cambiar (ni desde Cobros ni desde Facturación rápida).
-- Única excepción: las columnas del aviso de arriba (para avisar que Monica ya no coincide).
create or replace function public.pendientes_guardia() returns trigger
language plpgsql as $$
declare libres text[] := array['monica_cambio','monica_total','monica_anulada','monica_cambio_en','cambiado_en'];
begin
  if tg_op = 'UPDATE' then
    if old.estado = 'enviada' then
      if (to_jsonb(new) - libres) is distinct from (to_jsonb(old) - libres) then
        raise exception 'La nota % ya salió en ruta y no se puede cambiar', old.nro;
      end if;
      if new.monica_cambio and not old.monica_cambio then
        new.monica_cambio_en := now();
      end if;
      new.cambiado_en := now();
      return new;
    end if;
    if new.estado = 'enviada' and old.estado <> 'asignada' then
      raise exception 'La nota % no estaba en una ruta', old.nro;
    end if;
    if new.estado = 'enviada' then
      new.enviada_en := now();
    end if;
    if new.estado = 'asignada' and old.estado <> 'asignada' then
      new.asignada_en := now();
    end if;
  end if;
  new.cambiado_en := now();
  return new;
end $$;

drop trigger if exists pendientes_guardia on public.pendientes_entrega;
create trigger pendientes_guardia before insert or update on public.pendientes_entrega
  for each row execute function public.pendientes_guardia();

-- Latido de Facturación rápida: para que Cobros sepa si los montos están al día.
create table if not exists public.puente (
  id        text primary key,
  latido    bigint not null default 0,
  version   text,
  info      jsonb,
  visto_en  timestamptz not null default now()
);
create or replace function public.puente_latido() returns trigger
language plpgsql as $$ begin new.visto_en := now(); return new; end $$;
drop trigger if exists puente_latido on public.puente;
create trigger puente_latido before insert or update on public.puente
  for each row execute function public.puente_latido();

-- Segundos desde el último latido, medidos con el reloj del servidor (no el del celular ni el de la PC).
create or replace function public.puente_edad(p_id text) returns double precision
language sql stable as $$
  select extract(epoch from now() - visto_en) from public.puente where id = p_id
$$;

-- Permisos: leer, agregar y cambiar. Nadie puede BORRAR.
alter table public.pendientes_entrega enable row level security;
alter table public.puente enable row level security;
drop policy if exists pe_leer on public.pendientes_entrega;
drop policy if exists pe_agregar on public.pendientes_entrega;
drop policy if exists pe_cambiar on public.pendientes_entrega;
create policy pe_leer    on public.pendientes_entrega for select to anon, authenticated using (true);
create policy pe_agregar on public.pendientes_entrega for insert to anon, authenticated with check (true);
create policy pe_cambiar on public.pendientes_entrega for update to anon, authenticated using (true) with check (true);
drop policy if exists pu_leer on public.puente;
drop policy if exists pu_agregar on public.puente;
drop policy if exists pu_cambiar on public.puente;
create policy pu_leer    on public.puente for select to anon, authenticated using (true);
create policy pu_agregar on public.puente for insert to anon, authenticated with check (true);
create policy pu_cambiar on public.puente for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.pendientes_entrega to anon, authenticated;
grant select, insert, update on public.puente to anon, authenticated;
grant execute on function public.puente_edad(text) to anon, authenticated;
