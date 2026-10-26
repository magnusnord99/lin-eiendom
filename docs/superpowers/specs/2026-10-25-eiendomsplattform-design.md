# Yappuccino internt adminpanel — designdokument

**Dato:** 2026-10-25
**Status:** Utkast til godkjenning

## 1. Hvorfor

Yappuccino AS (fire eiere: Magnus, Øystein, Oskar, Simen) kjøper, renoverer og
selger/leier ut boliger. I dag styres alt manuelt via Messenger + et delt
Google-ark ("Et helvete i Spjelkavika") for den ene eiendommen de holder på
med nå. Arket inneholder kapitalinnskudd, utgifter, timeregistrering,
budsjett per delprosjekt, leverandørsammenligning og en fortjenestefordeling
splittet på kapital-andel og arbeidstimer-andel.

Dette fungerer, men er tungvint — særlig timeregistrering — og skalerer ikke
når de får flere eiendommer samtidig, som de snart vil ha.

Målet er å bygge videre på det eksisterende Next.js-adminpanelet
(i dag: boligliste + henvendelser, ~500 linjer) til et internt system som
dekker den samme kjernen som arket gjør i dag, men raskere å bruke og klart
for flere eiendommer — pluss en delt tilgjengelighetskalender, som er nytt
behov arket ikke løser.

Dette er et flerukers byggeprosjekt, ikke en liten utvidelse.

## 2. Hva vi fant ved å analysere eksisterende kode

- **Stack:** Next.js 16 (App Router), Prisma 7 + libsql (SQLite), NextAuth v4,
  Tailwind v4. Beholdes som er — ingen grunn til å bytte.
- **Eksisterende modeller:** `Bolig` (boliger som vises på det offentlige
  nettstedet), `Henvendelse` (kontaktformular), og en `AdminUser`-modell som
  finnes i databasen men **ikke er koblet til innlogging** — den er død kode.
- **Kritisk funn:** Dagens innlogging er ett delt brukernavn/passord satt via
  miljøvariabler (`ADMIN_USERNAME`/`ADMIN_PASSWORD`), ikke individuelle
  kontoer. Dette **blokkerer** kjernefunksjoner som per-person
  timeregistrering og tilgjengelighetskalender — systemet vet ikke hvem som
  er logget inn. Å gå over til egne innlogginger per eier er derfor en
  forutsetning for resten av planen, ikke en egen fase.
- Det offentlige nettstedet (forside, kontaktformular, Resend-e-post) skal
  ikke brytes under dette arbeidet.

## 3. Mål

- Fjerne Excel + Messenger som verktøy for: kapital/innskudd, utgifter,
  budsjett, timeregistrering, dokumenter og fortjenestefordeling — per
  eiendom.
- Gjøre timeregistrering og utgiftsregistrering vesentlig raskere enn i dag
  (mobilvennlig rask-registrering, ikke et regneark).
- Gi en delt kalender hvor de fire ser hverandres tilgjengelighet og raskt
  finner overlappende dager.
- Gjøre eiendom til sentral enhet i systemet, med plass til et ubegrenset
  antall eiendommer, selv om det bare finnes én i dag.
- Lagre dokumenter (fakturaer, kvitteringer, bilder, tegninger) knyttet til
  riktig eiendom/delprosjekt.
- Bygge datamodellen slik at en fremtidig begrenset ekstern rolle
  (håndverkere som kun fører egne timer) kan legges til senere uten
  restrukturering — men **ikke bygge den rollen nå**.

## 4. Ikke nå (bevisst utelatt fra denne omgangen)

- Formelt oppgavesystem/Kanban med status, kommentarer og sjekklister.
  Delprosjekt + budsjett dekker dagens behov for gruppering av arbeid.
- Full tilbuds-/anbudsflyt med godkjenningsstatus og bindende kostnader.
  En enkel leverandørsammenligning per delprosjekt (som "Vinduer"-arket)
  dekker det reelle behovet i dag.
- Utleieforvaltning (leietakere, leiekontrakter, leieinntekt) — ingen
  utleid eiendom finnes ennå.
- Ekstern/håndverker-tilgang og rettighetsstyring for dette — bekreftet
  utsatt av dere.
- Flere lån/finansieringsplaner, varsler, globalt søk, revisjonslogg,
  CSV/Excel-eksport, native mobilapp.
- Noe som skal erstatte ordentlig regnskapsføring.

Disse tas opp igjen som senere faser når dere faktisk har et reelt behov
(f.eks. når første eiendom skal leies ut, eller når eksterne skal inn).

