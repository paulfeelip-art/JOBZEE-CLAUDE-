import type { IntakeDraft, PricingMode, TaskStatus } from '@jobzee/shared';

export interface ChatTurn { who: 'me' | 'ai'; text: string }

export interface IntakeInput {
  conversation: ChatTurn[];
  draft: Partial<IntakeDraft>;
  area: string;
  when: string;
  questionsAsked: number;
  photos?: Array<{ mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }>;
}

export interface NewTask {
  title: string;
  category: string;
  details: string[];
  aiNotes: string;
  people: number;
  areaLabel: string;
  lat: number;
  lng: number;
  address: string;
  accessNotes: string;
  scheduledFor: string | null;
  pricingMode: PricingMode;
  priceBani: number | null;
  rateBani: number | null;
  maxHours: number | null;
  minTier: number;
  needInvoice: boolean;
  invoiceCui: string | null;
}

export interface JobzerPublic {
  id: string;
  displayName: string;
  legalForm: 'persoana_fizica' | 'pfa' | 'ii' | 'srl';
  companyName: string | null;
  issuesInvoice: boolean;
  bio: string;
  languages: string[];
  tools: string[];
  vehicle: string;
  idVerified: boolean;
  insured: boolean;
  backgroundChecked: boolean;
  done: number;
  rating: number;
  reviewCount: number;
  onTimePct: number;
  tier: number;
  memberSince: string;
  /** Remote URL, or a bundled image (require) in demo mode. */
  photo: string | number | null;
  skills: Array<{ category: string; level: 'incepator' | 'experimentat' | 'calificat'; years: number }>;
}

export interface Review { id: string; stars: number; body: string; tags: string[]; authorName: string; createdAt: string; reply: string | null }

export interface TaskView {
  id: string;
  status: TaskStatus;
  title: string;
  category: string;
  details: string[];
  areaLabel: string;
  pricingMode: PricingMode;
  holdBani: number;
  serviceBani: number;
  finalPriceBani: number | null;
  paymentStatus: string;
  startCode: string | null; // client only
  address: string | null; // client, or Jobzer after confirmation
  jobzer: JobzerPublic | null;
  etaMin: number | null;
  createdAt: string;
}

export interface Offer {
  id: string;
  taskId: string;
  title: string;
  category: string;
  details: string[];
  areaLabel: string;
  distanceM: number;
  netBani: number;
  clientPaysBani: number;
  clientFirstName: string;
  expiresAt: string;
  scheduledFor: string | null;
}

export interface Message { id: number; mine: boolean; body: string; createdAt: string }

export interface Session { userId: string; phone: string; displayName: string }

export interface JobzeeApi {
  readonly mode: 'live' | 'demo';
  session(): Promise<Session | null>;
  sendCode(phoneE164: string): Promise<void>;
  verifyCode(phoneE164: string, code: string): Promise<Session>;
  signOut(): Promise<void>;

  intake(input: IntakeInput): Promise<IntakeDraft & { source: 'ai' | 'rules' }>;
  createTask(t: NewTask): Promise<string>;
  publishTask(id: string): Promise<number>;
  getTask(id: string): Promise<TaskView>;
  watchTask(id: string, onChange: (t: TaskView) => void): () => void;
  myTasks(): Promise<TaskView[]>;
  rejectMatch(id: string): Promise<void>;
  authorisePayment(id: string): Promise<{ clientSecret: string | null }>;
  completeTask(id: string): Promise<void>;
  cancelTask(id: string, reason: string): Promise<{ feeBani: number }>;
  submitReview(id: string, stars: number, tags: string[], body: string): Promise<void>;
  reportProblem(taskId: string, description: string): Promise<void>;
  messages(taskId: string): Promise<Message[]>;
  sendMessage(taskId: string, body: string): Promise<void>;

  jobzer(id: string): Promise<JobzerPublic>;
  reviewsFor(id: string): Promise<Review[]>;

  becomeJobzer(): Promise<void>;
  setAvailability(available: boolean, lat?: number, lng?: number): Promise<void>;
  myOffers(): Promise<Offer[]>;
  respondOffer(id: string, accept: boolean): Promise<boolean>;
  depart(taskId: string): Promise<void>;
  startTask(taskId: string, code: string): Promise<boolean>;
  finishTask(taskId: string): Promise<number>;
  payoutOnboardingUrl(): Promise<string>;
}
