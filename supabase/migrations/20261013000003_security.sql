-- Row level security, grants, storage and realtime.
-- Rule of thumb: reads are filtered by RLS, writes go through functions.

alter table public.profiles enable row level security;
alter table public.jobzers enable row level security;
alter table public.jobzer_skills enable row level security;
alter table public.certificates enable row level security;
alter table public.tasks enable row level security;
alter table public.task_addresses enable row level security;
alter table public.task_codes enable row level security;
alter table public.offers enable row level security;
alter table public.task_events enable row level security;
alter table public.extras enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.documents enable row level security;
alter table public.incidents enable row level security;
alter table public.favourites enable row level security;
alter table public.task_transitions enable row level security;

-- Start from nothing, then grant what each role needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------- profiles
grant select on public.profiles to authenticated;
grant update (display_name, area_label, billing_company, billing_cui, billing_address) on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_ops());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- New auth users get a profile row automatically. Supabase stores phones without '+'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone_e164, phone_verified, display_name)
  values (new.id, case when coalesce(new.phone, '') = '' then null when new.phone like '+%' then new.phone else '+' || new.phone end, new.phone_confirmed_at is not null, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Phone verification happens in Supabase Auth (SMS OTP). Mirror it.
create or replace function public.handle_user_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    phone_e164 = case when new.phone is null or new.phone = '' then phone_e164 when new.phone like '+%' then new.phone else '+' || new.phone end,
    phone_verified = new.phone_confirmed_at is not null
  where id = new.id;
  return new;
end $$;
create trigger on_auth_user_phone after update of phone, phone_confirmed_at on auth.users for each row execute function public.handle_user_phone();

-- ---------------------------------------------------------------- Jobzers
grant select on public.jobzers to authenticated;
grant update (legal_form, company_name, cui, bio, languages, tools, vehicle, radius_km) on public.jobzers to authenticated;
create policy jobzers_self_read on public.jobzers for select to authenticated using (id = auth.uid() or public.is_ops());
create policy jobzers_self_update on public.jobzers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update, delete on public.jobzer_skills to authenticated;
create policy skills_public_read on public.jobzer_skills for select to authenticated using (true);
create policy skills_self_write on public.jobzer_skills for insert to authenticated with check (jobzer_id = auth.uid());
create policy skills_self_update on public.jobzer_skills for update to authenticated using (jobzer_id = auth.uid()) with check (jobzer_id = auth.uid());
create policy skills_self_delete on public.jobzer_skills for delete to authenticated using (jobzer_id = auth.uid());

grant select on public.certificates to authenticated;
grant insert (jobzer_id, category, name, issuer, file_path, expires_on) on public.certificates to authenticated;
create policy certs_self_read on public.certificates for select to authenticated using (jobzer_id = auth.uid() or public.is_ops());
create policy certs_self_insert on public.certificates for insert to authenticated with check (jobzer_id = auth.uid());

-- Public projections (views run with the owner's rights and expose only safe columns).
grant select on public.jobzer_public, public.jobzer_stats, public.my_offers to authenticated;

-- ---------------------------------------------------------------- tasks
grant select on public.tasks to authenticated;
create policy tasks_party_read on public.tasks for select to authenticated
  using (client_id = auth.uid() or jobzer_id = auth.uid() or public.is_ops());

grant select on public.task_addresses to authenticated;
create policy addr_read on public.task_addresses for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and (
    t.client_id = auth.uid()
    or (t.jobzer_id = auth.uid() and t.status in ('confirmed', 'en_route', 'in_progress', 'awaiting_confirmation'))
    or public.is_ops())));

grant select on public.task_codes to authenticated;
create policy codes_client_read on public.task_codes for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and t.client_id = auth.uid()));

grant select on public.offers to authenticated;
create policy offers_jobzer_read on public.offers for select to authenticated using (jobzer_id = auth.uid() or public.is_ops());