## 5. Hva som gjør dette til en fiasko selv om det "funker"

- Systemet er tregere eller krunglete enn Excel, og dere glir tilbake til
  arket og Messenger.
- Det offentlige nettstedet (boligliste, kontaktformular) slutter å virke
  under ombyggingen.
- Pengeberegninger (fortjenestefordeling kapital/arbeid, budsjettstatus) er
  en svart boks dere ikke kan etterprøve manuelt.
- Datamodellen er bygget som om det alltid bare er én eiendom og fire
  brukere, slik at neste eiendom eller bruker krever om-bygging.

## 6. Avgjørelser tatt i samtalen

- **Eiendom er sentral enhet.** Vi utvider eksisterende `Bolig`-modell i
  stedet for å lage en parallell "Eiendom"-tabell — samme fysiske bolig
  er både det som vises på det offentlige nettstedet (når til salgs/leie)
  og det interne investeringsobjektet. Statusfelt styrer hva som vises
  offentlig (f.eks. "under oppussing" vises ikke, "til salgs"/"til leie"
  gjør).
- **Økonomi føres per eiendom, ikke i en felles pott.** Hver eiendom har
  egne kapitalinnskudd, eierandeler, utgifter, budsjett og
  fortjenestefordeling — i tråd med egen anbefaling om å skille
  selskapets økonomi fra hver eiendoms økonomi. Et selskaps-dashboard
  aggregerer tallene over alle eiendommer.
- **Delprosjekt er knytningspunktet.** Hver eiendom har delprosjekter
  (f.eks. "Kjøkken", "Bad", "Fasade"), hver med eget budsjett. Timer,
  utgifter og dokumenter knyttes til eiendom + delprosjekt — akkurat som
  "Karl Johns Veg – Kjøkken"-eksempelet.
- **Fortjeneste beregnes to veier**, som i dagens ark: etter kapitalandel
  og etter arbeidstimer-andel, per eiendom.
- **Fase 1-brukere er kun de fire eierne**, alle med samme rolle/adgang.
  Datamodellen (bruker, rolletabell) bygges slik at en begrenset rolle kan
  legges til senere, men UI/tilgangskontroll for det bygges ikke nå.
- **Individuelle innlogginger erstatter delt admin-login** — forutsetning
  for alt per-person (timer, tilgjengelighet).

## 7. Moduler i denne omgangen (med datamodell-skisse)

### 7.1 Eiendom (utvidelse av `Bolig`)
Nye felt: status (vurderes / kjøpt / planlegging / under oppussing / klar
for utleie / utleid / til salgs / solgt), kjøpesum, kjøpsdato, finansiering
(fritekst/beløp), estimert verdi nå, estimert verdi etter oppussing.
Eksisterende felt (tittel, adresse, bilder, lat/lng osv.) beholdes for det
offentlige nettstedet.

### 7.2 Delprosjekt
`eiendomId`, navn, beskrivelse, budsjett (planlagt kostnad), status
(planlagt / pågår / ferdig).

### 7.3 Kapital & innbetalinger (per eiendom)
Hvem (eier) har skutt inn hvor mye og når → beregnet eierandel i %.

### 7.4 Utgifter
Dato, eiendom, delprosjekt, kategori, beskrivelse, leverandør, beløp,
betalt av (person eller "driftskonto"), kvitteringsbilde. Oppdaterer
budsjettstatus automatisk (planlagt vs. faktisk).

**Presisering av "driftskonto":** driftskontoen er knyttet til den enkelte
eiendom, ikke en selskaps-bred pott — den består av kapitalinnskuddene
(§7.3) som eierne har satt inn *for nettopp denne eiendommen*. "Betalt av:
driftskonto" betyr at utgiften er betalt fra disse innsatte pengene (ingen
enkeltperson skal krediteres for å ha lagt ut penger selv), mens "betalt
av: [person]" betyr personen la ut for det selv. Dette bryter ikke §6 —
det er fortsatt per eiendom.

### 7.5 Timeregistrering
Dato, person, eiendom, delprosjekt, antall timer (+ ev. start/slutt),
beskrivelse. Rask mobilvennlig registrering er kravet — ikke nødvendigvis
en live timer i første versjon (forslag, se §9).

### 7.6 Fortjenestefordeling
Overskuddet (fortjenesten) på en eiendom fordeles slik, per i dag:

- **80 %** deles likt på de fire eierne (25 % hver).
- **10 %** fordeles etter arbeidstimeandel (hvem har jobbet mest på denne
  eiendommen).
