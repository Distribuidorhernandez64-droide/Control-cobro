-- Rutas en archivo (.kml) para mandar por WhatsApp desde Android (23/11/2026).
-- Bucket público 'rutas': el enlace abre el archivo sin entrar a Cobros. Solo usuarios con sesión suben, ven la lista y borran.
-- Cobros borra solo los archivos de más de 7 días cada vez que sube uno.
insert into storage.buckets (id, name, public) values ('rutas', 'rutas', true)
on conflict (id) do nothing;
create policy "rutas subir" on storage.objects for insert to authenticated with check (bucket_id = 'rutas');
create policy "rutas ver" on storage.objects for select to authenticated using (bucket_id = 'rutas');
create policy "rutas borrar" on storage.objects for delete to authenticated using (bucket_id = 'rutas');
