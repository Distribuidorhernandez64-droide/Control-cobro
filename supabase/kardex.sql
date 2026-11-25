-- Kardex en Cobros (25/11/2026): existencias por proveedor, pedido sugerido y cuadre en Monica.
-- La PC (Facturación rápida) solo lee Monica cuando el maestro abre el Kardex o toca Actualizar:
-- el pedido viaja por la misma tabla de los Reportes (reportes_pedidos), con tipos nuevos kx_*.
-- Se puede correr más de una vez sin problema. No borra datos.

-- 1) Reportes: tipos nuevos y una columna para mandar los datos del pedido (códigos, ajustes)
alter table public.reportes_pedidos drop constraint if exists reportes_pedidos_tipo_check;
alter table public.reportes_pedidos add constraint reportes_pedidos_tipo_check
  check (tipo in ('ventas','mapa','vendedores','kx_existencia','kx_catalogo','kx_ajuste'));
alter table public.reportes_pedidos add column if not exists datos jsonb;
-- "tomado": la PC ya empezó el cuadre (así, si el celular se rinde, sabe si se hizo o no)
alter table public.reportes_pedidos drop constraint if exists reportes_pedidos_estado_check;
alter table public.reportes_pedidos add constraint reportes_pedidos_estado_check
  check (estado in ('pedido','tomado','listo','error'));

-- Cuadrar cambia la existencia en Monica: solo lo puede pedir César (maestro)
drop policy if exists rp_agregar on public.reportes_pedidos;
create policy rp_agregar on public.reportes_pedidos for insert to authenticated
  with check (tipo <> 'kx_ajuste' or lower(auth.jwt()->>'email') = 'cesar@cobros.local');

-- 2) Proveedores con sus productos, días de visita/entrega y la última existencia leída
create table if not exists public.kardex_proveedores (
  id            text primary key,
  nombre        text not null,
  orden         integer not null default 99,
  cada_dias     numeric,                 -- cada cuántos días visita (lo pone César)
  entrega_dias  numeric,                 -- días que tarda en llegar el pedido (0 = el mismo día)
  reserva       numeric not null default 25,   -- % extra para no quedarse sin producto
  productos     jsonb not null default '[]',   -- [{c: código Monica, n: descripción, fam: familia, k: paquetes por caja}]
  existencia    jsonb,                   -- {at, dias, items:{código:{ex, vend}}}
  actualizado   timestamptz not null default now()
);

-- 3) Pedidos hechos (historial)
create table if not exists public.kardex_pedidos (
  id         bigserial primary key,
  prov       text not null,
  at         timestamptz not null default now(),
  items      jsonb not null,             -- [{c, n, q, u, sug}]
  texto      text,
  hecho_por  text
);
create index if not exists kardex_pedidos_prov on public.kardex_pedidos (prov, at desc);

-- Solo César entra al Kardex
alter table public.kardex_proveedores enable row level security;
alter table public.kardex_pedidos enable row level security;
drop policy if exists kx_prov on public.kardex_proveedores;
drop policy if exists kx_ped on public.kardex_pedidos;
create policy kx_prov on public.kardex_proveedores for all to authenticated
  using (lower(auth.jwt()->>'email') = 'cesar@cobros.local') with check (lower(auth.jwt()->>'email') = 'cesar@cobros.local');
create policy kx_ped on public.kardex_pedidos for all to authenticated
  using (lower(auth.jwt()->>'email') = 'cesar@cobros.local') with check (lower(auth.jwt()->>'email') = 'cesar@cobros.local');
grant select, insert, update, delete on public.kardex_proveedores, public.kardex_pedidos to authenticated;
grant usage, select on sequence public.kardex_pedidos_id_seq to authenticated;
revoke all on public.kardex_proveedores, public.kardex_pedidos from anon;

