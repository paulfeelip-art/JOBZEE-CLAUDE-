-- Jobzee business functions. All state changes happen here, with the caller
-- checked against auth.uid(). Mirrors packages/shared (fees, lifecycle, tiers).

-- ---------------------------------------------------------------- helpers
create or replace function public.fee_service(price int) returns int language sql immutable as $$
  select least(round(price * 0.049)::int, 2500)
$$;
create or replace function public.fee_commission(price int) returns int language sql immutable as $$
  select round(price * 0.12)::int
$$;
create or replace function public.hourly_charge(rate int, minutes int, max_hours int) returns int language sql immutable as $$
  select least(round(rate * ceil(greatest(minutes, 0) / 15.0) / 4.0)::int, rate * max_hours)
$$;

create or replace function public.is_ops() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_ops from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_service() returns boolean language sql stable as $$
  select coalesce(auth.role() = 'service_role', false)
$$;

create or replace function public.has_contact_details(t text) returns boolean language sql immutable as $$
  select t ~* '(\+?4?0|0)\s?7[0-9]([ .-]?[0-9]){7}'
      or t ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]+'
      or t ~* '(https?://|www\.)'
      or t ~* '(whats ?app|telegram|signal)'
$$;

-- Allowed transitions. Same table as packages/shared/src/lifecycle.ts (checked by tests).
create table public.task_transitions (
  from_status public.task_status not null,
  to_status public.task_status not null,
  actor text not null,
  primary key (from_status, to_status, actor)
);
insert into public.task_transitions values
  ('draft','searching','client'), ('draft','cancelled','client'),
  ('searching','matched','jobzer'), ('searching','matched','system'),
  ('searching','cancelled','client'), ('searching','cancelled','system'),
  ('matched','confirmed','client'), ('matched','searching','client'), ('matched','searching','system'),
  ('matched','cancelled','client'), ('matched','cancelled','jobzer'),
  ('confirmed','en_route','jobzer'), ('confirmed','cancelled','client'), ('confirmed','cancelled','jobzer'), ('confirmed','cancelled','ops'),
  ('en_route','in_progress','jobzer'), ('en_route','cancelled','client'), ('en_route','cancelled','jobzer'), ('en_route','cancelled','ops'),
  ('in_progress','awaiting_confirmation','jobzer'), ('in_progress','disputed','client'), ('in_progress','disputed','jobzer'),
  ('awaiting_confirmation','completed','client'), ('awaiting_confirmation','completed','system'), ('awaiting_confirmation','disputed','client'),
  ('disputed','completed','ops'), ('disputed','cancelled','ops');

-- Locks the task, checks the transition and logs it. Returns the locked row.
create or replace function public._move(p_task uuid, p_to public.task_status, p_actor text, p_note text default '')
returns public.tasks language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_from public.task_status;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  v_from := t.status;
  if not exists (select 1 from public.task_transitions where from_status = t.status and to_status = p_to and actor = p_actor) then
    raise exception 'transition_not_allowed: % -> % by %', t.status, p_to, p_actor using errcode = 'P0001';
  end if;
  update public.tasks set status = p_to where id = p_task returning * into t;
  insert into public.task_events (task_id, actor_id, actor, from_status, to_status, note)
  values (p_task, auth.uid(), p_actor, v_from, p_to, p_note);
  return t;
end $$;

