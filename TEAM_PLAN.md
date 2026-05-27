# KajDogaja - ekipni backlog in razdelitev dela

Ta dokument razdeli preostalo delo za skupni zakljucni projekt `KajDogaja`.
Osnova za nadaljevanje je trenutna implementacija v tem repozitoriju:

- Express REST API
- OAuth 2.0
- PWA
- offline podpora
- push demo
- glasovno upravljanje

## 1. Trenutno ze implementirano

To ze obstaja in se uporabi kot osnova:

- REST CRUD za dogodke
- registracija / prijava / logout
- OAuth token flow
- kategorije in mesta
- prijave na dogodke
- obvestila
- statistika dogodkov
- QR generiranje
- PWA z offline cache in localStorage queue
- manifest, service worker, sistemska obvestila
- glasovni ukazi prek mikrofona

## 2. Ključne vrzeli do celovitega projekta

To je treba se doreci ali izboljsati, da bo projekt skladen z zacetno skupinsko zasnovo:

1. pravi login/register UI
2. locen tok za uporabnika in organizatorja
3. pregled "moje prijave"
4. pregled obvestil v UI
5. geolokacija in "dogodki v blizini"
6. prikaz dogodkov na mapi
7. QR skeniranje s kamero
8. organizatorski pogled za prijavljene uporabnike
9. organizatorski pogled za statistiko
10. po moznosti migracija iz `db.json` na pravo bazo

## 3. Priporocena delitev med 4 clane

### Clan 1 - Backend, baza, API stabilizacija

**Odgovornost:** strežnik, podatkovni model, dolgoročna stabilnost API-ja

**Glavni cilj:** urediti podatkovno plast in utrditi backend kot osnovo za vse ostale.

**Datoteke / moduli:**

- `server.js`
- nova mapa: `db/`
- nova mapa: `models/`
- nova mapa: `services/`

**Naloge:**

- [ ] analiziraj vse trenutne entitete:
  - `users`
  - `events`
  - `categories`
  - `cities`
  - `registrations`
  - `notifications`
  - `oauthRefreshTokens`
  - `pushSubscriptions`
  - `pushMessages`
- [ ] pripravi predlog prave baze:
  - MongoDB + Mongoose ali
  - PostgreSQL + Prisma
- [ ] naredi migracijo iz `data/db.json` na izbrano bazo
- [ ] pripravi seed podatke za demo okolje
- [ ] posodobi vse obstojece endpoint-e, da uporabljajo novo plast za branje/pisanje
- [ ] ohrani enak API response shape, da frontend ostane cim bolj zdruzljiv
- [ ] pripravi centralni error handling za delo z bazo
- [ ] doda osnovno validacijo in integrity checks na nivoju modelov
- [ ] preveri in utrdi:
  - QR generiranje
  - statistiko
  - push endpointe
  - CORS

**Definition of done:**

- vsi obstoječi endpointi še vedno delujejo
- projekt se lahko zažene z inicialnim seed-om
- `db.json` ni več primarni vir resnice, če se ekipa odloči za pravo bazo
- API ni funkcionalno zlomljen za druge člane

---

### Clan 2 - Avtentikacija, profil, moje prijave, obvestila

**Odgovornost:** uporabniški flow za navadnega uporabnika

**Glavni cilj:** iz demo samodejne prijave narediti pravi uporabniški vhod v sistem.

**Datoteke / moduli:**

- `public/index.html`
- `public/app.js`
- `public/styles.css`

**Naloge:**

- [ ] pripravi login zaslon
- [ ] pripravi register zaslon
- [ ] dodaj preklop med vlogama `uporabnik` in `organizator` pri registraciji
- [ ] uredi shranjevanje in odjavo uporabnika v PWA
- [ ] odstrani trdo vezan demo organizer login za glavni flow aplikacije
- [ ] pripravi pogled `Moj profil`
- [ ] pripravi pogled `Moje prijave`
- [ ] pripravi pogled `Obvestila`
- [ ] dodaj oznacevanje obvestil kot prebranih
- [ ] dodaj brisanje obvestil
- [ ] povezi vse z obstoječimi endpointi:
  - `/api/auth/register`
  - `/api/auth/login`
  - `/api/oauth/token`
  - `/api/me`
  - `/api/me/registrations`
  - `/api/notifications`

