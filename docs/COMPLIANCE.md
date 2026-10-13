# Conformitate: România și UE

Listă de lucru pentru lansarea pilotului. **Nu este consultanță juridică sau fiscală**; fiecare punct trebuie confirmat cu un avocat și un contabil înainte de lansare.

| Domeniu | Cerință | Ce face deja produsul | Ce rămâne |
|---|---|---|---|
| Munca pe platforme (Directiva UE 2024/2831, transpunere până la 2 decembrie 2026) | Transparența algoritmilor, fără penalizare pentru refuz, revizuire umană | Nivele cu reguli publice; refuzul și expirarea ofertelor nu contează; disputele merg la un om (`ops_resolve`) | Pagina publică „Cum funcționează potrivirea”; procedură de contestare a nivelului; analiza statutului (independent) cu avocat |
| DAC7 (OG 16/2023) | Raportarea veniturilor vânzătorilor la ANAF, până la 31 ianuarie | Toate tranzacțiile și comisioanele sunt în baza de date pe Jobzer | Export anual DAC7 și colectarea datelor fiscale (CNP/CUI, adresă) prin onboarding |
| Facturare | Factură pentru taxa de serviciu (Jobzee) și pentru comision (către Jobzer); e-Factura pentru B2B | Se creează documentele (`documents`) la încasare | Integrare SmartBill sau Oblio pentru emitere și e-Factura; numerotare; TVA 21% pe serviciile Jobzee dacă firma e plătitoare |
| Jobzeri PFA / II / SRL | Ei emit factura pentru lucrare | Clienții care cer factură primesc doar Jobzeri cu firmă; CUI verificat cu cifra de control | Verificare CUI în registrul ANAF (API public) |
| Persoane fizice (venituri ocazionale) | Declarație unică, impozit 10% și contribuții peste plafoane | Informare în aplicație | Ghid fiscal pentru Jobzeri; prag de trecere la PFA |
| Plăți (PSD2) | Banii clienților nu trec prin contul Jobzee | Stripe Connect cu captură manuală, plăți direct către contul Jobzerului | Contract Stripe, termeni Connect, verificarea disponibilității pentru România |
| Protecția consumatorului (OUG 34/2014) | Informare precontractuală, drept de retragere 14 zile | Acord explicit cerut pentru începerea imediată (de implementat în aplicație la autorizarea plății) | Termeni și condiții, ANPC, SOL în subsolul site-ului |
| Regulamentul P2B 2019/1150 | Termeni clari pentru prestatori, motivarea suspendării | — | Termeni pentru Jobzeri, procedură de suspendare cu motivare și contestare |
| DSA | Punct de contact, raportarea conținutului ilegal | Raportare incident din sarcină | Punct de contact public, raport anual simplificat |
| GDPR | Bază legală, minimizare, drepturile persoanei | Adresă și cod vizibile doar cine trebuie; număr mascat; date de contact blocate înainte de confirmare | Politica de confidențialitate, DPA cu furnizorii (Supabase, Stripe, Twilio, Anthropic), registru de prelucrări, DPIA pentru localizare |
| Lucrări reglementate | Instalații electrice (ANRE), gaze, termice | Detectate și blocate în pilot; „Calificat” doar cu certificat verificat | Flux pentru meserii autorizate, după pilot |
| Siguranță | Verificare identitate, cazier pentru intervenții în casă | Câmpuri și reguli de nivel; consola de verificare | Furnizor de verificare (Stripe Identity sau Veriff), procedură cazier, asigurare de răspundere |
| Minori | Doar adulți | Mesaj în aplicație | Verificarea vârstei în onboarding (prin furnizorul de identitate) |
