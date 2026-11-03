-- Alertas de Facturación rápida (1/11/2026): lo importante para César, visto también en Cobros (solo el maestro).
-- La PC (Facturación rápida) calcula las alertas desde Monica y las sube aquí cada minuto.
-- Cuando César las ve (en la PC o en el celular) se anota 'visto_en' y la campanita se apaga en los dos lados.
-- Solo agrega una tabla nueva. No toca ninguna otra.

create table if not exists public.alertas (
  clave        text primary key,                 -- la misma clave que usa la PC (no se repite)
  tipo         text not null,                    -- vendedor · tope · poca · pct · precio
  fecha        date not null,                    -- día de la alerta
  hora         text,                             -- HH:MM
  nro          bigint,                           -- nota de entrega
  cliente      text not null default '',
  que          text not null default '',         -- qué hicieron (texto corto ya armado por la PC)
  quien        text not null default '',         -- usuario de Monica
  monto        numeric(12,2) not null default 0, -- lo que se dejó de cobrar (o el total de la nota si es cambio de vendedor)
  vigente      boolean not null default true,    -- false si ya no aplica (nota anulada, descuento quitado)
  visto_en     timestamptz,                      -- cuándo la vio César (PC o celular)
  visto_por    text,
  creado_en    timestamptz not null default now(),
  cambiado_en  timestamptz not null default now()
);
create index if not exists alertas_fecha on public.alertas (fecha);
-- 2/11/2026: productos de lo anulado (para verlos al tocar la anulación)
alter table public.alertas add column if not exists detalle jsonb;

-- Una alerta ya vista nunca vuelve a "no vista" (aunque alguien mande visto_en vacío)
create or replace function public.alertas_guardia() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.visto_en is not null and new.visto_en is null then
    new.visto_en := old.visto_en; new.visto_por := old.visto_por;
  end if;
  new.cambiado_en := now();
  return new;
end $$;
drop trigger if exists alertas_guardia on public.alertas;
create trigger alertas_guardia before insert or update on public.alertas
  for each row execute function public.alertas_guardia();

alter table public.alertas enable row level security;
drop policy if exists al_leer on public.alertas;
drop policy if exists al_agregar on public.alertas;
drop policy if exists al_cambiar on public.alertas;
create policy al_leer    on public.alertas for select to anon, authenticated using (true);
create policy al_agregar on public.alertas for insert to anon, authenticated with check (true);
create policy al_cambiar on public.alertas for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.alertas to anon, authenticated;