**Definition of done:**

- uporabnik se lahko registrira in prijavi brez posega v kodo
- po prijavi vidi svoj profil
- uporabnik vidi svoje prijave
- uporabnik vidi in upravlja svoja obvestila
- vmesnik upošteva trenutno prijavljeno vlogo

---

### Clan 3 - Discovery, zemljevid, geolokacija, QR kamera

**Odgovornost:** glavna uporabniška izkušnja pri iskanju in odkrivanju dogodkov

**Glavni cilj:** narediti bogat discovery modul za uporabnika.

**Datoteke / moduli:**

- `public/index.html`
- `public/app.js`
- `public/styles.css`

**Naloge:**

- [ ] izboljsaj seznam dogodkov
- [ ] naredi poseben pogled ali modal za podrobnosti dogodka
- [ ] izboljsaj filtre:
  - mesto
  - datum / datum od-do
  - kategorija
  - text search
- [ ] dodaj uporabo geolokacije:
  - gumb `Dogodki v blizini`
  - pridobitev `navigator.geolocation`
  - klic `/api/events?lat=...&lng=...&radius=...`
- [ ] pripravi map view za dogodke
- [ ] prikazi markerje na mapi glede na koordinate dogodkov
- [ ] omogoci preklop `seznam / mapa`
- [ ] pripravi QR skeniranje s kamero
- [ ] ob uspešnem skenu odpri podrobnosti dogodka

**Priporocena knjiznica:**

- Leaflet za mapo
- `html5-qrcode` ali podobna browser knjiznica za skeniranje QR

**Definition of done:**

- uporabnik lahko pregleduje dogodke po filtrih
- uporabnik lahko vidi dogodke v svoji bližini
- uporabnik lahko vidi dogodke na mapi
- uporabnik lahko skenira QR kodo
- podrobnosti dogodka so jasno dostopne iz seznama ali QR kode

---

### Clan 4 - Organizatorski modul, PWA platforma, offline, push, finalna integracija

**Odgovornost:** organizatorski UI + napredne PWA funkcionalnosti + končna integracija

**Glavni cilj:** zaključiti aplikacijo tako, da deluje kot celovit produkt za predstavitev.

**Datoteke / moduli:**

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `public/manifest.webmanifest`

**Naloge - organizatorski del:**

- [ ] izboljsaj create/edit/delete flow za dogodke
- [ ] pripravi organizatorski pregled lastnih dogodkov
- [ ] pripravi pogled za seznam prijavljenih uporabnikov po dogodku
- [ ] pripravi pogled za statistiko po dogodku
- [ ] pripravi lep prikaz QR kode dogodka
- [ ] dodaj moznost filtriranja dogodkov organizatorja
- [ ] po moznosti dodaj export prijav (CSV ali JSON download)

**Naloge - PWA/platformni del:**

- [ ] utrdi offline delovanje:
  - reload offline
  - queue sync
  - recovery po reconnect
- [ ] preveri in dopolni service worker cache strategijo
- [ ] utrdi push tok:
  - subscribe
  - prevzem sporocil
  - prikaz sistemskih obvestil
- [ ] preveri manifest in installability
- [ ] preveri responsive delovanje
- [ ] preveri accessibility in splosni polish
- [ ] preveri, da glasovno upravljanje ostane delujoce po vseh integracijah
- [ ] pripravi zakljucni testni scenarij za zagovor

**API, ki ga uporablja:**

- `/api/events`
- `/api/events/:id`
- `/api/events/:id/registrations`
- `/api/events/:id/stats`
- `/api/events/:id/qr`
- `/api/categories`
- `/api/cities`
- `/api/push/subscribe`
- `/api/push/send`
- `/api/push/messages`

**Definition of done:**

