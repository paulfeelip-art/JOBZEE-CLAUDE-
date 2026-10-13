import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, one, type Who } from './harness';
import {
  fees, hourlyCharge, tierIndex, canTransition,
  type TaskStatus, type Actor,
} from '../../packages/shared/src/index';

const C = '00000000-0000-4000-8000-00000000000c'; // client
const J1 = '00000000-0000-4000-8000-0000000000a1'; // PFA, close
const J2 = '00000000-0000-4000-8000-0000000000a2'; // persoană fizică, close
const J3 = '00000000-0000-4000-8000-0000000000a3'; // far away
const OPS = '00000000-0000-4000-8000-0000000000f0';

const client: Who = { uid: C, role: 'authenticated' };
const j1: Who = { uid: J1, role: 'authenticated' };
const j2: Who = { uid: J2, role: 'authenticated' };
const j3: Who = { uid: J3, role: 'authenticated' };
const service: Who = { uid: null, role: 'service_role' };
const anon: Who = { uid: null, role: 'anon' };

// Titan, Bucharest
const HOME = { lat: 44.4205, lng: 26.1652 };

let db: PGlite;

async function newTask(extra: Partial<{ needInvoice: boolean; cui: string; price: number; minTier: number }> = {}) {
  return as(db, client, async (tx) => {
    const r = await one<{ id: string }>(tx,
      `select public.create_task($1,'mobilier',array['Birou cu 2 sertare'],'',1,'Titan, Sector 3',$2,$3,'Str. Exemplu 1, ap. 2','',null,'fixed',$4,null,null,$5,$6,$7,'{}') as id`,
      ['Montaj birou IKEA', HOME.lat, HOME.lng, extra.price ?? 16000, extra.minTier ?? 0, extra.needInvoice ?? false, extra.cui ?? null]);
    return r.id;
  });
}

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`
    insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
      ('${C}', '40712000001', now(), '{"display_name":"Elena Vasile"}'),
      ('${J1}', '40712000002', now(), '{"display_name":"Andrei Munteanu"}'),
      ('${J2}', '40712000003', now(), '{"display_name":"Ioana Pop"}'),
      ('${J3}', '40712000004', now(), '{"display_name":"Radu Cristea"}'),
      ('${OPS}', '40712000005', now(), '{"display_name":"Ops"}');
    update public.profiles set is_ops = true where id = '${OPS}';
  `);
  for (const j of [j1, j2, j3]) await as(db, j, (tx) => tx.query('select public.become_jobzer()'));
  await db.exec(`
    update public.jobzers set id_verified = true, payouts_enabled = true;
    update public.jobzers set legal_form = 'pfa', company_name = 'Munteanu Andrei PFA', cui = '45123984' where id = '${J1}';
    insert into public.jobzer_skills (jobzer_id, category, level) values
      ('${J1}','mobilier','experimentat'), ('${J2}','mobilier','incepator'), ('${J3}','mobilier','experimentat');
  `);
  await as(db, j1, (tx) => tx.query('select public.set_availability(true, $1, $2)', [44.4231, 26.1690])); // ~400 m
  await as(db, j2, (tx) => tx.query('select public.set_availability(true, $1, $2)', [44.4170, 26.1600])); // ~550 m
  await as(db, j3, (tx) => tx.query('select public.set_availability(true, $1, $2)', [44.4800, 26.0500])); // ~11 km
}, 60_000);

