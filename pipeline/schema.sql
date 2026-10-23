-- Content tables for the pipeline (run once in the Supabase SQL editor)

-- One row per country/city, plus where its content came from
create table public."Locations" (
  location_id     text primary key,               -- map id: 'FR', 'MX-YUC:Valladolid'
  type            text not null check (type in ('country', 'city')),
  country_id      text not null,                  -- ISO code like 'FR'
  wikipedia_title text not null,
  wikidata_id     text,
  revision_id     bigint not null,                -- Wikipedia version
  source_url      text not null,
  license         text not null default 'CC BY-SA 4.0',
  fetched_at      timestamptz not null default now(),
  constraint locations_country_id_check
    check (type <> 'country' or location_id = country_id)  -- a country's map id is its ISO code
);

-- Up to one overview, history, and culture section per location
create table public."LocationSections" (
  location_id text not null references public."Locations" (location_id) on delete cascade,
  category    text not null check (category in ('overview', 'history', 'culture')),
  heading     text,
  text        text not null,
  summary     text,
  word_count  integer not null,
  source_url  text not null,
  primary key (location_id, category)
);

alter table public."Locations" enable row level security;
alter table public."LocationSections" enable row level security;

create policy "Anyone can read locations"
  on public."Locations" for select to anon, authenticated using (true);

create policy "Anyone can read location sections"
  on public."LocationSections" for select to anon, authenticated using (true);
