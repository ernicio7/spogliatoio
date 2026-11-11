-- =====================================================================
-- Schema del sito. Da eseguire UNA volta nel SQL Editor di Supabase.
-- Non contiene dati personali: quelli vanno caricati a parte.
-- =====================================================================

-- ---------- Ruoli ----------------------------------------------------
create table if not exists public.profili (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  ruolo     text not null check (ruolo in ('owner', 'festeggiato')),
  email     text,
  creato_il timestamptz not null default now()
);
-- Un solo owner e un solo festeggiato alla volta
create unique index if not exists un_solo_owner       on public.profili (ruolo) where ruolo = 'owner';
create unique index if not exists un_solo_festeggiato on public.profili (ruolo) where ruolo = 'festeggiato';

create or replace function public.e_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where user_id = auth.uid());
$$;

create or replace function public.e_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where user_id = auth.uid() and ruolo = 'owner');
$$;

alter table public.profili enable row level security;
drop policy if exists "leggo il mio profilo" on public.profili;
create policy "leggo il mio profilo" on public.profili
  for select to authenticated using (user_id = auth.uid() or public.e_owner());
-- Inserimenti e modifiche dei profili solo dalle funzioni lato server.

-- ---------- Configurazione del sito ----------------------------------
create table if not exists public.config_sito (
  chiave text primary key,
  valore text not null
);
alter table public.config_sito enable row level security;
drop policy if exists "membri leggono config" on public.config_sito;
create policy "membri leggono config" on public.config_sito
  for select to authenticated using (public.e_membro());
drop policy if exists "owner modifica config" on public.config_sito;
create policy "owner modifica config" on public.config_sito
  for all to authenticated using (public.e_owner()) with check (public.e_owner());

-- ---------- Impostazioni e progressi (una riga per persona) ---------
create table if not exists public.impostazioni (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nomenclatura    text not null default 'calcio' check (nomenclatura in ('calcio', 'originale')),
  tema            text not null default 'notte',
  sfondo          text,
  widget          jsonb not null default '[]'::jsonb,
  ordine_icone    jsonb not null default '[]'::jsonb,
  sequenza_hash   text,
  apertura_vista  boolean not null default false,
  benvenuto_visto boolean not null default false,
  aggiornato_il   timestamptz not null default now()
);
create table if not exists public.progressi (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  trofei        jsonb not null default '{}'::jsonb,
  catena        jsonb not null default '{}'::jsonb,
  indizi        jsonb not null default '{}'::jsonb,
  triplete_visto boolean not null default false,
  aggiornato_il timestamptz not null default now()
);
alter table public.impostazioni enable row level security;
alter table public.progressi    enable row level security;
drop policy if exists "le mie impostazioni" on public.impostazioni;
create policy "le mie impostazioni" on public.impostazioni
  for all to authenticated
  using (user_id = auth.uid() and public.e_membro())
  with check (user_id = auth.uid() and public.e_membro());
drop policy if exists "i miei progressi" on public.progressi;
create policy "i miei progressi" on public.progressi
  for all to authenticated
  using (user_id = auth.uid() and public.e_membro())
  with check (user_id = auth.uid() and public.e_membro());

-- ---------- Contenuti condivisi del sito ----------------------------
create table if not exists public.auto (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  anno      int,
  colore    text,
  note      text,
  foto      text,
  creato_il timestamptz not null default now()
);
create table if not exists public.giochi (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  note      text,
  foto      text,
  iniziale  boolean not null default false,
  creato_il timestamptz not null default now()
);
create table if not exists public.dispositivi (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('pc', 'smartphone')),
  marca       text,
  modello     text not null,
  dal         text,
  al          text,
  stato       text not null default 'in_uso',
  nota_stato  text,
  modifiche   text,
  specifiche  jsonb not null default '{}'::jsonb,
  foto        text,
  creato_il   timestamptz not null default now()
);
create table if not exists public.partite (
  id           uuid primary key default gen_random_uuid(),
  data         date not null,
  competizione text,
  casa         text not null,
  trasferta    text not null,
  gol_casa     int,
  gol_trasferta int,
  stadio       text,
  dove_vista   text,
  con_chi      text,
  voto         int check (voto between 1 and 10),
  ricordo      text,
  della_vita   boolean not null default false,
  creato_il    timestamptz not null default now()
);
create table if not exists public.foto (
  id        uuid primary key default gen_random_uuid(),
  percorso  text not null unique,
  origine   text not null check (origine in ('owner', 'ospite', 'festeggiato')),
  creato_il timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['auto', 'giochi', 'dispositivi', 'partite', 'foto'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membri" on public.%I', t);
    execute format(
      'create policy "membri" on public.%I for all to authenticated using (public.e_membro()) with check (public.e_membro())', t);
  end loop;
end $$;

-- ---------- Link ospiti (solo owner) --------------------------------
create table if not exists public.link_ospiti (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  attivato_il timestamptz not null default now(),
  scade_il    timestamptz not null default now() + interval '48 hours',
  attivo      boolean not null default true
);
alter table public.link_ospiti enable row level security;
drop policy if exists "solo owner" on public.link_ospiti;
create policy "solo owner" on public.link_ospiti
  for all to authenticated using (public.e_owner()) with check (public.e_owner());

-- ---------- Chiavi API personali: nessun accesso dal browser ---------
create table if not exists public.segreti_utente (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  anthropic_key text not null,
  aggiornato_il timestamptz not null default now()
);
alter table public.segreti_utente enable row level security;
-- Nessuna policy: solo le funzioni lato server (service role) possono leggerla.
revoke all on public.segreti_utente from anon, authenticated;

-- ---------- Trasferimento del sito (solo funzioni lato server) -------
create or replace function public.trasferisci_sito(vecchio uuid, nuovo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profili where user_id = vecchio and ruolo = 'owner') then
    raise exception 'Il richiedente non è owner';
  end if;
  if not exists (select 1 from public.profili where user_id = nuovo and ruolo = 'festeggiato') then
    raise exception 'Nessun festeggiato a cui trasferire';
  end if;
  delete from public.profili where user_id = vecchio;
  update public.profili set ruolo = 'owner' where user_id = nuovo;
end $$;
revoke execute on function public.trasferisci_sito(uuid, uuid) from public, anon, authenticated;
grant execute on function public.trasferisci_sito(uuid, uuid) to service_role;

-- ---------- Spazio foto privato --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "membri leggono foto"   on storage.objects;
drop policy if exists "membri caricano foto"  on storage.objects;
drop policy if exists "membri aggiornano foto" on storage.objects;
drop policy if exists "membri cancellano foto" on storage.objects;
create policy "membri leggono foto" on storage.objects
  for select to authenticated using (bucket_id = 'foto' and public.e_membro());
create policy "membri caricano foto" on storage.objects
  for insert to authenticated with check (bucket_id = 'foto' and public.e_membro());
create policy "membri aggiornano foto" on storage.objects
  for update to authenticated using (bucket_id = 'foto' and public.e_membro());
create policy "membri cancellano foto" on storage.objects
  for delete to authenticated using (bucket_id = 'foto' and public.e_membro());