describe('rules mirrored from packages/shared', () => {
  it('service fee and commission match fees()', async () => {
    for (const p of [2000, 6000, 15000, 15735, 49999, 51020, 100000]) {
      const r = await one<{ s: number; c: number }>(db, 'select public.fee_service($1) s, public.fee_commission($1) c', [p]);
      expect([r.s, r.c]).toEqual([fees(p).service, fees(p).commission]);
    }
  });
  it('hourly charge matches hourlyCharge()', async () => {
    for (const m of [0, 1, 15, 16, 50, 61, 119, 500]) {
      const r = await one<{ v: number }>(db, 'select public.hourly_charge(6500, $1, 2) v', [m]);
      expect(r.v).toBe(hourlyCharge(6500, m, 2));
    }
  });
  it('tier_index matches tierIndex()', async () => {
    for (const done of [0, 9, 10, 49, 50, 149, 150]) for (const rating of [4.5, 4.6, 4.8, 4.9]) for (const ot of [89, 90, 95, 97])
      for (const idv of [false, true]) for (const ins of [false, true]) {
        const r = await one<{ t: number }>(db, 'select public.tier_index($1,$2,$3,$4,$5) t', [done, rating, ot, idv, ins]);
        expect(r.t, JSON.stringify({ done, rating, ot, idv, ins })).toBe(
          tierIndex({ done, rating, onTimePct: ot, idVerified: idv, insured: ins }));
      }
  });
  it('task_transitions matches the lifecycle', async () => {
    const statuses: TaskStatus[] = ['draft', 'searching', 'matched', 'confirmed', 'en_route', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled', 'disputed'];
    const actors: Actor[] = ['client', 'jobzer', 'system', 'ops'];
    const rows = (await db.query<{ from_status: string; to_status: string; actor: string }>('select * from public.task_transitions')).rows;
    const set = new Set(rows.map((r) => `${r.from_status}>${r.to_status}>${r.actor}`));
    for (const f of statuses) for (const t of statuses) for (const a of actors)
      expect(set.has(`${f}>${t}>${a}`), `${f}>${t}>${a}`).toBe(canTransition(f, t, a));
  });
});

describe('happy path: request → match → work → payment → reviews', () => {
  let task = '';
  let code = '';

  it('profiles are created from auth with the verified phone', async () => {
    const p = await as(db, client, (tx) => one<{ phone_e164: string; phone_verified: boolean }>(tx, 'select phone_e164, phone_verified from public.profiles where id = $1', [C]));
    expect(p).toEqual({ phone_e164: '+40712000001', phone_verified: true });
  });

  it('client creates and publishes; offers go only to nearby Jobzers', async () => {
    task = await newTask();
    const sent = await as(db, client, (tx) => one<{ n: number }>(tx, 'select public.publish_task($1) n', [task]));
    expect(sent.n).toBe(2);
    const t = await as(db, client, (tx) => one<{ status: string; hold_bani: number; service_bani: number }>(tx, 'select status, hold_bani, service_bani from public.tasks where id=$1', [task]));
    expect(t).toEqual({ status: 'searching', hold_bani: 16000, service_bani: 784 });
  });

  it('the Jobzer sees the offer with an approximate place and net pay, not the address', async () => {
    const o = await as(db, j1, (tx) => one<{ net_bani: number; distance_m: number; client_first_name: string }>(tx, 'select net_bani, distance_m, client_first_name from public.my_offers where task_id=$1', [task]));
    expect(o.net_bani).toBe(fees(16000).net);
    expect(o.client_first_name).toBe('Elena');
    expect(o.distance_m).toBeLessThan(1500);
    const far = await as(db, j3, (tx) => tx.query('select 1 from public.my_offers where task_id=$1', [task]));
    expect(far.rows).toHaveLength(0);
    const addr = await as(db, j1, (tx) => tx.query('select * from public.task_addresses where task_id=$1', [task]));
    expect(addr.rows).toHaveLength(0);
  });

  it('contact details cannot be passed in offer questions', async () => {
    const offer = await as(db, j1, (tx) => one<{ id: string }>(tx, 'select id from public.my_offers where task_id=$1', [task]));
    await expect(as(db, j1, (tx) => tx.query('select public.ask_on_offer($1, $2)', [offer.id, 'Sună-mă la 0712 345 678']))).rejects.toThrow(/contact_details/);
    await as(db, j1, (tx) => tx.query('select public.ask_on_offer($1, $2)', [offer.id, 'Are lift?']));
  });

  it('declining is free; accepting matches the task and withdraws other offers', async () => {
    const o2 = await as(db, j2, (tx) => one<{ id: string }>(tx, 'select id from public.my_offers where task_id=$1', [task]));
    const d = await as(db, j2, (tx) => one<{ r: boolean }>(tx, 'select public.respond_offer($1,false) r', [o2.id]));
    expect(d.r).toBe(false);
    const o1 = await as(db, j1, (tx) => one<{ id: string }>(tx, 'select id from public.my_offers where task_id=$1', [task]));
    const a = await as(db, j1, (tx) => one<{ r: boolean }>(tx, 'select public.respond_offer($1,true) r', [o1.id]));
    expect(a.r).toBe(true);
    const t = await as(db, client, (tx) => one<{ status: string; jobzer_id: string }>(tx, 'select status, jobzer_id from public.tasks where id=$1', [task]));
    expect(t).toEqual({ status: 'matched', jobzer_id: J1 });
  });

  it('only the client sees the start code', async () => {
    code = (await as(db, client, (tx) => one<{ start_code: string }>(tx, 'select start_code from public.task_codes where task_id=$1', [task]))).start_code;
    expect(code).toMatch(/^\d{4}$/);
    const j = await as(db, j1, (tx) => tx.query('select * from public.task_codes where task_id=$1', [task]));
    expect(j.rows).toHaveLength(0);
  });

  it('only the backend can mark the payment authorised', async () => {
    await expect(as(db, client, (tx) => tx.query("select public.mark_payment_authorised($1,'pi_test')", [task]))).rejects.toThrow();
    await as(db, service, (tx) => tx.query("select public.mark_payment_authorised($1,'pi_test')", [task]));
    const addr = await as(db, j1, (tx) => tx.query('select address from public.task_addresses where task_id=$1', [task]));
    expect(addr.rows).toHaveLength(1);
  });

  it('the task starts only with the right code', async () => {
    await as(db, j1, (tx) => tx.query('select public.jobzer_depart($1)', [task]));
    const bad = await as(db, j1, (tx) => one<{ ok: boolean }>(tx, "select public.start_task($1,'0000') ok", [task]));
    expect(bad.ok).toBe(code === '0000');
    const good = await as(db, j1, (tx) => one<{ ok: boolean }>(tx, 'select public.start_task($1,$2) ok', [task, code]));
    expect(good.ok).toBe(true);
  });

  it('approved extras are added to the final price', async () => {
    const ex = await as(db, j1, (tx) => one<{ id: string }>(tx, "select public.propose_extra($1,'Fixare de perete','2 dibluri',3000) id", [task]));
    await as(db, client, (tx) => tx.query('select public.respond_extra($1,true)', [ex.id]));
    const f = await as(db, j1, (tx) => one<{ v: number }>(tx, 'select public.finish_task($1) v', [task]));
    expect(f.v).toBe(19000);
  });

  it('the Jobzer cannot complete; the client can', async () => {
    await expect(as(db, j1, (tx) => tx.query('select public.complete_task($1)', [task]))).rejects.toThrow(/not_your_task/);
    const r = await as(db, client, (tx) => one<{ v: number }>(tx, 'select public.complete_task($1) v', [task]));
    expect(r.v).toBe(19000);
  });

  it('reviews stay hidden until both sides reviewed', async () => {
    await as(db, client, (tx) => tx.query("select public.submit_review($1,5,array['Punctual'],'Foarte atent')", [task]));
    const before = await as(db, j1, (tx) => tx.query('select * from public.reviews where task_id=$1', [task]));
    expect(before.rows).toHaveLength(0);
    await as(db, j1, (tx) => tx.query("select public.submit_review($1,5,'{}','Client de nota 10')", [task]));
    const after = await as(db, j1, (tx) => tx.query('select * from public.reviews where task_id=$1', [task]));
    expect(after.rows).toHaveLength(2);
    const pub = await as(db, j2, (tx) => one<{ done: number; rating: number; issues_invoice: boolean }>(tx, 'select done, rating, issues_invoice from public.jobzer_public where id=$1', [J1]));
    expect(pub).toEqual({ done: 1, rating: 5, issues_invoice: true });
  });
});

describe('access control', () => {
  it('other users and anonymous visitors cannot read a task', async () => {
    const t = await newTask();
    const other = await as(db, j2, (tx) => tx.query('select * from public.tasks where id=$1', [t]));
    expect(other.rows).toHaveLength(0);
    await expect(as(db, anon, (tx) => tx.query('select * from public.tasks'))).rejects.toThrow(/permission denied/);
  });
  it('nobody can write tasks directly', async () => {
    const t = await newTask();
    await expect(as(db, client, (tx) => tx.query("update public.tasks set status='completed' where id=$1", [t]))).rejects.toThrow(/permission denied/);
    await expect(as(db, client, (tx) => tx.query("update public.profiles set is_ops=true where id=$1", [C]))).rejects.toThrow(/permission denied/);
  });
  it('Jobzers cannot verify themselves', async () => {
    await expect(as(db, j2, (tx) => tx.query('update public.jobzers set id_verified=true, insured=true where id=$1', [J2]))).rejects.toThrow(/permission denied/);
  });
  it('ops verify certificates; then "Calificat" is allowed', async () => {
    const ops: Who = { uid: OPS, role: 'authenticated' };
    const cert = await as(db, j1, (tx) => one<{ id: string }>(tx, "insert into public.certificates (jobzer_id, category, name, file_path) values ($1,'tehnic','Atestat IT','x/1.pdf') returning id", [J1]));
    await expect(as(db, j1, (tx) => tx.query('select public.ops_review_certificate($1,true)', [cert.id]))).rejects.toThrow(/ops_only/);
    await as(db, ops, (tx) => tx.query('select public.ops_review_certificate($1,true)', [cert.id]));
    await as(db, j1, (tx) => tx.query("insert into public.jobzer_skills (jobzer_id, category, level) values ($1,'tehnic','calificat')", [J1]));
    const s = await as(db, j1, (tx) => one<{ level: string }>(tx, "select level from public.jobzer_skills where jobzer_id=$1 and category='tehnic'", [J1]));
    expect(s.level).toBe('calificat');
    await as(db, ops, (tx) => tx.query('select public.ops_set_checks($1,true,true,true)', [J2]));
  });
  it('"Calificat" needs a verified certificate', async () => {
    await as(db, j2, (tx) => tx.query("insert into public.jobzer_skills (jobzer_id, category, level) values ($1,'tehnic','calificat')", [J2]));
    const s = await as(db, j2, (tx) => one<{ level: string }>(tx, "select level from public.jobzer_skills where jobzer_id=$1 and category='tehnic'", [J2]));
    expect(s.level).toBe('experimentat');
  });
});

describe('matching rules', () => {
  it('invoice requests only reach Jobzers with a company', async () => {
    const t = await newTask({ needInvoice: true, cui: '14399840' });
    await as(db, client, (tx) => tx.query('select public.publish_task($1)', [t]));
    const offered = await as(db, service, (tx) => tx.query<{ jobzer_id: string }>('select jobzer_id from public.offers where task_id=$1', [t]));
    expect(offered.rows.map((r) => r.jobzer_id)).toEqual([J1]);
  });
  it('a minimum level filters out newer Jobzers', async () => {
    const t = await newTask({ minTier: 2 });
    const n = await as(db, client, (tx) => one<{ n: number }>(tx, 'select public.publish_task($1) n', [t]));
    expect(n.n).toBe(0);
  });
  it('unavailable Jobzers get no offers', async () => {
    await as(db, j2, (tx) => tx.query('select public.set_availability(false)'));
    const t = await newTask();
    await as(db, client, (tx) => tx.query('select public.publish_task($1)', [t]));
    const offered = await as(db, service, (tx) => tx.query<{ jobzer_id: string }>('select jobzer_id from public.offers where task_id=$1', [t]));
    expect(offered.rows.map((r) => r.jobzer_id)).toEqual([J1]);
  });
});

describe('cancellation and disputes', () => {
  async function confirmedTask() {
    const t = await newTask();
    await as(db, client, (tx) => tx.query('select public.publish_task($1)', [t]));
    const o = await as(db, j1, (tx) => one<{ id: string }>(tx, 'select id from public.my_offers where task_id=$1', [t]));
    await as(db, j1, (tx) => tx.query('select public.respond_offer($1,true)', [o.id]));
    await as(db, service, (tx) => tx.query("select public.mark_payment_authorised($1,'pi_x')", [t]));
    return t;
  }
  it('cancelling is free before the Jobzer leaves', async () => {
    const t = await confirmedTask();
    const r = await as(db, client, (tx) => one<{ fee: number }>(tx, "select public.cancel_task($1,'plans changed') fee", [t]));
    expect(r.fee).toBe(0);
  });
  it('costs 15 lei once the Jobzer is on the way', async () => {
    const t = await confirmedTask();
    await as(db, j1, (tx) => tx.query('select public.jobzer_depart($1)', [t]));
    const r = await as(db, client, (tx) => one<{ fee: number }>(tx, 'select public.cancel_task($1) fee', [t]));
    expect(r.fee).toBe(1500);
  });
  it('disputes go to ops, who decide the outcome', async () => {
    const t = await confirmedTask();
    const code = (await as(db, client, (tx) => one<{ start_code: string }>(tx, 'select start_code from public.task_codes where task_id=$1', [t]))).start_code;
    await as(db, j1, (tx) => tx.query('select public.jobzer_depart($1)', [t]));
    await as(db, j1, (tx) => tx.query('select public.start_task($1,$2)', [t, code]));
    await as(db, client, (tx) => tx.query("select public.open_dispute($1,'Sertarul nu se închide')", [t]));
    await expect(as(db, client, (tx) => tx.query("select public.ops_resolve($1,'completed','x')", [t]))).rejects.toThrow(/ops_only/);
    await as(db, { uid: OPS, role: 'authenticated' }, (tx) => tx.query("select public.ops_resolve($1,'completed','Reparat la fața locului')", [t]));
    const s = await as(db, client, (tx) => one<{ status: string }>(tx, 'select status from public.tasks where id=$1', [t]));
    expect(s.status).toBe('completed');
  });
  it('auto-completes after 48 hours without an answer', async () => {
    const t = await confirmedTask();
    const code = (await as(db, client, (tx) => one<{ start_code: string }>(tx, 'select start_code from public.task_codes where task_id=$1', [t]))).start_code;
    await as(db, j1, (tx) => tx.query('select public.jobzer_depart($1)', [t]));
    await as(db, j1, (tx) => tx.query('select public.start_task($1,$2)', [t, code]));
    await as(db, j1, (tx) => tx.query('select public.finish_task($1)', [t]));
    await db.query("update public.tasks set finished_at = now() - interval '49 hours' where id = $1", [t]);
    const done = await as(db, service, (tx) => tx.query<{ auto_complete_due: string }>('select * from public.auto_complete_due()'));
    expect(done.rows.map((r) => Object.values(r)[0])).toContain(t);
  });
  it('expired offers close without penalty and the next Jobzers are invited', async () => {
    await as(db, j2, (tx) => tx.query('select public.set_availability(true, $1, $2)', [44.4170, 26.1600]));
    const t = await newTask();
    await as(db, client, (tx) => tx.query('select public.publish_task($1)', [t]));
    await db.query("update public.offers set expires_at = now() - interval '1 minute' where task_id = $1", [t]);
    const n = await as(db, service, (tx) => one<{ n: number }>(tx, 'select public.expire_offers() n'));
    expect(n.n).toBeGreaterThanOrEqual(2);
    const st = await as(db, service, (tx) => tx.query<{ status: string }>("select status from public.offers where task_id = $1", [t]));
    expect(st.rows.every((r) => r.status === 'expired')).toBe(true);
    await expect(as(db, client, (tx) => tx.query('select public.expire_offers()'))).rejects.toThrow();
  });
  it('chat opens only after confirmation', async () => {
    const t = await newTask();
    await expect(as(db, client, (tx) => tx.query("select public.send_message($1,'Salut')", [t]))).rejects.toThrow(/chat_closed/);
  });
});
