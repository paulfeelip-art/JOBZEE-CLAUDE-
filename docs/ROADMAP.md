# Ce e gata și ce urmează

## Gata (în acest repository, testat local)

- Reguli comune: comisioane, plafoane, nivele, categorii, validări, ciclul sarcinii.
- Baza de date completă cu RLS, potrivire geografică, cod de start, muncă în plus, recenzii dublu-orb, dispute, auto-confirmare, consola operațională.
- Jobzee AI (Claude) cu analiză de poze și reguli de rezervă.
- Plăți Stripe Connect în mod test: autorizare, captură, anulare, taxă de anulare tardivă, onboarding Jobzeri, webhook.
- Aplicația mobilă: autentificare cu SMS, cerere cu Jobzee AI, preț, potrivire, plată, sarcina live, chat, recenzii, modul Jobzer cu oferte; mod demonstrativ.
- Site de prezentare și consola `/ops`.

## Înainte de pilot (prioritate)

1. Conturile tale: Supabase, Stripe, SMS, Anthropic, Apple, Google (vezi [SETUP.md](SETUP.md)).
2. Ecranele Jobzerului pentru sarcina acceptată în aplicația reală: navigare, introducerea codului de start, poze ca dovadă, „Am terminat” (funcțiile din backend există și sunt testate).
3. Notificări push (Expo Notifications) pentru oferte, confirmări și mesaje.
4. Acordul pentru începerea imediată (drept de retragere) la autorizarea plății.
5. Verificarea identității Jobzerilor (Stripe Identity) și fluxul de cazier.
6. Integrare SmartBill sau Oblio pentru facturi reale și e-Factura.
7. Termeni, politica de confidențialitate, pagina despre potrivire și nivele.
8. Localizarea live a Jobzerului pe drum (actualizări din aplicația lui, afișare pe harta clientului).

## După pilot

- A doua plată pentru munca în plus peste suma autorizată (metodă de plată salvată).
- Adaptor Netopia ca alternativă locală la Stripe.
- Export DAC7 anual.
- Panou de analiză pentru operațiuni (conversie, timp până la potrivire, anulări).
- Clienți firmă cu facturare lunară.
