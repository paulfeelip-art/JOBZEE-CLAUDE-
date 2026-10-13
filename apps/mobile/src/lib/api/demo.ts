import { canTransition, fees, makeStartCode, rulesIntake, type Actor, type TaskStatus } from '@jobzee/shared';
import type { JobzeeApi, JobzerPublic, Message, NewTask, Offer, Review, Session, TaskView } from './types';

/**
 * Demo mode: runs the whole flow on the device with simulated people and payments.
 * Used when no Supabase project is configured (design reviews, store screenshots).
 * Nothing leaves the device and no money moves.
 */
const PEOPLE: JobzerPublic[] = [
  {
    id: 'demo-andrei', displayName: 'Andrei M.', legalForm: 'pfa', companyName: 'Munteanu Andrei PFA', issuesInvoice: true,
    bio: 'Montez mobilier de 4 ani, mai ales IKEA, Jysk și Dedeman. Vin cu unelte proprii și strâng după mine.',
    languages: ['Română', 'Engleză'], tools: ['Șurubelniță electrică', 'Bormașină', 'Nivelă laser'], vehicle: 'Mașină proprie',
    idVerified: true, insured: true, backgroundChecked: true, done: 163, rating: 4.9, reviewCount: 58, onTimePct: 97, tier: 3,
    memberSince: '2025-03-01', photo: require('../../../assets/demo/andrei.jpg'),
    skills: [{ category: 'mobilier', level: 'experimentat', years: 4 }, { category: 'interventii', level: 'experimentat', years: 3 }, { category: 'carat', level: 'incepator', years: 1 }],
  },
  {
    id: 'demo-ioana', displayName: 'Ioana P.', legalForm: 'persoana_fizica', companyName: null, issuesInvoice: false,
    bio: 'Fac curățenie, plimb câini și ridic cumpărături prin zonă, mai ales seara și în weekend.',
    languages: ['Română'], tools: ['Produse de curățenie proprii'], vehicle: 'Pe jos',
    idVerified: true, insured: false, backgroundChecked: false, done: 88, rating: 4.8, reviewCount: 71, onTimePct: 99, tier: 2,
    memberSince: '2025-01-10', photo: require('../../../assets/demo/ioana.jpg'),
    skills: [{ category: 'curatenie', level: 'experimentat', years: 3 }, { category: 'animale', level: 'experimentat', years: 2 }, { category: 'comisioane', level: 'incepator', years: 1 }],
  },
  {
    id: 'demo-radu', displayName: 'Radu C.', legalForm: 'srl', companyName: 'RC Tech Solutions SRL', issuesInvoice: true,
    bio: 'Tehnician IT atestat. Configurez rețele, imprimante, smart TV și laptopuri.',
    languages: ['Română', 'Engleză', 'Franceză'], tools: ['Laptop', 'Tester de rețea'], vehicle: 'Trotinetă electrică',
    idVerified: true, insured: true, backgroundChecked: true, done: 41, rating: 4.7, reviewCount: 36, onTimePct: 95, tier: 1,
    memberSince: '2025-06-01', photo: require('../../../assets/demo/radu.jpg'),
    skills: [{ category: 'tehnic', level: 'calificat', years: 6 }, { category: 'interventii', level: 'experimentat', years: 2 }, { category: 'mobilier', level: 'incepator', years: 1 }],
  },
];

const REVIEWS: Review[] = [
  { id: 'r1', stars: 5, body: 'Punctual și foarte atent. A montat dulapul în două ore și a strâns toate ambalajele.', tags: ['Punctual', 'Curat'], authorName: 'Elena V.', createdAt: '2026-10-02', reply: 'Mulțumesc, Elena!' },
  { id: 'r2', stars: 5, body: 'A venit mai devreme și a cărat 12 cutii fără nicio problemă.', tags: ['Rapid'], authorName: 'Victor S.', createdAt: '2026-09-21', reply: null },
  { id: 'r3', stars: 4, body: 'Rafturile sunt bine prinse. A durat puțin peste estimare, dar a anunțat din timp.', tags: ['Comunicativ'], authorName: 'Maria T.', createdAt: '2026-09-09', reply: null },
];

type DemoTask = TaskView & { input: NewTask };

