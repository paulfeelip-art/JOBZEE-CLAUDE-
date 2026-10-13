'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatLei, normalizeRoMobile, STATUS_LABEL, type TaskStatus } from '@jobzee/shared';
import { supabase } from '@/lib/supabase';

type Row = Record<string, any>;

const card: React.CSSProperties = { background: '#fff', border: '1px solid #ECE6DE', borderRadius: 20, padding: 20, boxShadow: '0 8px 24px rgba(40,25,5,.06)' };
const btn: React.CSSProperties = { minHeight: 40, padding: '0 16px', borderRadius: 999, border: 0, background: '#FF9F0A', color: '#1A1206', fontWeight: 700, cursor: 'pointer', font: 'inherit' };
const btnLine: React.CSSProperties = { ...btn, background: '#fff', border: '1.5px solid #E8E1D7' };

/**
 * Operations console. Data access is enforced by the database: only profiles with
 * is_ops = true can read other users' tasks, incidents and certificates, or call ops_* functions.
 */
export default function Ops() {
  const sb = supabase();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code' | 'in'>('phone');
  const [msg, setMsg] = useState('');
  const [isOps, setIsOps] = useState<boolean | null>(null);
  const [incidents, setIncidents] = useState<Row[]>([]);
  const [disputed, setDisputed] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [certs, setCerts] = useState<Row[]>([]);
  const [kpi, setKpi] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    setStage('in');
    const { data: me } = await sb.from('profiles').select('is_ops').eq('id', u.user.id).single();
    setIsOps(!!me?.is_ops);
    if (!me?.is_ops) return;
    const [i, d, p, c, all] = await Promise.all([
      sb.from('incidents').select('*').neq('status', 'resolved').order('severity', { ascending: false }).limit(50),
      sb.from('tasks').select('id, title, status, hold_bani, final_price_bani, updated_at').eq('status', 'disputed').limit(50),
      sb.from('tasks').select('id, title, status, payment_status, final_price_bani, hold_bani').in('payment_status', ['failed', 'requires_action']).limit(50),
      sb.from('certificates').select('id, jobzer_id, category, name, issuer, file_path, created_at').eq('status', 'pending').limit(50),
      sb.from('tasks').select('status, final_price_bani, hold_bani, service_bani').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    ]);
    setIncidents(i.data ?? []); setDisputed(d.data ?? []); setPayments(p.data ?? []); setCerts(c.data ?? []);
    const rows = all.data ?? [];
    const done = rows.filter((r) => r.status === 'completed');
    setKpi({
      created: rows.length,
      completed: done.length,
      cancelled: rows.filter((r) => r.status === 'cancelled').length,
      gmv: done.reduce((a, r) => a + (r.final_price_bani ?? r.hold_bani), 0),
    });
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  if (!sb) {
    return <Shell><div style={card}><h2>Consola nu e configurată</h2><p>Setează NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY (vezi docs/SETUP.md).</p></div></Shell>;
  }

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await fn();
    setMsg(error ? `Eroare: ${error.message}` : ok);
    load();
  };

  if (stage !== 'in') {
    return (
      <Shell>
        <div style={{ ...card, maxWidth: 420 }}>
          <h2 style={{ marginTop: 0 }}>Autentificare echipă</h2>
          {stage === 'phone' ? (
            <>
              <label htmlFor="ph">Telefon</label>
              <input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" style={input} />
              <button style={btn} onClick={async () => {
                const n = normalizeRoMobile(phone);
                if (!n) return setMsg('Număr invalid');
                const { error } = await sb.auth.signInWithOtp({ phone: n });
                if (error) return setMsg(error.message);
                setStage('code');
              }}>Trimite codul</button>
            </>
          ) : (
            <>
              <label htmlFor="cd">Cod SMS</label>
              <input id="cd" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" style={input} />
              <button style={btn} onClick={async () => {
                const { error } = await sb.auth.verifyOtp({ phone: normalizeRoMobile(phone)!, token: code, type: 'sms' });
                if (error) return setMsg(error.message);
                load();
              }}>Intră</button>
            </>
          )}
          {msg ? <p>{msg}</p> : null}
        </div>
      </Shell>
    );
  }

  if (isOps === false) return <Shell><div style={card}><h2>Fără acces</h2><p>Contul tău nu face parte din echipa de operațiuni.</p></div></Shell>;

  return (
    <Shell>
      {msg ? <p role="status" style={{ ...card, padding: 12 }}>{msg}</p> : null}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[['Cereri, 7 zile', String(kpi.created ?? 0)], ['Finalizate', String(kpi.completed ?? 0)], ['Anulate', String(kpi.cancelled ?? 0)], ['Valoare lucrări', formatLei(kpi.gmv ?? 0, 0)]].map(([a, b]) => (
          <div key={a} style={card}><div style={{ color: '#686868', fontSize: 13 }}>{a}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{b}</div></div>
        ))}
      </section>
      <Section title={`Incidente deschise (${incidents.length})`}>
        {incidents.map((i) => (
          <Item key={i.id} title={`${i.kind} · severitate ${i.severity}`} sub={i.description || '—'}>
            {i.task_id ? <span style={{ color: '#686868', fontSize: 13 }}>sarcina {String(i.task_id).slice(0, 8)}</span> : null}
          </Item>
        ))}
      </Section>
      <Section title={`Dispute (${disputed.length})`}>
        {disputed.map((t) => (
          <Item key={t.id} title={t.title} sub={`${STATUS_LABEL[t.status as TaskStatus]} · ${formatLei(t.final_price_bani ?? t.hold_bani)}`}>
            <button style={btn} onClick={() => act(() => sb.rpc('ops_resolve', { p_task: t.id, p_outcome: 'completed', p_note: 'Rezolvat de echipă: plata se încasează' }), 'Disputa închisă: finalizată')}>Finalizează</button>
            <button style={btnLine} onClick={() => act(() => sb.rpc('ops_resolve', { p_task: t.id, p_outcome: 'cancelled', p_note: 'Rezolvat de echipă: rambursare' }), 'Disputa închisă: anulată')}>Anulează</button>
          </Item>
        ))}
      </Section>
      <Section title={`Plăți de verificat (${payments.length})`}>
        {payments.map((t) => <Item key={t.id} title={t.title} sub={`${t.payment_status} · ${formatLei(t.final_price_bani ?? t.hold_bani)}`} />)}
      </Section>
      <Section title={`Certificate în așteptare (${certs.length})`}>
        {certs.map((c) => (
          <Item key={c.id} title={c.name} sub={`${c.category} · ${c.issuer || 'emitent necompletat'}`}>
            <button style={btnLine} onClick={async () => {
              const { data } = await sb.storage.from('certificates').createSignedUrl(c.file_path, 300);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
            }}>Deschide</button>
            <button style={btn} onClick={() => act(() => sb.rpc('ops_review_certificate', { p_cert: c.id, p_approve: true }), 'Certificat aprobat')}>Aprobă</button>
            <button style={btnLine} onClick={() => act(() => sb.rpc('ops_review_certificate', { p_cert: c.id, p_approve: false }), 'Certificat respins')}>Respinge</button>
          </Item>
        ))}
      </Section>
    </Shell>
  );
}

const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 48, margin: '6px 0 12px', borderRadius: 12, border: '1.5px solid #ECE6DE', padding: '0 14px', font: 'inherit', fontSize: 16 };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: '#FBF7F2', minHeight: '100vh', color: '#151515', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontWeight: 800 }}>Jobzee · Operațiuni</h1>
        {children}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={card}><h2 style={{ marginTop: 0, fontSize: 18 }}>{title}</h2>{children}</section>;
}

function Item({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid #ECE6DE', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}><b>{title}</b><div style={{ color: '#686868', fontSize: 14 }}>{sub}</div></div>
      {children}
    </div>
  );
}