- **10 %** fordeles etter kapitalandel (hvem har investert mest i
  oppussingen av denne eiendommen).

De to prosentsatsene (10 %/10 %) skal være konfigurerbare verdier i
systemet, ikke hardkodet — eierne har sagt disse kan endres i fremtiden.
Beregningen må vise alle tre delene separat og synlig per eier, ikke bare
en samlet sum, slik at den er etterprøvbar (jf. §5).

### 7.7 Dokumenter
Opplasting knyttet til eiendom og/eller delprosjekt, med kategori
(kontrakt, faktura, kvittering, bilde, tegning, annet).

### 7.8 Kalender & tilgjengelighet
Hver eier markerer ledige/ikke-ledige dager (inkl. tidsintervaller og
gjentakende mønster). Kalendervisning (måned/uke) med fargekoding, og en
visning som fremhever dager hvor flest har overlappende tilgjengelighet.
Enkle arbeidshendelser kan opprettes og knyttes til en eiendom.

### 7.9 Selskaps-dashboard
Aggregert oversikt: antall eiendommer, totale investeringer, totale
utgifter denne måneden, utgift per eiendom, budsjett vs. faktisk per
eiendom, kommende aktiviteter fra kalenderen.

## 8. Faser etter denne omgangen (ikke del av nåværende bygg)

- Fase 2: Formell oppgavestyring/Kanban, hvis delprosjekt-nivået blir for
  grovkornet i praksis.
- Fase 3: Ekstern/håndverker-tilgang med begrenset rolle.
- Fase 4: Utleieforvaltning, når første eiendom faktisk leies ut.
- Fase 5: Rapportering/eksport, varsler, globalt søk.

## 9. Overlatt til bygger (mine valg, merket som sådan)

- **Autentiseringsmetode:** NextAuth Credentials-provider (som i dag), men
  validert mot individuelle `AdminUser`-kontoer (bcrypt-hashet passord) i
  stedet for miljøvariabler. De fire kontoene seedes manuelt i databasen
  ved oppsett — ingen selvregistrering/invitasjonsflyt nå, siden det kun
  er fire kjente personer. Dagens delte `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  fases ut i samme slutt (ikke en overgangsperiode med begge aktive).
- **Offentlig synlighet per status** (§7.1), full mapping: "vurderes",
  "kjøpt", "planlegging" og "under oppussing" vises ikke offentlig.
  "Klar for utleie" og "til salgs" vises i boligoversikten. "Utleid" og
  "solgt" fjernes fra den offentlige listen (samme logikk som dagens
  `aktiv`-flagg), men beholdes i det interne systemet som historikk.
- **Leverandørsammenligning per delprosjekt** (enkel liste: leverandør,
  pris, lenke, bestilt-status) — foreslått fordi dagens ark aktivt bruker
  dette (vinduer, handlelister), selv om det ikke ble bekreftet direkte i
  samtalen. Flagges for bekreftelse.
- **Timer-UX:** rask-registrering (dato + antall timer + evt. fra/til) som
  MVP; live start/stopp-timer som mulig forbedring senere.
- **Dokumentlagring:** krever ekstern filtjeneste (sannsynligvis Vercel
  Blob) — velges endelig via Vercel Marketplace-oppsett når
  implementasjonen starter, ikke låst i dette dokumentet.
- **Kalender-visning:** månedsvisning som standard med ukesvisning som
  alternativ; nøyaktig fargekoding/layout avgjøres i planfasen.
- Eksakte feltnavn/validering for hvert nytt skjema avgjøres i
  implementasjonsplanen, ikke her.

## 9b. Migrering av eksisterende data

Historikken i Google-arket for Spjelkavika (kapitalinnskudd, utgifter,
timeregistreringer) skal importeres inn i det nye systemet, ikke startes
blankt. Dette krever en egen importmekanisme (innlesing av arkets
struktur, mapping til de nye modellene i §7.3–7.5) som en del av
implementasjonsplanen — ikke bare en engangs-SQL-import uten validering,
siden arkets struktur er uformell (frie tekstfelt, varierende
kolonnebruk per prosjekt).

## 10. Rammer

- Beholde eksisterende stack og ikke innføre nye systemer (DB, hosting)
  uten grunn.
- Ikke bryte offentlig nettsted eller eksisterende admin-login under
  overgangen.
- NOK som valuta, norsk datoformat, Europe/Oslo tidssone.
- Produksjonsklar kode — ikke en visuell prototype.
