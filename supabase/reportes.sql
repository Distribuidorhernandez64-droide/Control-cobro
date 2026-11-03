-- Reportes desde Cobros (2/11/2026): el maestro pide en el celular "Ventas del día" o "Mapeo por vendedor";
-- la PC (Facturación rápida) lo lee de Monica, deja aquí el resultado y Cobros arma el PDF igual al de Facturación rápida.
-- Solo agrega una tabla nueva. No toca ninguna otra.

create table if not exists public.reportes_pedidos (
  id           bigserial primary key,
  tipo         text not null check (tipo in ('ventas','mapa','vendedores')),
  desde        date,
  hasta        date,
  vendedor_id  integer,
  estado       text not null default 'pedido' check (estado in ('pedido','listo','error')),
  resultado    jsonb,
  error        text,
  pedido_por   text,
  creado_en    timestamptz not null default now(),
  listo_en     timestamptz
);
create index if not exists reportes_pedidos_estado on public.reportes_pedidos (estado, creado_en);

alter table public.reportes_pedidos enable row level security;
drop policy if exists rp_leer on public.reportes_pedidos;
drop policy if exists rp_agregar on public.reportes_pedidos;
drop policy if exists rp_cambiar on public.reportes_pedidos;
create policy rp_leer    on public.reportes_pedidos for select to anon, authenticated using (true);
create policy rp_agregar on public.reportes_pedidos for insert to anon, authenticated with check (true);
create policy rp_cambiar on public.reportes_pedidos for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.reportes_pedidos to anon, authenticated;
grant usage, select on sequence public.reportes_pedidos_id_seq to anon, authenticated;
