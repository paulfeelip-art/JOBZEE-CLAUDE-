# Jobzee

Platformă locală pentru sarcini scurte: clientul descrie ce are nevoie (text, voce sau poze), **Jobzee AI** completează cererea, un **Jobzer** din apropiere o preia, plata se blochează pe card și se încasează doar după ce clientul confirmă lucrarea.

> Stare: **MVP tehnic, pre-pilot.** Codul rulează și e testat local. Nu e încă publicat în magazine, nu e conectat la un proiect Supabase sau Stripe real și nu procesează plăți reale. Vezi [docs/ROADMAP.md](docs/ROADMAP.md).

## Ce conține

| Director | Ce e | Tehnologie |
|---|---|---|
| `apps/mobile` | Aplicația iOS / Android (client + Jobzer) | Expo SDK 57, React Native, Expo Router |
| `apps/web` | Site de prezentare + consola de operațiuni (`/ops`) | Next.js 16 |
| `supabase/migrations` | Baza de date: schemă, reguli de acces (RLS), toate tranzițiile de stare | Postgres + PostGIS |
| `supabase/functions` | Funcții server: Jobzee AI, plăți, webhook Stripe, mentenanță | Deno (Supabase Edge Functions) |
| `packages/shared` | Regulile de business comune: comisioane, nivele, categorii, validări, ciclul sarcinii | TypeScript |
| `docs/` | Arhitectură, instalare, conformitate legală, roadmap | |

## Pornire rapidă

```bash
npm install
npm test                 # reguli comune + baza de date (Postgres real în proces) + funcții server
npm run mobile           # aplicația, în mod demonstrativ dacă nu e configurat Supabase
npm run web              # site-ul pe http://localhost:3000
```

Fără variabile de mediu, aplicația mobilă rulează în **mod demonstrativ**: Jobzeri, potriviri și plăți simulate pe telefon, nimic nu pleacă din dispozitiv. Configurarea completă (Supabase, Stripe în mod test, SMS, AI) e pas cu pas în [docs/SETUP.md](docs/SETUP.md).

## Teste

| Suită | Ce verifică | Comandă |
|---|---|---|
| `packages/shared` | comisioane, plafoane, nivele, CUI, IBAN, telefon, ciclul sarcinii, curățarea răspunsului AI | `npm run test -w @jobzee/shared` |
| `supabase/tests` | migrațiile reale pe Postgres + PostGIS (PGlite): RLS, potrivire după distanță/nivel/factură, cod de start, recenzii dublu-orb, anulări, dispute, auto-confirmare la 48 h; plus că SQL-ul și TypeScript-ul aplică aceleași reguli | `npm run test -w @jobzee/supabase` |
| `supabase/functions` | semnătura webhook Stripe, decontarea, AI cu reguli de rezervă | inclus în comanda de mai sus |
| `apps/mobile` | verificare de tipuri; fluxul complet al clientului a fost parcurs automat în build-ul web | `npm run typecheck -w @jobzee/mobile` |
| `apps/web` | build de producție | `npm run build -w @jobzee/web` |

## Principii

- **Banii sunt întregi, în bani** (1 leu = 100 bani). Aceleași formule în aplicație, server și bază de date, verificate de teste.
- **Nicio scriere directă în tabele** din aplicații: toate schimbările trec prin funcții din baza de date care verifică cine ești și dacă pasul e permis.
- **Refuzul unei oferte nu penalizează niciodată** (Directiva UE 2024/2831 privind munca pe platforme).
- **Adresa exactă** se vede doar după confirmare; ofertele arată o zonă rotunjită la ~300 m. **Codul de start** îl vede doar clientul.
- **Plăți reale dezactivate implicit**: cheile Stripe live sunt refuzate dacă nu se setează explicit `JOBZEE_ALLOW_LIVE_PAYMENTS=yes`.