grant select on public.task_events, public.extras, public.messages to authenticated;
create policy events_party_read on public.task_events for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and (auth.uid() in (t.client_id, t.jobzer_id) or public.is_ops())));
create policy extras_party_read on public.extras for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and (auth.uid() in (t.client_id, t.jobzer_id) or public.is_ops())));
create policy messages_party_read on public.messages for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and (auth.uid() in (t.client_id, t.jobzer_id) or public.is_ops())));

grant select on public.reviews to authenticated;
create policy reviews_read on public.reviews for select to authenticated using (published or author_id = auth.uid() or public.is_ops());

grant select on public.documents to authenticated;
create policy documents_read on public.documents for select to authenticated using (recipient_id = auth.uid() or public.is_ops());

grant select on public.incidents to authenticated;
create policy incidents_read on public.incidents for select to authenticated using (reporter_id = auth.uid() or public.is_ops());

grant select, insert, delete on public.favourites to authenticated;
create policy fav_self on public.favourites for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());

grant select on public.task_transitions to authenticated;
create policy transitions_read on public.task_transitions for select to authenticated using (true);

-- ---------------------------------------------------------------- callable functions
grant execute on function
  public.create_task(text, text, text[], text, int, text, float8, float8, text, text, timestamptz, public.pricing_mode, int, int, int, int, boolean, text, text[]),
  public.publish_task(uuid), public.match_offers(uuid, int), public.reject_match(uuid),
  public.become_jobzer(), public.set_availability(boolean, float8, float8),
  public.respond_offer(uuid, boolean), public.ask_on_offer(uuid, text), public.answer_offer_question(uuid, text),
  public.jobzer_depart(uuid), public.start_task(uuid, text), public.propose_extra(uuid, text, text, int),
  public.respond_extra(uuid, boolean), public.finish_task(uuid), public.complete_task(uuid),
  public.cancel_task(uuid, text), public.open_dispute(uuid, text), public.report_incident(uuid, text, text, int),
  public.ops_resolve(uuid, public.task_status, text), public.send_message(uuid, text),
  public.submit_review(uuid, int, text[], text), public.reply_review(uuid, text),
  public.fee_service(int), public.fee_commission(int), public.hourly_charge(int, int, int), public.tier_index(int, float8, int, boolean, boolean),
  public.is_ops(), public.is_service(), public.has_contact_details(text)
to authenticated;

-- Service role only (edge functions with the service key).
grant execute on function public.mark_payment_authorised(uuid, text), public.mark_payment_status(uuid, text),
  public.auto_complete_due(), public.publish_stale_reviews(), public.match_offers(uuid, int) to service_role;

-- ---------------------------------------------------------------- storage (Supabase Storage)
insert into storage.buckets (id, name, public) values
  ('task-photos', 'task-photos', false),
  ('certificates', 'certificates', false),
  ('job-proof', 'job-proof', false)
on conflict (id) do nothing;

-- task-photos/<client uid>/<file>: client uploads; offered or assigned Jobzers read through signed URLs from the backend.
create policy task_photos_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy task_photos_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- certificates/<jobzer uid>/<file>: only the Jobzer and ops.
create policy certs_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy certs_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_ops()));

-- job-proof/<task id>/<file>: the assigned Jobzer uploads, both parties read.
create policy proof_jobzer_write on storage.objects for insert to authenticated
  with check (bucket_id = 'job-proof' and exists (
    select 1 from public.tasks t where t.id::text = (storage.foldername(name))[1] and t.jobzer_id = auth.uid() and t.status = 'in_progress'));
create policy proof_party_read on storage.objects for select to authenticated
  using (bucket_id = 'job-proof' and exists (
    select 1 from public.tasks t where t.id::text = (storage.foldername(name))[1] and auth.uid() in (t.client_id, t.jobzer_id)));

-- ---------------------------------------------------------------- realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.offers, public.messages, public.extras;
  end if;
exception when others then
  raise notice 'realtime publication not updated: %', sqlerrm;
end $$;
