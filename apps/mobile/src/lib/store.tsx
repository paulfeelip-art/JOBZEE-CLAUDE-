import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import type { IntakeDraft, PricingMode } from '@jobzee/shared';
import { api, type ChatTurn, type Session } from './api';

/** Where the help is needed. Falls back to central Bucharest until the user shares location. */
export interface Place { lat: number; lng: number; label: string; precise: boolean }
const FALLBACK: Place = { lat: 44.4268, lng: 26.1025, label: 'București', precise: false };

export interface RequestState {
  conversation: ChatTurn[];
  draft: (IntakeDraft & { source: 'ai' | 'rules' }) | null;
  questionsAsked: number;
  when: 'now' | 'today' | 'later';
  pricing: PricingMode;
  amountLei: number;
  rateLei: number;
  maxHours: number;
  minTier: number;
  needInvoice: boolean;
  invoiceCui: string;
  address: string;
  taskId: string | null;
}

const emptyRequest = (): RequestState => ({
  conversation: [], draft: null, questionsAsked: 0, when: 'now', pricing: 'fixed', amountLei: 150, rateLei: 65, maxHours: 2,
  minTier: 0, needInvoice: false, invoiceCui: '', address: '', taskId: null,
});

interface Store {
  session: Session | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
  mode: 'help' | 'earn';
  setMode: (m: 'help' | 'earn') => void;
  place: Place;
  locate: () => Promise<Place>;
  request: RequestState;
  updateRequest: (patch: Partial<RequestState>) => void;
  resetRequest: () => void;
  isDemo: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'help' | 'earn'>('help');
  const [place, setPlace] = useState<Place>(FALLBACK);
  const [request, setRequest] = useState<RequestState>(emptyRequest);

  useEffect(() => {
    api.session().then((s) => { setSession(s); setReady(true); }).catch(() => setReady(true));
  }, []);

  const locate = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return place;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let label = 'Locația ta';
      try {
        const [g] = await Location.reverseGeocodeAsync(pos.coords);
        if (g) label = [g.district ?? g.street, g.city].filter(Boolean).join(', ') || label;
      } catch { /* reverse geocoding is optional */ }
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, label, precise: true };
      setPlace(p);
      return p;
    } catch {
      return place;
    }
  }, [place]);

  const value = useMemo<Store>(() => ({
    session, ready, setSession, mode, setMode, place, locate, request,
    updateRequest: (patch) => setRequest((r) => ({ ...r, ...patch })),
    resetRequest: () => setRequest(emptyRequest()),
    isDemo: api.mode === 'demo',
  }), [session, ready, mode, place, locate, request]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export const whenLabel = (w: RequestState['when']) => (w === 'now' ? 'Acum' : w === 'today' ? 'Astăzi, după 17:00' : 'Programat');

export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const known: Record<string, string> = {
    phone_not_verified: 'Confirmă-ți numărul de telefon ca să publici cererea.',
    price_out_of_range: 'Prețul trebuie să fie între 20 și 5.000 lei.',
    outside_romania: 'Deocamdată Jobzee funcționează doar în România.',
    chat_closed: 'Chat-ul se deschide după ce confirmi Jobzerul.',
    jobzer_payouts_not_ready: 'Jobzerul nu și-a terminat configurarea plăților. Alege altă variantă.',
    verification_incomplete: 'Termină verificarea identității și a contului de încasări.',
    contact_details_not_allowed: 'Nu poți trimite date de contact înainte de confirmare.',
  };
  const key = Object.keys(known).find((k) => m.includes(k));
  return key ? known[key]! : 'Ceva n-a mers. Încearcă din nou.';
}