- organizator lahko upravlja svoje dogodke
- organizator vidi prijavljene uporabnike in statistiko
- PWA ostane stabilna offline
- push in sistemska obvestila delujejo
- aplikacija je pripravljena za koncni demo

---

## 4. Skupne funkcionalnosti, ki jih mora ekipa kot celota pokriti

To so “checklist” točke za končno verzijo:

- [ ] registracija
- [ ] prijava
- [ ] odjava
- [ ] prikaz vseh dogodkov
- [ ] filtriranje po mestu
- [ ] filtriranje po datumu
- [ ] filtriranje po kategoriji
- [ ] iskanje po nazivu/opisu
- [ ] podrobnosti dogodka
- [ ] prijava na dogodek
- [ ] odjava z dogodka
- [ ] moje prijave
- [ ] obvestila
- [ ] dogodki v blizini
- [ ] offline dostop
- [ ] QR generiranje
- [ ] QR skeniranje
- [ ] prikaz dogodkov na mapi
- [ ] dodajanje dogodka
- [ ] urejanje dogodka
- [ ] brisanje dogodka
- [ ] pregled prijavljenih uporabnikov
- [ ] statistika prijav
- [ ] push obvestila
- [ ] PWA manifest in installability
- [ ] service worker cache
- [ ] glasovno upravljanje naj ostane delujoce tudi po integraciji

## 5. Faze dela

Najbolj varno je projekt razvijati v fazah.

### Faza 1 - stabilizacija osnove

- [ ] Clan 1 postavi bazo / data layer
- [ ] Clan 2 pripravi login/register flow
- [ ] Clan 3 dela discovery UI nad obstoječimi endpointi
- [ ] Clan 4 pripravi organizatorski UI skeleton in PWA testne scenarije

### Faza 2 - jedrni uporabniski in organizatorski tokovi

- [ ] Clan 2 dokonca profil, moje prijave in obvestila
- [ ] Clan 3 dokonca filtre, detail view in geolocation
- [ ] Clan 4 dokonca create/edit/delete organizer flow + registrations/stats

### Faza 3 - napredne funkcionalnosti

- [ ] Clan 3 dokonca mapo in QR skeniranje
- [ ] Clan 4 dokonca push, offline hardening in finalni polish
- [ ] Clan 1 pomaga pri backend podpori, ce kdo naleti na vrzel v API-ju

### Faza 4 - integracija

- [ ] uskladitev UI
- [ ] bug fixing
- [ ] testiranje vseh tokov
- [ ] priprava za zagovor

## 6. Git priporocilo

Da se izognete konfliktom:

- vsak clan dela v svoji veji:
  - `feature/backend-db`
  - `feature/auth-profile`
  - `feature/discovery-map-qr`
  - `feature/organizer-pwa-integration`
- `main` naj bo stabilna integracijska veja
- pred merganjem naj vsak clan:
  - potegne zadnji `main`
  - resi konflikte
  - preveri, da nic ni zlomljeno

## 7. Kaj NE spada v obvezni scope, razen ce ostane cas

To so ideje iz obrazca, ki jih je bolje obravnavati kot bonus:

- [ ] nakup vstopnic
- [ ] ocenjevanje dogodkov
- [ ] integracija s socialnimi omrezji
- [ ] priporocila dogodkov

Te funkcionalnosti so dobre, vendar niso nujne za prvo celovito skupinsko verzijo,
ce je osnovni cilj zakljuciti vse, kar je bilo opisano v `pages/` in `texts/`.

## 8. Predlagan minimalni "koncni demo"

Za zagovor naj bo mogoce pokazati ta tok:

1. registracija / prijava uporabnika
2. pregled dogodkov
3. filtriranje + iskanje
4. prikaz dogodkov na mapi
5. prikaz dogodkov v blizini
6. prijava na dogodek
7. moje prijave
8. QR skeniranje in odprtje dogodka
9. prijava organizatorja
10. dodajanje / urejanje / brisanje dogodka
11. pregled prijavljenih uporabnikov
12. statistika dogodka
13. push / sistemsko obvestilo
14. offline reload in kasnejsa sinhronizacija