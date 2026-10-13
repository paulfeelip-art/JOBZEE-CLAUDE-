-- Jobzee core schema
-- Money is stored as integer bani. Geography uses WGS84 (SRID 4326).
-- Clients and Jobzers never write tasks directly: every state change goes
-- through the security-definer functions in 20261013000002_functions.sql.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.task_status as enum (
  'draft', 'searching', 'matched', 'confirmed', 'en_route', 'in_progress',
  'awaiting_confirmation', 'completed', 'cancelled', 'disputed'
);
create type public.pricing_mode as enum ('fixed', 'hourly', 'quote');
create type public.legal_form as enum ('persoana_fizica', 'pfa', 'ii', 'srl');
create type public.skill_level as enum ('incepator', 'experimentat', 'calificat');
create type public.offer_status as enum ('sent', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.review_role as enum ('client', 'jobzer');
create type public.doc_kind as enum ('service_invoice', 'work_invoice', 'receipt', 'commission_invoice');
create type public.cert_status as enum ('pending', 'verified', 'rejected');

-- ---------------------------------------------------------------- people
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  phone_e164 text unique check (phone_e164 ~ '^\+40\d{9}$'),
  phone_verified boolean not null default false,
  area_label text not null default '' check (char_length(area_label) <= 80),
  is_ops boolean not null default false,
  billing_company text check (char_length(billing_company) <= 120),
  billing_cui text check (char_length(billing_cui) <= 16),
  billing_address text check (char_length(billing_address) <= 200),
  created_at timestamptz not null default now()
);
comment on column public.profiles.is_ops is 'Jobzee operations staff. Set only by service role.';

create table public.jobzers (
  id uuid primary key references public.profiles (id) on delete cascade,
  legal_form public.legal_form not null default 'persoana_fizica',
  company_name text check (char_length(company_name) <= 120),
  cui text check (char_length(cui) <= 16),
  bio text not null default '' check (char_length(bio) <= 300),
  languages text[] not null default array['Română'],
  tools text[] not null default '{}',
  vehicle text not null default '' check (char_length(vehicle) <= 60),
  radius_km int not null default 3 check (radius_km between 1 and 25),
  available boolean not null default false,
  location geography (point, 4326),
  location_at timestamptz,
  id_verified boolean not null default false,
  background_checked boolean not null default false,
  insured boolean not null default false,
  payout_account_id text, -- Stripe Connect account id, set by the backend
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index jobzers_location_gix on public.jobzers using gist (location);

create table public.jobzer_skills (
  jobzer_id uuid not null references public.jobzers (id) on delete cascade,
  category text not null,
  level public.skill_level not null default 'incepator',
  years int not null default 1 check (years between 0 and 60),
  primary key (jobzer_id, category)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  jobzer_id uuid not null references public.jobzers (id) on delete cascade,
  category text not null,
  name text not null check (char_length(name) <= 120),
  issuer text not null default '',
  file_path text not null, -- storage object in the private "certificates" bucket
  status public.cert_status not null default 'pending',
  expires_on date,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id),
  jobzer_id uuid references public.jobzers (id),
  status public.task_status not null default 'draft',
  title text not null check (char_length(title) between 3 and 60),
  category text not null,
  details text[] not null default '{}',
  photo_paths text[] not null default '{}',
  ai_notes text not null default '',
  people int not null default 1 check (people between 1 and 4),
  area_label text not null default '',
  approx_location geography (point, 4326) not null, -- rounded, shown in offers
  scheduled_for timestamptz, -- null = as soon as possible
  pricing_mode public.pricing_mode not null default 'fixed',
  price_bani int check (price_bani > 0),
  rate_bani int check (rate_bani > 0),
  max_hours int check (max_hours between 1 and 12),
  hold_bani int not null default 0, -- authorised on the card
  service_bani int not null default 0,
  final_price_bani int, -- what is captured at completion
  min_tier int not null default 0 check (min_tier between 0 and 3),
  need_invoice boolean not null default false,
  invoice_cui text,
  payment_intent_id text,
  payment_status text not null default 'none', -- none | requires_action | authorised | captured | cancelled | refunded
  cancel_fee_bani int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  confirmed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index tasks_client_idx on public.tasks (client_id, created_at desc);
create index tasks_jobzer_idx on public.tasks (jobzer_id, created_at desc);
create index tasks_status_idx on public.tasks (status);

-- Precise address: client always, Jobzer only once confirmed.
create table public.task_addresses (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  address text not null check (char_length(address) <= 200),
  location geography (point, 4326) not null,
  access_notes text not null default '' check (char_length(access_notes) <= 300)
);

-- Start code: client only.
create table public.task_codes (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  start_code text not null check (start_code ~ '^\d{4}$')
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  jobzer_id uuid not null references public.jobzers (id) on delete cascade,
  status public.offer_status not null default 'sent',
  net_bani int not null, -- what the Jobzer would earn, shown in the offer
  distance_m int not null,
  question text check (char_length(question) <= 200),
  answer text check (char_length(answer) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '45 seconds',
  responded_at timestamptz,
  unique (task_id, jobzer_id)
);
create index offers_jobzer_idx on public.offers (jobzer_id, status);

create table public.task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid,
  actor text not null, -- client | jobzer | system | ops
  from_status public.task_status,
  to_status public.task_status,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, id);

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 300),
  amount_bani int not null check (amount_bani > 0),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_task_idx on public.messages (task_id, id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  subject_id uuid not null references public.profiles (id),
  author_role public.review_role not null,
  stars int not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  body text not null default '' check (char_length(body) <= 600),
  reply text check (char_length(reply) <= 300),
  published boolean not null default false, -- double-blind: true when both sides reviewed or after 14 days
  disputed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task_id, author_id)
);
create index reviews_subject_idx on public.reviews (subject_id) where published;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind public.doc_kind not null,
  issuer text not null,
  recipient_id uuid not null references public.profiles (id),
  number text,
  amount_bani int not null,
  file_path text,
  created_at timestamptz not null default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete set null,
  reporter_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('safety', 'damage', 'no_show', 'quality', 'payment', 'review', 'other')),
  severity int not null default 2 check (severity between 1 and 3),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.favourites (
  client_id uuid not null references public.profiles (id) on delete cascade,
  jobzer_id uuid not null references public.jobzers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, jobzer_id)
);

