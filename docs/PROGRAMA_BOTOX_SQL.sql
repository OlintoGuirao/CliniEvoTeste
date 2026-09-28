-- Programa de Botox (CliniEvo)
-- Observação: adiciona `professional_id` para manter multi-tenant (cada profissional vê apenas seus pacientes).
-- Execute no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

-- 1) programas_botox
create table if not exists public.programas_botox (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  paciente_id uuid not null references public.patients(id) on delete cascade,
  data_inicio date not null default current_date,
  status text not null default 'ativo' check (status in ('ativo', 'finalizado')),
  total_sessoes int not null default 2 check (total_sessoes > 0),
  sessoes_realizadas int not null default 0 check (sessoes_realizadas >= 0),
  dia_vencimento smallint check (dia_vencimento is null or (dia_vencimento >= 1 and dia_vencimento <= 31)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Para tabelas já criadas: adicionar coluna dia_vencimento (melhor dia para pagamento, ex: 5 = dia 5)
alter table public.programas_botox add column if not exists dia_vencimento smallint check (dia_vencimento is null or (dia_vencimento >= 1 and dia_vencimento <= 31));

create index if not exists programas_botox_professional_id_idx on public.programas_botox(professional_id);
create index if not exists programas_botox_paciente_id_idx on public.programas_botox(paciente_id);
create unique index if not exists programas_botox_unique_active_per_patient
  on public.programas_botox(professional_id, paciente_id)
  where status = 'ativo';

-- 2) pagamentos
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas_botox(id) on delete cascade,
  valor numeric not null check (valor > 0),
  mes_referencia text not null,
  data_pagamento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Para tabelas já criadas: adicionar coluna mes_referencia (mês que a mensalidade referencia na planilha)
alter table public.pagamentos add column if not exists mes_referencia text;
update public.pagamentos set mes_referencia = to_char(data_pagamento, 'YYYY-MM') where mes_referencia is null;
alter table public.pagamentos alter column mes_referencia set not null;

create index if not exists pagamentos_programa_id_idx on public.pagamentos(programa_id);
create index if not exists pagamentos_data_pagamento_idx on public.pagamentos(data_pagamento);
create index if not exists pagamentos_mes_ref_idx on public.pagamentos(mes_referencia);

-- 3) sessoes
create table if not exists public.sessoes (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas_botox(id) on delete cascade,
  data timestamptz not null default now(),
  mes_referencia text not null,
  created_at timestamptz not null default now()
);

create index if not exists sessoes_programa_id_idx on public.sessoes(programa_id);
create index if not exists sessoes_mes_ref_idx on public.sessoes(mes_referencia);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_programas_botox_updated_at on public.programas_botox;
create trigger trg_programas_botox_updated_at
before update on public.programas_botox
for each row
execute function public.set_updated_at();

-- Trigger: manter sessoes_realizadas sincronizado com tabela sessoes
create or replace function public.sync_programas_botox_sessoes_realizadas()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
  cnt int;
begin
  pid := coalesce(new.programa_id, old.programa_id);
  select count(*) into cnt from public.sessoes where programa_id = pid;
  update public.programas_botox
     set sessoes_realizadas = cnt
   where id = pid;
  return null;
end;
$$;

drop trigger if exists trg_sessoes_sync_count_ins on public.sessoes;
create trigger trg_sessoes_sync_count_ins
after insert on public.sessoes
for each row
execute function public.sync_programas_botox_sessoes_realizadas();

drop trigger if exists trg_sessoes_sync_count_del on public.sessoes;
create trigger trg_sessoes_sync_count_del
after delete on public.sessoes
for each row
execute function public.sync_programas_botox_sessoes_realizadas();

-- RLS
alter table public.programas_botox enable row level security;
alter table public.pagamentos enable row level security;
alter table public.sessoes enable row level security;

-- Programas: apenas o profissional dono
drop policy if exists "programas_botox_select_own" on public.programas_botox;
create policy "programas_botox_select_own"
on public.programas_botox
for select
using (professional_id = auth.uid());

drop policy if exists "programas_botox_insert_own" on public.programas_botox;
create policy "programas_botox_insert_own"
on public.programas_botox
for insert
with check (professional_id = auth.uid());

drop policy if exists "programas_botox_update_own" on public.programas_botox;
create policy "programas_botox_update_own"
on public.programas_botox
for update
using (professional_id = auth.uid())
with check (professional_id = auth.uid());

drop policy if exists "programas_botox_delete_own" on public.programas_botox;
create policy "programas_botox_delete_own"
on public.programas_botox
for delete
using (professional_id = auth.uid());

-- Pagamentos: via join com programas_botox (mesmo professional_id)
drop policy if exists "pagamentos_select_own" on public.pagamentos;
create policy "pagamentos_select_own"
on public.pagamentos
for select
using (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = pagamentos.programa_id
      and pb.professional_id = auth.uid()
  )
);

drop policy if exists "pagamentos_insert_own" on public.pagamentos;
create policy "pagamentos_insert_own"
on public.pagamentos
for insert
with check (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = pagamentos.programa_id
      and pb.professional_id = auth.uid()
  )
);

drop policy if exists "pagamentos_delete_own" on public.pagamentos;
create policy "pagamentos_delete_own"
on public.pagamentos
for delete
using (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = pagamentos.programa_id
      and pb.professional_id = auth.uid()
  )
);

-- Sessões: via join com programas_botox (mesmo professional_id)
drop policy if exists "sessoes_select_own" on public.sessoes;
create policy "sessoes_select_own"
on public.sessoes
for select
using (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = sessoes.programa_id
      and pb.professional_id = auth.uid()
  )
);

drop policy if exists "sessoes_insert_own" on public.sessoes;
create policy "sessoes_insert_own"
on public.sessoes
for insert
with check (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = sessoes.programa_id
      and pb.professional_id = auth.uid()
  )
);

drop policy if exists "sessoes_delete_own" on public.sessoes;
create policy "sessoes_delete_own"
on public.sessoes
for delete
using (
  exists (
    select 1 from public.programas_botox pb
    where pb.id = sessoes.programa_id
      and pb.professional_id = auth.uid()
  )
);

