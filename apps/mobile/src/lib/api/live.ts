import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IntakeDraft, TaskStatus } from '@jobzee/shared';
import type { IntakeInput, JobzeeApi, JobzerPublic, Message, NewTask, Offer, Review, Session, TaskView } from './types';

/** Supabase-backed implementation. Every write goes through a database function or an edge function. */
export function createLiveApi(url: string, anonKey: string): JobzeeApi {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  async function fn<T>(name: string, body: Record<string, unknown> | IntakeInput): Promise<T> {
    const { data, error } = await sb.functions.invoke(name, { body: body as Record<string, unknown> });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const detail = ctx ? await ctx.json().catch(() => null) : null;
      throw new Error(detail?.error ?? error.message);
    }
    return data as T;
  }

  async function jobzer(id: string): Promise<JobzerPublic> {
    const j = must(await sb.from('jobzer_public').select('*').eq('id', id).single()) as Record<string, any>;
    const skills = must(await sb.from('jobzer_skills').select('category, level, years').eq('jobzer_id', id)) as JobzerPublic['skills'];
    const photo = sb.storage.from('avatars').getPublicUrl(`${id}.jpg`).data.publicUrl;
    return {
      id: j.id, displayName: j.display_name, legalForm: j.legal_form, companyName: j.company_name, issuesInvoice: j.issues_invoice,
      bio: j.bio, languages: j.languages, tools: j.tools, vehicle: j.vehicle, idVerified: j.id_verified, insured: j.insured,
      backgroundChecked: j.background_checked, done: j.done, rating: j.rating, reviewCount: j.review_count, onTimePct: j.on_time_pct,
      tier: j.tier, memberSince: j.member_since, photo, skills,
    };
  }

  async function getTask(id: string): Promise<TaskView> {
    const t = must(await sb.from('tasks').select('*').eq('id', id).single()) as Record<string, any>;
    const code = (await sb.from('task_codes').select('start_code').eq('task_id', id).maybeSingle()).data?.start_code ?? null;
    const address = (await sb.from('task_addresses').select('address').eq('task_id', id).maybeSingle()).data?.address ?? null;
    return {
      id: t.id, status: t.status as TaskStatus, title: t.title, category: t.category, details: t.details, areaLabel: t.area_label,
      pricingMode: t.pricing_mode, holdBani: t.hold_bani, serviceBani: t.service_bani, finalPriceBani: t.final_price_bani,
      paymentStatus: t.payment_status, startCode: code, address, jobzer: t.jobzer_id ? await jobzer(t.jobzer_id) : null,
      etaMin: null, createdAt: t.created_at,
    };
  }

  return {
    mode: 'live',
    async session() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { userId: u.id, phone: `+${u.phone ?? ''}`, displayName: (u.user_metadata?.display_name as string) ?? '' } : null;
    },
    async sendCode(phone) { must(await sb.auth.signInWithOtp({ phone })); },
    async verifyCode(phone, token): Promise<Session> {
      const d = must(await sb.auth.verifyOtp({ phone, token, type: 'sms' }));
      return { userId: d.user!.id, phone, displayName: (d.user!.user_metadata?.display_name as string) ?? '' };
    },
    async signOut() { await sb.auth.signOut(); },

    intake: (input: IntakeInput) => fn<IntakeDraft & { source: 'ai' | 'rules' }>('ai-intake', input),
    async createTask(t: NewTask) {
      return must(await sb.rpc('create_task', {
        p_title: t.title, p_category: t.category, p_details: t.details, p_ai_notes: t.aiNotes, p_people: t.people,
        p_area_label: t.areaLabel, p_lat: t.lat, p_lng: t.lng, p_address: t.address, p_access_notes: t.accessNotes,
        p_scheduled_for: t.scheduledFor, p_pricing_mode: t.pricingMode, p_price_bani: t.priceBani, p_rate_bani: t.rateBani,
        p_max_hours: t.maxHours, p_min_tier: t.minTier, p_need_invoice: t.needInvoice, p_invoice_cui: t.invoiceCui, p_photo_paths: [],
      })) as string;
    },
    async publishTask(id) { return must(await sb.rpc('publish_task', { p_task: id })) as number; },
    getTask,
    watchTask(id, onChange) {
      const ch = sb.channel(`task-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${id}` }, () => { getTask(id).then(onChange).catch(() => {}); })
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },
    async myTasks() {
      const rows = must(await sb.from('tasks').select('id').order('created_at', { ascending: false }).limit(30)) as Array<{ id: string }>;
      return Promise.all(rows.map((r) => getTask(r.id)));
    },
    async rejectMatch(id) { must(await sb.rpc('reject_match', { p_task: id })); },
    async authorisePayment(id) {
      const r = await fn<{ client_secret: string }>('payments-authorize', { task_id: id });
      return { clientSecret: r.client_secret };
    },
    async completeTask(id) { await fn('task-complete', { task_id: id }); },
    async cancelTask(id, reason) {
      const r = await fn<{ fee_bani: number }>('task-cancel', { task_id: id, reason });
      return { feeBani: r.fee_bani };
    },
    async submitReview(id, stars, tags, body) { must(await sb.rpc('submit_review', { p_task: id, p_stars: stars, p_tags: tags, p_body: body })); },
    async reportProblem(taskId, description) { must(await sb.rpc('report_incident', { p_task: taskId, p_kind: 'quality', p_description: description, p_severity: 2 })); },
    async messages(taskId): Promise<Message[]> {
      const me = (await sb.auth.getUser()).data.user?.id;
      const rows = must(await sb.from('messages').select('id, sender_id, body, created_at').eq('task_id', taskId).order('id')) as Array<Record<string, any>>;
      return rows.map((m) => ({ id: m.id, mine: m.sender_id === me, body: m.body, createdAt: m.created_at }));
    },
    async sendMessage(taskId, body) { must(await sb.rpc('send_message', { p_task: taskId, p_body: body })); },

    jobzer,
    async reviewsFor(id): Promise<Review[]> {
      const rows = must(await sb.from('reviews').select('id, stars, body, tags, reply, created_at').eq('subject_id', id).eq('published', true).order('created_at', { ascending: false }).limit(20)) as Array<Record<string, any>>;
      return rows.map((r) => ({ id: r.id, stars: r.stars, body: r.body, tags: r.tags, reply: r.reply, createdAt: r.created_at, authorName: 'Client verificat' }));
    },

    async becomeJobzer() { must(await sb.rpc('become_jobzer')); },
    async setAvailability(available, lat, lng) { must(await sb.rpc('set_availability', { p_available: available, p_lat: lat ?? null, p_lng: lng ?? null })); },
    async myOffers(): Promise<Offer[]> {
      const rows = must(await sb.from('my_offers').select('*').eq('status', 'sent')) as Array<Record<string, any>>;
      return rows.map((o) => ({
        id: o.id, taskId: o.task_id, title: o.title, category: o.category, details: o.details, areaLabel: o.area_label, distanceM: o.distance_m,
        netBani: o.net_bani, clientPaysBani: o.client_pays_bani, clientFirstName: o.client_first_name, expiresAt: o.expires_at, scheduledFor: o.scheduled_for,
      }));
    },
    async respondOffer(id, accept) { return must(await sb.rpc('respond_offer', { p_offer: id, p_accept: accept })) as boolean; },
    async depart(taskId) { must(await sb.rpc('jobzer_depart', { p_task: taskId })); },
    async startTask(taskId, code) { return must(await sb.rpc('start_task', { p_task: taskId, p_code: code })) as boolean; },
    async finishTask(taskId) { return must(await sb.rpc('finish_task', { p_task: taskId })) as number; },
    async payoutOnboardingUrl() { return (await fn<{ url: string }>('connect-onboarding', {})).url; },
  };
}
