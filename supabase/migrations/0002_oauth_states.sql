-- El `state` del flujo OAuth con Deputy.
--
-- Antes vivia en un Set en memoria (server/deputy/oauth.ts). Eso funciona con
-- un solo proceso, pero en serverless el callback de Deputy cae casi siempre en
-- una instancia distinta de la que emitio el state, y el login falla siempre.

create table if not exists oauth_states (
  state       text primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists oauth_states_expires_idx on oauth_states (expires_at);

alter table oauth_states enable row level security;
