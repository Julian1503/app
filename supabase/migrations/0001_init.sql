-- Esquema inicial de Horas. Reemplaza los archivos de data/*.json.
--
-- No hay autenticacion todavia: el servidor entra con la service_role key, que
-- salta RLS. Igual se habilita RLS sin politicas en todas las tablas para que
-- la anon key no pueda leer nada si algun dia el front pega directo a Supabase.

-- ---------------------------------------------------------------- turnos ----

create table if not exists shifts (
  id                text primary key,
  source            text not null check (source in ('timesheet', 'roster')),
  -- Dia de reloj en que arranca el turno.
  date              date not null,
  -- Minutos desde la medianoche de `date`. El fin puede pasar 1440 si cruza.
  start_minute      integer not null check (start_minute >= 0),
  end_minute        integer not null check (end_minute >= 0),
  area              text,
  employee_comment  text,
  approved          boolean not null default false,
  km_declared       numeric(8, 2),
  -- Marca de la corrida de sync que lo escribio. Sirve para borrar los turnos
  -- que Deputy ya no devuelve sin vaciar la tabla primero.
  synced_at         timestamptz not null default now()
);

create index if not exists shifts_date_idx on shifts (date);

-- Estado del ultimo sync. Una sola fila: el check sobre la PK lo garantiza.
create table if not exists sync_state (
  id            boolean primary key default true check (id),
  last_sync_at  timestamptz,
  range_from    date,
  range_to      date
);

-- ---------------------------------------------------------------- tokens ----

-- El sobre cifrado de los tokens de Deputy, tal cual lo produce
-- server/store/tokens.ts. La clave se sigue derivando del DEPUTY_CLIENT_SECRET
-- del .env: un dump de esta tabla por si solo no sirve para nada.
create table if not exists deputy_tokens (
  id          boolean primary key default true check (id),
  v           smallint not null,
  iv          text not null,
  tag         text not null,
  data        text not null,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- calendario ----

-- Feriados del lugar de trabajo. Se editan a mano (antes en holidays.json,
-- ahora en el table editor de Supabase): los regionales como el Toowoomba Show
-- Day cambian de fecha todos los años y no hay forma de calcularlos.
create table if not exists holidays (
  date       date primary key,
  label      text not null,
  -- true cuando la fecha esta corroborada por un payslip.
  confirmed  boolean not null default false
);

create table if not exists term_breaks (
  start_date  date not null,
  end_date    date not null,
  label       text,
  primary key (start_date, end_date),
  constraint term_breaks_range check (end_date >= start_date)
);

-- -------------------------------------------------------------- payslips ----

-- Un payslip por periodo de pago. `lines` y `back_pay` van en JSONB porque
-- nadie consulta por linea: el codigo las recorre entera en Node (ver
-- ordinaryRateOf y inferSleepoverCounts en server/payslips/load.ts).
create table if not exists payslips (
  period_start         date not null,
  period_end           date not null,
  -- PDF del que salio. Informativo: los PDF no se guardan.
  file                 text not null,
  payment_date         date,
  total_earnings       numeric(10, 2) not null default 0,
  net_pay              numeric(10, 2) not null default 0,
  lines                jsonb not null default '[]'::jsonb,
  paid_hours           numeric(8, 2) not null default 0,
  sleepover_count      integer not null default 0,
  sleepover_amount     numeric(10, 2) not null default 0,
  travel_costs_paid    numeric(10, 2) not null default 0,
  night_hours          numeric(8, 2) not null default 0,
  tax_withheld         numeric(10, 2) not null default 0,
  superannuation       numeric(10, 2) not null default 0,
  bank_payment         numeric(10, 2) not null default 0,
  back_pay             jsonb,
  arithmetic_mismatch  boolean not null default false,
  imported_at          timestamptz not null default now(),
  primary key (period_start, period_end)
);

-- ------------------------------------------------------- reportes de turno ----

-- Hablan de la salud de una persona identificable. Antes el archivo se escribia
-- con permisos 0600; aca el equivalente es que solo la service_role entra.
create table if not exists shift_reports (
  shift_id           text primary key,
  date               date not null,
  observations       jsonb not null default '[]'::jsonb,
  presentation_tags  jsonb not null default '[]'::jsonb,
  presentation       text not null default '',
  support            text not null default '',
  form_answers       jsonb not null default '[]'::jsonb,
  gaps               jsonb not null default '[]'::jsonb,
  draft              text,
  drafted_at         timestamptz,
  status             text not null default 'pending'
                       check (status in ('pending', 'drafted', 'submitted')),
  updated_at         timestamptz not null default now()
);

create index if not exists shift_reports_date_idx on shift_reports (date);

-- ------------------------------------------------------------------- RLS ----

-- Sin politicas: nadie entra salvo la service_role, que salta RLS por diseño.
alter table shifts         enable row level security;
alter table sync_state     enable row level security;
alter table deputy_tokens  enable row level security;
alter table holidays       enable row level security;
alter table term_breaks    enable row level security;
alter table payslips       enable row level security;
alter table shift_reports  enable row level security;