export function createDemoApi(): JobzeeApi {
  let session: Session | null = null;
  const tasks = new Map<string, DemoTask>();
  const watchers = new Map<string, Set<(t: TaskView) => void>>();
  let available = false;
  let offers: Offer[] = [];
  const chats = new Map<string, Message[]>();
  const later = (ms: number, f: () => void) => setTimeout(f, ms);

  const emit = (id: string) => {
    const t = tasks.get(id);
    if (t) watchers.get(id)?.forEach((cb) => cb({ ...t }));
  };
  const move = (id: string, to: TaskStatus, actor: Actor) => {
    const t = tasks.get(id);
    if (!t) throw new Error('task_not_found');
    if (!canTransition(t.status, to, actor)) throw new Error(`transition_not_allowed: ${t.status} -> ${to}`);
    t.status = to;
    emit(id);
  };

  return {
    mode: 'demo',
    async session() { return session; },
    async sendCode() { await new Promise((r) => setTimeout(r, 500)); },
    async verifyCode(phone, code) {
      if (!/^\d{6}$/.test(code)) throw new Error('Codul are 6 cifre.');
      session = { userId: 'demo-me', phone, displayName: 'Paul F.' };
      return session;
    },
    async signOut() { session = null; },

    async intake(input) {
      await new Promise((r) => setTimeout(r, 700));
      return { ...rulesIntake(input), source: 'rules' as const };
    },
    async createTask(t) {
      const id = `demo-${Date.now()}`;
      const hold = t.pricingMode === 'hourly' ? (t.rateBani ?? 0) * (t.maxHours ?? 1) : t.priceBani ?? 6000;
      tasks.set(id, {
        id, status: 'draft', title: t.title, category: t.category, details: t.details, areaLabel: t.areaLabel, pricingMode: t.pricingMode,
        holdBani: hold, serviceBani: fees(hold).service, finalPriceBani: null, paymentStatus: 'none', startCode: makeStartCode(),
        address: t.address, jobzer: null, etaMin: null, createdAt: new Date().toISOString(), input: t,
      });
      return id;
    },
    async publishTask(id) {
      move(id, 'searching', 'client');
      const t = tasks.get(id)!;
      const pick = PEOPLE.find((p) => p.skills.some((s) => s.category === t.category) && p.tier >= t.input.minTier && (!t.input.needInvoice || p.issuesInvoice));
      later(2600, () => {
        if (!pick || tasks.get(id)?.status !== 'searching') return;
        t.jobzer = pick;
        t.etaMin = 8;
        move(id, 'matched', 'jobzer');
      });
      return pick ? 3 : 0;
    },
    async getTask(id) {
      const t = tasks.get(id);
      if (!t) throw new Error('task_not_found');
      return { ...t };
    },
    watchTask(id, cb) {
      if (!watchers.has(id)) watchers.set(id, new Set());
      watchers.get(id)!.add(cb);
      return () => watchers.get(id)?.delete(cb);
    },
    async myTasks() { return [...tasks.values()].reverse(); },
    async rejectMatch(id) {
      const t = tasks.get(id)!;
      const current = t.jobzer?.id;
      move(id, 'searching', 'client');
      t.jobzer = null;
      later(2200, () => {
        const next = PEOPLE.find((p) => p.id !== current && p.skills.some((s) => s.category === t.category));
        if (next && t.status === 'searching') { t.jobzer = next; t.etaMin = 11; move(id, 'matched', 'jobzer'); }
      });
    },
    async authorisePayment(id) {
      later(900, () => {
        const t = tasks.get(id)!;
        t.paymentStatus = 'authorised';
        move(id, 'confirmed', 'client');
        // Simulate the Jobzer: leaves, arrives, starts, finishes.
        later(3000, () => move(id, 'en_route', 'jobzer'));
      });
      return { clientSecret: null };
    },
    async completeTask(id) {
      const t = tasks.get(id)!;
      move(id, 'completed', 'client');
      t.paymentStatus = 'captured';
      emit(id);
    },
    async cancelTask(id) {
      const t = tasks.get(id)!;
      const fee = t.status === 'en_route' ? 1500 : 0;
      move(id, 'cancelled', 'client');
      return { feeBani: fee };
    },
    async submitReview() { await new Promise((r) => setTimeout(r, 300)); },
    async reportProblem() { await new Promise((r) => setTimeout(r, 300)); },
    async messages(taskId) { return chats.get(taskId) ?? []; },
    async sendMessage(taskId, body) {
      const t = tasks.get(taskId);
      if (!t || ['draft', 'searching', 'matched', 'cancelled'].includes(t.status)) throw new Error('chat_closed');
      const list = chats.get(taskId) ?? [];
      list.push({ id: list.length + 1, mine: true, body, createdAt: new Date().toISOString() });
      chats.set(taskId, list);
      later(1500, () => list.push({ id: list.length + 1, mine: false, body: 'Am văzut. Ajung cât de repede pot.', createdAt: new Date().toISOString() }));
    },

    async jobzer(id) {
      const j = PEOPLE.find((p) => p.id === id);
      if (!j) throw new Error('not_found');
      return j;
    },
    async reviewsFor() { return REVIEWS; },

    async becomeJobzer() {},
    async setAvailability(on) {
      available = on;
      if (on) {
        later(3500, () => {
          if (!available) return;
          offers = [{
            id: 'demo-offer-1', taskId: 'demo-remote', title: 'Montaj comodă cu 3 sertare', category: 'mobilier', details: ['Comodă nouă, ambalată', 'Etajul 2, cu lift'],
            areaLabel: 'Titan', distanceM: 600, netBani: fees(15000).net, clientPaysBani: 15000, clientFirstName: 'Elena',
            expiresAt: new Date(Date.now() + 45_000).toISOString(), scheduledFor: null,
          }];
        });
      } else offers = [];
    },
    async myOffers() { return available ? offers : []; },
    async respondOffer(id, accept) {
      offers = offers.filter((o) => o.id !== id);
      return accept;
    },
    async depart(taskId) { const t = tasks.get(taskId); if (t) move(taskId, 'en_route', 'jobzer'); },
    async startTask(taskId, code) {
      const t = tasks.get(taskId);
      if (!t || t.startCode !== code) return false;
      move(taskId, 'in_progress', 'jobzer');
      return true;
    },
    async finishTask(taskId) {
      const t = tasks.get(taskId)!;
      t.finalPriceBani = t.holdBani;
      move(taskId, 'awaiting_confirmation', 'jobzer');
      return t.holdBani;
    },
    async payoutOnboardingUrl() { return 'https://connect.stripe.com/express/onboarding'; },
  };
}

/** Lets a demo viewer push their own simulated task forward (the Jobzer side). */
export async function demoAdvance(api: JobzeeApi, task: TaskView): Promise<void> {
  if (api.mode !== 'demo') return;
  if (task.status === 'en_route' && task.startCode) await api.startTask(task.id, task.startCode);
  else if (task.status === 'in_progress') await api.finishTask(task.id);
}