create or replace function public._require_client(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.client_id is distinct from auth.uid() then raise exception 'not_your_task' using errcode = '42501'; end if;
  return t;
end $$;

create or replace function public._require_jobzer(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.jobzer_id is distinct from auth.uid() then raise exception 'not_your_task' using errcode = '42501'; end if;
  return t;
end $$;

-- ---------------------------------------------------------------- client: create and publish
create or replace function public.create_task(
  p_title text, p_category text, p_details text[], p_ai_notes text, p_people int,
  p_area_label text, p_lat float8, p_lng float8, p_address text, p_access_notes text,
  p_scheduled_for timestamptz, p_pricing_mode public.pricing_mode,
  p_price_bani int, p_rate_bani int, p_max_hours int,
  p_min_tier int default 0, p_need_invoice boolean default false, p_invoice_cui text default null,
  p_photo_paths text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_hold int;
  v_point geography;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not coalesce((select phone_verified from public.profiles where id = auth.uid()), false) then
    raise exception 'phone_not_verified' using errcode = 'P0001';
  end if;
  if p_lat not between 43.5 and 48.4 or p_lng not between 20.2 and 29.8 then
    raise exception 'outside_romania' using errcode = 'P0001';
  end if;
  if p_scheduled_for is not null and p_scheduled_for < now() - interval '5 minutes' then
    raise exception 'scheduled_in_past' using errcode = 'P0001';
  end if;
  if p_need_invoice and coalesce(p_invoice_cui, '') = '' then
    raise exception 'invoice_cui_required' using errcode = 'P0001';
  end if;
  v_hold := case p_pricing_mode
    when 'fixed' then p_price_bani
    when 'hourly' then p_rate_bani * p_max_hours
    else coalesce(p_price_bani, 6000) end;
  if v_hold is null or v_hold < 2000 or v_hold > 500000 then
    raise exception 'price_out_of_range' using errcode = 'P0001'; -- 20 to 5.000 lei in the pilot
  end if;
  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  insert into public.tasks (client_id, title, category, details, ai_notes, people, area_label, approx_location,
    scheduled_for, pricing_mode, price_bani, rate_bani, max_hours, hold_bani, service_bani,
    min_tier, need_invoice, invoice_cui, photo_paths)
  values (auth.uid(), p_title, p_category, coalesce(p_details, '{}'), coalesce(p_ai_notes, ''), coalesce(p_people, 1), coalesce(p_area_label, ''),
    -- approx location: snapped to a ~300 m grid so offers never reveal the building
    st_setsrid(st_makepoint(round(p_lng::numeric / 0.004) * 0.004, round(p_lat::numeric / 0.003) * 0.003), 4326)::geography,
    p_scheduled_for, p_pricing_mode, p_price_bani, p_rate_bani, p_max_hours, v_hold, public.fee_service(v_hold),
    coalesce(p_min_tier, 0), coalesce(p_need_invoice, false), p_invoice_cui, coalesce(p_photo_paths, '{}'))
  returning id into v_id;
  insert into public.task_addresses (task_id, address, location, access_notes) values (v_id, p_address, v_point, coalesce(p_access_notes, ''));
  insert into public.task_codes (task_id, start_code) values (v_id, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'));
  insert into public.task_events (task_id, actor_id, actor, to_status, note) values (v_id, auth.uid(), 'client', 'draft', 'created');
  return v_id;
end $$;

-- Sends offers to the next best Jobzers. Returns how many offers were sent.
create or replace function public._match_offers(p_task uuid, p_batch int default 3)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare t public.tasks; n int;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.status <> 'searching' then return 0; end if;
  with candidates as (
    select j.id, st_distance(j.location, t.approx_location)::int as dist
    from public.jobzers j
    join public.jobzer_public jp on jp.id = j.id
    join public.jobzer_skills s on s.jobzer_id = j.id and s.category = t.category
    where j.available
      and j.payouts_enabled
      and j.id <> t.client_id
      and j.location is not null
      and j.location_at > now() - interval '15 minutes'
      and st_dwithin(j.location, t.approx_location, j.radius_km * 1000)
      and jp.tier >= t.min_tier
      and (not t.need_invoice or j.legal_form <> 'persoana_fizica')
      and not exists (select 1 from public.offers o where o.task_id = t.id and o.jobzer_id = j.id)
    order by jp.tier desc, dist asc
    limit p_batch
  )
  insert into public.offers (task_id, jobzer_id, net_bani, distance_m)
  select t.id, c.id, t.hold_bani - public.fee_commission(t.hold_bani), c.dist from candidates c;
  get diagnostics n = row_count;
  return n;
end $$;

-- Client (or the backend) asks for more candidates, e.g. after offers expired.
create or replace function public.match_offers(p_task uuid, p_batch int default 3)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_service() or exists (select 1 from public.tasks where id = p_task and client_id = auth.uid())) then
    raise exception 'not_your_task' using errcode = '42501';
  end if;
  return public._match_offers(p_task, least(greatest(p_batch, 1), 5));
end $$;

create or replace function public.publish_task(p_task uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_client(p_task);
  perform public._move(p_task, 'searching', 'client', 'published');
  update public.tasks set published_at = now() where id = p_task;
  return public._match_offers(p_task, 3);
end $$;

-- ---------------------------------------------------------------- Jobzer: availability and offers
create or replace function public.become_jobzer() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  insert into public.jobzers (id) values (auth.uid()) on conflict (id) do nothing;
end $$;

create or replace function public.set_availability(p_available boolean, p_lat float8 default null, p_lng float8 default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare j public.jobzers;
begin
  select * into j from public.jobzers where id = auth.uid();
  if not found then raise exception 'not_a_jobzer' using errcode = '42501'; end if;
  if p_available and not (j.id_verified and j.payouts_enabled) then
    raise exception 'verification_incomplete' using errcode = 'P0001';
  end if;
  update public.jobzers set
    available = p_available,
    location = case when p_lat is null then location else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end,
    location_at = case when p_lat is null then location_at else now() end
  where id = auth.uid();
end $$;

-- Declining never affects levels or future offers.
create or replace function public.respond_offer(p_offer uuid, p_accept boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare o public.offers; t public.tasks;
begin
  select * into o from public.offers where id = p_offer for update;
  if not found or o.jobzer_id <> auth.uid() then raise exception 'not_your_offer' using errcode = '42501'; end if;
  if o.status <> 'sent' then raise exception 'offer_closed' using errcode = 'P0001'; end if;
  if o.expires_at < now() then
    update public.offers set status = 'expired' where id = p_offer;
    perform public._match_offers(o.task_id, 1);
    return false;
  end if;
  if not p_accept then
    update public.offers set status = 'declined', responded_at = now() where id = p_offer;
    if not exists (select 1 from public.offers where task_id = o.task_id and status = 'sent') then
      perform public._match_offers(o.task_id, 3);
    end if;
    return false;
  end if;
  select * into t from public.tasks where id = o.task_id for update;
  if t.status <> 'searching' then
    update public.offers set status = 'withdrawn', responded_at = now() where id = p_offer;
    return false;
  end if;
  perform public._move(o.task_id, 'matched', 'jobzer', 'offer accepted');
  update public.tasks set jobzer_id = auth.uid() where id = o.task_id;
  update public.offers set status = 'accepted', responded_at = now() where id = p_offer;
  update public.offers set status = 'withdrawn' where task_id = o.task_id and id <> p_offer and status = 'sent';
  return true;
end $$;

create or replace function public.ask_on_offer(p_offer uuid, p_question text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer;
  if not found or o.jobzer_id <> auth.uid() or o.status <> 'sent' then raise exception 'not_your_offer' using errcode = '42501'; end if;
  if public.has_contact_details(p_question) then raise exception 'contact_details_not_allowed' using errcode = 'P0001'; end if;
  update public.offers set question = p_question, expires_at = greatest(expires_at, now() + interval '3 minutes') where id = p_offer;
end $$;

create or replace function public.answer_offer_question(p_offer uuid, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.offers;
begin
  select * into o from public.offers where id = p_offer;
  if not found then raise exception 'offer_not_found' using errcode = 'P0002'; end if;
  perform public._require_client(o.task_id);
  if public.has_contact_details(p_answer) then raise exception 'contact_details_not_allowed' using errcode = 'P0001'; end if;
  update public.offers set answer = p_answer where id = p_offer;
end $$;

-- Client does not want the matched Jobzer: back to searching, next candidates.
create or replace function public.reject_match(p_task uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_client(p_task);
  perform public._move(p_task, 'searching', 'client', 'client asked for another Jobzer');
  update public.offers set status = 'withdrawn' where task_id = p_task and status = 'accepted';
  update public.tasks set jobzer_id = null where id = p_task;
  return public._match_offers(p_task, 3);
end $$;

-- ---------------------------------------------------------------- payment hooks (service role only)
create or replace function public.mark_payment_authorised(p_task uuid, p_intent text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service() then raise exception 'service_only' using errcode = '42501'; end if;
  perform public._move(p_task, 'confirmed', 'client', 'payment authorised');
  update public.tasks set payment_intent_id = p_intent, payment_status = 'authorised', confirmed_at = now() where id = p_task;
end $$;

create or replace function public.mark_payment_status(p_task uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service() then raise exception 'service_only' using errcode = '42501'; end if;
  if p_status not in ('requires_action', 'authorised', 'captured', 'cancelled', 'refunded', 'failed') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  update public.tasks set payment_status = p_status where id = p_task;
end $$;

-- ---------------------------------------------------------------- Jobzer: doing the work
create or replace function public.jobzer_depart(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_jobzer(p_task);
  perform public._move(p_task, 'en_route', 'jobzer', 'left for the address');
end $$;

create or replace function public.start_task(p_task uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_jobzer(p_task);
  if not exists (select 1 from public.task_codes where task_id = p_task and start_code = p_code) then
    insert into public.task_events (task_id, actor_id, actor, note) values (p_task, auth.uid(), 'jobzer', 'wrong start code');
    return false;
  end if;
  perform public._move(p_task, 'in_progress', 'jobzer', 'started with code');
  update public.tasks set started_at = now() where id = p_task;
  return true;
end $$;

create or replace function public.propose_extra(p_task uuid, p_title text, p_description text, p_amount int) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v uuid;
begin
  t := public._require_jobzer(p_task);
  if t.status <> 'in_progress' then raise exception 'not_in_progress' using errcode = 'P0001'; end if;
  insert into public.extras (task_id, title, description, amount_bani) values (p_task, p_title, coalesce(p_description, ''), p_amount) returning id into v;
  return v;
end $$;

create or replace function public.respond_extra(p_extra uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e public.extras;
begin
  select * into e from public.extras where id = p_extra for update;
  if not found then raise exception 'extra_not_found' using errcode = 'P0002'; end if;
  perform public._require_client(e.task_id);
  if e.status <> 'proposed' then raise exception 'extra_closed' using errcode = 'P0001'; end if;
  update public.extras set status = case when p_approve then 'approved' else 'declined' end where id = p_extra;
end $$;

create or replace function public.finish_task(p_task uuid) returns int
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_extras int; v_final int;
begin
  t := public._require_jobzer(p_task);
  select coalesce(sum(amount_bani), 0) into v_extras from public.extras where task_id = p_task and status = 'approved';
  v_final := case t.pricing_mode
    when 'hourly' then public.hourly_charge(t.rate_bani, (extract(epoch from now() - t.started_at) / 60)::int, t.max_hours)
    else coalesce(t.price_bani, t.hold_bani) end + v_extras;
  perform public._move(p_task, 'awaiting_confirmation', 'jobzer', 'work finished');
  update public.tasks set finished_at = now(), final_price_bani = v_final where id = p_task;
  return v_final;
end $$;

-- ---------------------------------------------------------------- completion, cancellation, disputes
create or replace function public.complete_task(p_task uuid) returns int
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  perform public._require_client(p_task);
  t := public._move(p_task, 'completed', 'client', 'client confirmed');
  update public.tasks set completed_at = now() where id = p_task;
  return t.final_price_bani;
end $$;

-- Called by the scheduled function: completes tasks the client did not answer within 48 h.
create or replace function public.auto_complete_due() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_service() then raise exception 'service_only' using errcode = '42501'; end if;
  for r in select id from public.tasks where status = 'awaiting_confirmation' and finished_at < now() - interval '48 hours' for update skip locked loop
    perform public._move(r.id, 'completed', 'system', 'auto-confirmed after 48 h');
    update public.tasks set completed_at = now() where id = r.id;
    return next r.id;
  end loop;
end $$;

create or replace function public.cancel_task(p_task uuid, p_reason text default '') returns int
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_actor text; v_fee int := 0;
begin
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  v_actor := case when t.client_id = auth.uid() then 'client' when t.jobzer_id = auth.uid() then 'jobzer' when public.is_ops() then 'ops' end;
  if v_actor is null then raise exception 'not_your_task' using errcode = '42501'; end if;
  if v_actor = 'client' and t.status = 'en_route' then v_fee := 1500; end if;
  perform public._move(p_task, 'cancelled', v_actor, coalesce(p_reason, ''));
  update public.tasks set cancelled_at = now(), cancel_fee_bani = v_fee where id = p_task;
  update public.offers set status = 'withdrawn' where task_id = p_task and status = 'sent';
  return v_fee;
end $$;

create or replace function public.open_dispute(p_task uuid, p_description text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_actor text; v uuid;
begin
  select * into t from public.tasks where id = p_task;
  v_actor := case when t.client_id = auth.uid() then 'client' when t.jobzer_id = auth.uid() then 'jobzer' end;
  if v_actor is null then raise exception 'not_your_task' using errcode = '42501'; end if;
  perform public._move(p_task, 'disputed', v_actor, 'dispute opened');
  insert into public.incidents (task_id, reporter_id, kind, severity, description) values (p_task, auth.uid(), 'quality', 2, coalesce(p_description, '')) returning id into v;
  return v;
end $$;

create or replace function public.report_incident(p_task uuid, p_kind text, p_description text, p_severity int default 2) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_task is not null and not exists (select 1 from public.tasks where id = p_task and auth.uid() in (client_id, jobzer_id)) then
    raise exception 'not_your_task' using errcode = '42501';
  end if;
  insert into public.incidents (task_id, reporter_id, kind, severity, description) values (p_task, auth.uid(), p_kind, p_severity, coalesce(p_description, '')) returning id into v;
  return v;
end $$;

create or replace function public.ops_resolve(p_task uuid, p_outcome public.task_status, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_ops() then raise exception 'ops_only' using errcode = '42501'; end if;
  perform public._move(p_task, p_outcome, 'ops', coalesce(p_note, ''));
  update public.tasks set completed_at = case when p_outcome = 'completed' then now() else completed_at end,
    cancelled_at = case when p_outcome = 'cancelled' then now() else cancelled_at end where id = p_task;
  update public.incidents set status = 'resolved', resolution = p_note, resolved_at = now() where task_id = p_task and status <> 'resolved';
end $$;

-- ---------------------------------------------------------------- messages and reviews
create or replace function public.send_message(p_task uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v bigint;
begin
  select * into t from public.tasks where id = p_task;
  if not found or auth.uid() not in (t.client_id, t.jobzer_id) then raise exception 'not_your_task' using errcode = '42501'; end if;
  if t.status not in ('confirmed', 'en_route', 'in_progress', 'awaiting_confirmation', 'disputed')
     and not (t.status = 'completed' and t.completed_at > now() - interval '7 days') then
    raise exception 'chat_closed' using errcode = 'P0001';
  end if;
  insert into public.messages (task_id, sender_id, body) values (p_task, auth.uid(), p_body) returning id into v;
  return v;
end $$;

-- Double-blind: a review becomes visible when the other side has reviewed too, or after 14 days.
create or replace function public.submit_review(p_task uuid, p_stars int, p_tags text[], p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_role public.review_role; v_subject uuid;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.status <> 'completed' then raise exception 'not_completed' using errcode = 'P0001'; end if;
  if auth.uid() = t.client_id then v_role := 'client'; v_subject := t.jobzer_id;
  elsif auth.uid() = t.jobzer_id then v_role := 'jobzer'; v_subject := t.client_id;
  else raise exception 'not_your_task' using errcode = '42501'; end if;
  if t.completed_at < now() - interval '14 days' then raise exception 'review_window_closed' using errcode = 'P0001'; end if;
  insert into public.reviews (task_id, author_id, subject_id, author_role, stars, tags, body)
  values (p_task, auth.uid(), v_subject, v_role, p_stars, coalesce(p_tags, '{}'), coalesce(p_body, ''));
  if (select count(*) from public.reviews where task_id = p_task) = 2 then
    update public.reviews set published = true where task_id = p_task;
  end if;
end $$;

create or replace function public.publish_stale_reviews() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_service() then raise exception 'service_only' using errcode = '42501'; end if;
  update public.reviews r set published = true from public.tasks t
  where r.task_id = t.id and not r.published and t.completed_at < now() - interval '14 days';
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.reply_review(p_review uuid, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.reviews set reply = p_reply where id = p_review and subject_id = auth.uid() and published and reply is null;
  if not found then raise exception 'cannot_reply' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------- skills
-- "Calificat" only with a verified certificate for that category.
create or replace function public.check_skill_level() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.level = 'calificat' and not exists (
    select 1 from public.certificates c where c.jobzer_id = new.jobzer_id and c.category = new.category and c.status = 'verified'
      and (c.expires_on is null or c.expires_on >= current_date)) then
    new.level := 'experimentat';
  end if;
  return new;
end $$;
create trigger jobzer_skills_level before insert or update on public.jobzer_skills
for each row execute function public.check_skill_level();

-- Offers as the Jobzer sees them: approximate place only, no client identity beyond first name.
create view public.my_offers as
select o.id, o.task_id, o.status, o.net_bani, o.distance_m, o.expires_at, o.question, o.answer,
  t.title, t.category, t.details, t.people, t.area_label, t.scheduled_for, t.pricing_mode,
  t.hold_bani as client_pays_bani, t.photo_paths,
  split_part(p.display_name, ' ', 1) as client_first_name
from public.offers o
join public.tasks t on t.id = o.task_id
join public.profiles p on p.id = t.client_id
where o.jobzer_id = auth.uid();

-- Expired offers are closed (never counted against the Jobzer) and the next candidates are invited.
create or replace function public.expire_offers() returns int
language plpgsql security definer set search_path = public as $$
declare n int; r record;
begin
  if not public.is_service() then raise exception 'service_only' using errcode = '42501'; end if;
  update public.offers set status = 'expired' where status = 'sent' and expires_at < now();
  get diagnostics n = row_count;
  for r in select t.id from public.tasks t where t.status = 'searching'
    and not exists (select 1 from public.offers o where o.task_id = t.id and o.status = 'sent') loop
    perform public._match_offers(r.id, 3);
  end loop;
  return n;
end $$;