-- 4) Productos del prototipo "Pedidos" (25/11/2026). Solo si todavía no existen; los días quedan vacíos
--    para que César los ponga.
insert into public.kardex_proveedores (id, nombre, orden, productos) values
('aje','AJE',1,'[
 {"c":"090","fam":"BIG / CIFRUT","k":1,"n":"---Big 1.3 cola 9ud"},
 {"c":"033","fam":"BIG / CIFRUT","k":1,"n":"---Big 1.3lt cifrut 9ud"},
 {"c":"019","fam":"BIG / CIFRUT","k":1,"n":"---Big 3.03lt cifrut 6ud"},
 {"c":"017","fam":"BIG / CIFRUT","k":1,"n":"---Big 3.03lt cola 6ud"},
 {"c":"026","fam":"BIG / CIFRUT","k":1,"n":"---Big cola 400ml 24ud"},
 {"c":"020","fam":"BIG / CIFRUT","k":1,"n":"---Big cola 625ml 12ud"},
 {"c":"035","fam":"BIG / CIFRUT","k":2,"n":"---Big cifrut 500ml 24ud"},
 {"c":"091","fam":"DEPORADE","k":2,"n":"---deporade 360ml chicle 24 ud"},
 {"c":"092","fam":"DEPORADE","k":2,"n":"---deporade 360ml fresa 24 ud"},
 {"c":"065","fam":"DEPORADE","k":2,"n":"---deporade 360ml uva 24 ud"},
 {"c":"094","fam":"DEPORADE","k":2,"n":"---deporade 625ml chicle 24ud"},
 {"c":"095","fam":"DEPORADE","k":2,"n":"---deporade 625ml fresa 24ud"},
 {"c":"108","fam":"DEPORADE","k":2,"n":"---deporade 625ml uva 24ud"},
 {"c":"323","fam":"AGUA","k":1,"n":"---agua pura cielo 250ml 24ud"},
 {"c":"029","fam":"AGUA","k":1,"n":"---agua pura 375ml cielo 24ud"},
 {"c":"028","fam":"AGUA","k":1,"n":"---agua pura 625ml cielo 20ud"},
 {"c":"089","fam":"AGUA","k":1,"n":"---agua pura 1lt cielo 1*12"},
 {"c":"098","fam":"AGUA","k":1,"n":"---Agua pura cielo 3.03lt 6ud"},
 {"c":"023","fam":"JUGOS","k":2,"n":"---jugos pulp 250ml manzana 24ud"},
 {"c":"032","fam":"JUGOS","k":2,"n":"---jugos pulp 250ml melocoton 24ud"},
 {"c":"024","fam":"JUGOS","k":2,"n":"---jugos pulpin 145ml manzana 24ud"},
 {"c":"022","fam":"JUGOS","k":2,"n":"---jugos pulpin 145ml melocoton 24ud"},
 {"c":"027","fam":"JUGOS","k":1,"n":"---jugos pulp PET. 360ml manzana 24ud"},
 {"c":"084","fam":"JUGOS","k":2,"n":"---aloe vera 360 12uni"},
 {"c":"172","fam":"ENERGIZANTES","k":2,"n":"---energizante volt go 360ml 24uni"},
 {"c":"411","fam":"ENERGIZANTES","k":4,"n":"---Volt lata real madrid 24ud"}
]'::jsonb),
('coca','Coca-Cola',2,'[
 {"c":"05","fam":"RETORNABLE","k":1,"n":"----coca cola 1lt 12ud"},
 {"c":"176","fam":"RETORNABLE","k":1,"n":"----coca retornable 1x8"},
 {"c":"01","fam":"RETORNABLE","k":1,"n":"----coca-cola 12onz 24ud"},
 {"c":"04","fam":"RETORNABLE","k":1,"n":"----coca cola 1/2lt 24ud"},
 {"c":"08","fam":"DESECHABLE","k":1,"n":"---coca cola 2.5lt 6ud"},
 {"c":"125","fam":"DESECHABLE","k":1,"n":"---coca cola 3lt 1x4"},
 {"c":"06","fam":"DESECHABLE","k":1,"n":"---coca cola 1.5lt 6ud"},
 {"c":"02","fam":"DESECHABLE","k":1,"n":"---coca cola 20onz 1X12"},
 {"c":"335","fam":"DESECHABLE","k":1,"n":"---coca cola 450ml 12ud"},
 {"c":"07","fam":"DESECHABLE","k":1,"n":"---coca cola 355ml 12ud"},
 {"c":"354","fam":"DESECHABLE","k":1,"n":"---coca 300 zero y sabores"},
 {"c":"09","fam":"LATA","k":1,"n":"---coca cola lata 24ud"},
 {"c":"03","fam":"OTROS","k":1,"n":"----coca cola mini 24ud"}
]'::jsonb),
('pepsi','Pepsi',3,'[]'::jsonb)
on conflict (id) do nothing;

-- Pedido que ya estaba guardado en el prototipo (25/11/2026 12:59)
insert into public.kardex_pedidos (prov, at, items, hecho_por)
select 'aje','2026-11-25T18:59:27.974Z',
 '[{"c":"033","n":"---Big 1.3lt cifrut 9ud","q":4,"u":"cja"},{"c":"020","n":"---Big cola 625ml 12ud","q":5,"u":"cja"}]'::jsonb,'César'
where not exists (select 1 from public.kardex_pedidos where prov='aje' and at='2026-11-25T18:59:27.974Z');
