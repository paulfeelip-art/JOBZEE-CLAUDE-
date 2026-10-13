# Arhitectură

```
 Aplicația mobilă (Expo)          Site + consola /ops (Next.js)
        │  supabase-js (JWT utilizator)          │
        ▼                                        ▼
 ┌──────────────────────── Supabase ─────────────────────────┐
 │ Auth (SMS OTP)   Postgres + PostGIS + RLS   Storage   Realtime │
 │                  funcții SQL (create_task, publish_task,      │
 │                  respond_offer, start_task, complete_task…)   │
 │ Edge Functions: ai-intake · payments-authorize · task-complete │
 │                 task-cancel · stripe-webhook · connect-onboarding│
 │                 cron-maintenance                               │
 └───────────┬──────────────────────────────┬───────────────────┘
             ▼                              ▼
     API Claude (Jobzee AI)        Stripe Connect (RON, captură manuală)
```

## Fluxul unei sarcini

| Pas | Cine | Unde se întâmplă | Stare |
|---|---|---|---|
| Descrie cererea (text, poze) | client | `ai-intake` → Claude, cu reguli de rezervă | — |
| Alege prețul, adresa, nivelul minim, factura | client | `create_task` | `draft` |
| Publică | client | `publish_task` → `_match_offers` (PostGIS, nivel, factură, disponibilitate) | `searching` |
| Acceptă oferta (45 s, refuz fără penalizare) | Jobzer | `respond_offer` | `matched` |
| Confirmă și autorizează plata | client | `payments-authorize` → Stripe PaymentSheet → webhook `amount_capturable_updated` → `mark_payment_authorised` | `confirmed` |
| Pleacă spre adresă | Jobzer | `jobzer_depart` | `en_route` |
| Începe cu codul de start | Jobzer | `start_task(code)` | `in_progress` |
| Muncă în plus (opțional) | Jobzer propune, clientul aprobă | `propose_extra`, `respond_extra` | — |
| Termină | Jobzer | `finish_task` (calculează prețul final, pe oră la sfert de oră, cu plafon) | `awaiting_confirmation` |
| Confirmă și plătește | client (sau automat după 48 h) | `task-complete` → `complete_task` → captură Stripe → documente | `completed` |
| Recenzii dublu-orb | ambele părți | `submit_review` (publicate când au evaluat amândoi sau după 14 zile) | — |

Tranzițiile permise sunt în tabelul `task_transitions` și în `packages/shared/src/lifecycle.ts`; un test verifică faptul că sunt identice.

## Banii

Exemplu, lucrare de 150 lei:

| | Lei |
|---|---|
| Clientul plătește lucrarea | 150,00 |
| + taxa de serviciu Jobzee 4,9% (max. 25 lei) | 7,35 |
| **Se blochează și se încasează de pe card** | **157,35** |
| Comision Jobzee 12% din lucrare | −18,00 |
| **Jobzerul primește** | **132,00** |
| Venitul Jobzee (`application_fee_amount`) | 25,35 |

Implementare: Stripe Connect, *destination charges*, `capture_method=manual`. Suma autorizată e prețul maxim (fix sau plafonul orar); la final se capturează prețul real. Dacă munca în plus depășește suma autorizată, diferența rămâne marcată `requires_action` pentru o a doua plată (vezi roadmap).

## Securitate și confidențialitate

- RLS pe toate tabelele; aplicațiile au doar `select` filtrat și apeluri de funcții. Coloanele sensibile (verificări, `is_ops`, conturi de plată) nu pot fi scrise de utilizatori.
- `task_addresses`: clientul, iar Jobzerul doar între confirmare și finalizare. `task_codes`: doar clientul.
- Ofertele (`my_offers`) arată zona rotunjită, prenumele clientului și suma netă.
- Date de contact blocate în întrebările de dinainte de confirmare (`has_contact_details`); chat-ul se deschide doar după confirmare.
- Webhook Stripe verificat prin semnătură HMAC; funcțiile programate cer `x-cron-secret`.
- Consola `/ops` folosește aceleași reguli: fără `is_ops`, nu vede nimic în plus.
