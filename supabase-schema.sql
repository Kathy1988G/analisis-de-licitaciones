-- Tabla de licitaciones
create table licitaciones (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  entidad text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla de documentos
create table documentos (
  id uuid default gen_random_uuid() primary key,
  licitacion_id uuid references licitaciones(id) on delete cascade not null,
  nombre text not null,
  tipo text not null,
  url text not null,
  created_at timestamp with time zone default now()
);

-- Tabla de análisis
create table analisis (
  id uuid default gen_random_uuid() primary key,
  licitacion_id uuid references licitaciones(id) on delete cascade not null,
  tiempos_entrega text,
  garantia text,
  alcance_servicio text,
  especificaciones_tecnicas text,
  logistica text,
  condicion_pago text,
  campos_adicionales jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS policies
alter table licitaciones enable row level security;
alter table documentos enable row level security;
alter table analisis enable row level security;

create policy "Users can manage their own licitaciones"
  on licitaciones for all
  using (auth.uid() = user_id);

create policy "Users can manage documentos of their licitaciones"
  on documentos for all
  using (
    exists (
      select 1 from licitaciones
      where licitaciones.id = documentos.licitacion_id
      and licitaciones.user_id = auth.uid()
    )
  );

create policy "Users can manage analisis of their licitaciones"
  on analisis for all
  using (
    exists (
      select 1 from licitaciones
      where licitaciones.id = analisis.licitacion_id
      and licitaciones.user_id = auth.uid()
    )
  );

-- Storage bucket para documentos
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);

create policy "Users can upload documentos"
  on storage.objects for insert
  with check (bucket_id = 'documentos' and auth.role() = 'authenticated');

create policy "Users can read own documentos"
  on storage.objects for select
  using (bucket_id = 'documentos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documentos"
  on storage.objects for delete
  using (bucket_id = 'documentos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Función para actualizar updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_licitaciones_updated_at
  before update on licitaciones
  for each row execute function update_updated_at();

create trigger update_analisis_updated_at
  before update on analisis
  for each row execute function update_updated_at();