-- ---------------------------------------------------------------- stats and public view
create view public.jobzer_stats as
select
  j.id as jobzer_id,
  count(t.id) filter (where t.status = 'completed')::int as done,
  coalesce(round(avg(r.stars)::numeric, 2), 0)::float8 as rating,
  count(r.id)::int as review_count,
  coalesce(round(100.0 * count(t.id) filter (where t.status = 'completed' and t.started_at <= coalesce(t.scheduled_for, t.confirmed_at) + interval '15 minutes')
    / nullif(count(t.id) filter (where t.status = 'completed'), 0)), 100)::int as on_time_pct,
  count(t.id) filter (where t.status = 'cancelled' and t.jobzer_id = j.id and exists (
    select 1 from public.task_events e where e.task_id = t.id and e.to_status = 'cancelled' and e.actor = 'jobzer'))::int as jobzer_cancellations
from public.jobzers j
left join public.tasks t on t.jobzer_id = j.id
left join public.reviews r on r.subject_id = j.id and r.published and r.author_role = 'client' and r.task_id = t.id
group by j.id;

create or replace function public.tier_index(done int, rating float8, on_time int, id_ok boolean, insured boolean)
returns int language sql immutable as $$
  select case
    when done >= 150 and rating >= 4.9 and on_time >= 97 and id_ok and insured then 3
    when done >= 50 and rating >= 4.8 and on_time >= 95 and id_ok then 2
    when done >= 10 and rating >= 4.6 and on_time >= 90 then 1
    else 0 end
$$;
comment on function public.tier_index is 'Mirror of packages/shared/src/tiers.ts. Keep both in sync (tested in supabase/tests).';

-- What anyone signed in may see about a Jobzer. No phone, no exact location, no payout data.
create view public.jobzer_public as
select
  p.id, p.display_name, j.legal_form, j.company_name, j.cui,
  (j.legal_form <> 'persoana_fizica') as issues_invoice,
  j.bio, j.languages, j.tools, j.vehicle, j.id_verified, j.insured, j.background_checked,
  s.done, s.rating, s.review_count, s.on_time_pct,
  public.tier_index(s.done, s.rating, s.on_time_pct, j.id_verified, j.insured) as tier,
  p.created_at as member_since
from public.jobzers j
join public.profiles p on p.id = j.id
join public.jobzer_stats s on s.jobzer_id = j.id;

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
