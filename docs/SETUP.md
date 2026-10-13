# Instalare și configurare (mediu de test)

Totul de mai jos folosește **modul de test**. Nimic din acest ghid nu creează tranzacții reale.

## 1. Supabase

1. Creează un proiect pe supabase.com (regiune UE, de exemplu Frankfurt).
2. Instalează CLI-ul și leagă proiectul:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF>
   npx supabase db push            # aplică supabase/migrations
   ```
3. **Auth → Providers → Phone**: activează, alege furnizorul SMS (de exemplu Twilio Verify) și pune credențialele de test.
4. **Ops**: după ce te autentifici o dată în aplicație, marchează-ți contul ca operator:
   ```sql
   update public.profiles set is_ops = true where phone_e164 = '+40…';
   ```

## 2. Secrete pentru funcțiile server

```bash
npx supabase secrets set \
  ANTHROPIC_API_KEY=… \
  ANTHROPIC_MODEL=claude-sonnet-5-5 \
  STRIPE_SECRET_KEY=sk_test_… \
  STRIPE_PUBLISHABLE_KEY=pk_test_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  CRON_SECRET=$(openssl rand -hex 24) \
  APP_RETURN_URL=jobzee://payouts \
  ALLOWED_ORIGIN=https://jobzee.ro
npx supabase functions deploy ai-intake payments-authorize task-complete task-cancel connect-onboarding
npx supabase functions deploy stripe-webhook cron-maintenance --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` sunt puse automat de Supabase.
Fără `ANTHROPIC_API_KEY`, Jobzee AI folosește regulile locale (aceleași întrebări pe categorie).

## 3. Stripe (mod test)

1. Cont Stripe pentru entitatea Jobzee, cu **Connect** activat (conturi *Express*, țara RO, moneda RON). Verifică în dashboard că România e disponibilă pentru platforma ta înainte de pilot.
2. **Developers → Webhooks**: endpoint `https://<REF>.functions.supabase.co/stripe-webhook`, cu evenimentele:
   `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated`.
   Copiază semnătura în `STRIPE_WEBHOOK_SECRET`.
3. Pentru testare folosește cardurile de test Stripe și conturi Express de test.

## 4. Sarcina programată

În Supabase → **Integrations → Cron** (sau pg_cron + pg_net), la fiecare 2 minute:
`POST https://<REF>.functions.supabase.co/cron-maintenance` cu header-ul `x-cron-secret: <CRON_SECRET>`.
Face: expiră ofertele și invită următorii Jobzeri, confirmă automat sarcinile după 48 h și încasează, publică recenziile după 14 zile.

## 5. Aplicația mobilă

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # completează URL, cheia anon și pk_test
npm run mobile
```

Aplicația folosește module native (hărți, Stripe, locație), deci pentru telefon e nevoie de un *development build*:

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform ios     # sau android
```

Pentru Android, pune cheia Google Maps în variabila `GOOGLE_MAPS_ANDROID_KEY` din EAS.

## 6. Site și consolă

```bash
cp apps/web/.env.example apps/web/.env.local
npm run web     # http://localhost:3000 și http://localhost:3000/ops
```

Se poate publica pe Vercel sau Netlify (proiect Next.js, directorul `apps/web`).

## Ce trebuie să ai tu, ca proprietar

| Cont | Pentru ce |
|---|---|
| Supabase | bază de date, autentificare, funcții |
| Stripe (Connect) | plăți în escrow și plăți către Jobzeri |
| Twilio (sau alt SMS) | coduri de confirmare |
| Anthropic API | Jobzee AI |
| Apple Developer + Google Play | publicarea aplicației |
| Google Maps Platform | harta pe Android |
| Domeniu jobzee.ro | site și legături |
