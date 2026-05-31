# KajDogaja

Na podlagi te zasnove je bil nato narejen Express.js streznik v datoteki `server.js`. Streznik implementira glavne entitete iz podatkovnega modela:

- uporabniki,
- dogodki,
- kategorije,
- mesta,
- prijave na dogodke,
- obvestila.

Implementirani so bili REST endpointi za metode `GET`, `POST`, `PUT` in `DELETE`. S tem API podpira pregled dogodkov, filtriranje dogodkov, ustvarjanje dogodka, urejanje dogodka, brisanje dogodka, prijavo uporabnika na dogodek, odjavo z dogodka, pregled obvestil, urejanje obvestil in statistiko prijav.

Dodana je bila tudi lokalna podatkovna shramba `data/db.json`, ki se ustvari samodejno ob prvem zagonu. Zacetni demo podatki so definirani v funkciji `seedDb()` v `server.js`.

Prav tako je bil narejen Node.js testni odjemalec v datoteki `client.js`, ki se poveze na REST API in demonstrira vse glavne HTTP metode.

Endpoint `/api/oauth/token` izda OAuth zeton. Podpira:

- `grant_type=password` za pridobitev prvega access tokena,
- `grant_type=refresh_token` za obnovitev zetona.

Odgovor vsebuje:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "..."
}
```

Access token se nato uporablja pri zascitenih API klicih v HTTP glavi:

```http
Authorization: Bearer <access_token>
```

Endpoint `/api/oauth/introspect` preveri, ali je token se aktiven. Endpoint `/api/oauth/revoke` token preklice.

## Vloge in OAuth scope
Organizator dobi sirsi scope:

```text
read write events registrations notifications
```

Navaden uporabnik dobi omejen scope:

```text
read registrations notifications
```

## Glavni REST endpointi

Avtentikacija in OAuth:

```text
POST /api/oauth/token
POST /api/oauth/introspect
POST /api/oauth/revoke
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

Dogodki:

```text
GET    /api/events
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
GET    /api/events/:id/qr
```

Prijave:

```text
GET    /api/events/:id/registrations
POST   /api/events/:id/registrations
DELETE /api/events/:id/registrations
GET    /api/me/registrations
```

Profil in obvestila:

```text
GET    /api/me
GET    /api/notifications
PUT    /api/notifications/:id/read
DELETE /api/notifications/:id
```

Statistika in sifranti:

```text
GET /api/events/:id/stats
GET /api/categories
GET /api/cities
```

## QR koda

Ob ustvarjanju dogodka streznik samodejno generira QR kodo s knjiznico `qrcode`.

QR koda vsebuje povezavo do API podrobnosti dogodka:

```text
http://localhost:3000/api/events/:id
```

QR koda je shranjena kot `data:image/png;base64,...` niz v polju `qr_koda_url`. Pridobiti jo je mogoce prek:

```text
GET /api/events/:id/qr
```

## Node.js testni odjemalec

Datoteka `client.js` je testni Node.js odjemalec, ki uporablja knjiznico `axios`.

Odjemalec:

- pridobi OAuth token za organizatorja,
- pridobi OAuth token za uporabnika,
- token shrani v `.oauth-tokens.json`,
- preveri token prek `/api/oauth/introspect`,
- po potrebi obnovi token z `refresh_token`,
- uporablja `Authorization: Bearer <access_token>`,
- izvede REST klice z metodami `GET`, `POST`, `PUT` in `DELETE`,
- na koncu token preklice prek `/api/oauth/revoke`.

## Demo uporabniki

Ob prvem zagonu se ustvarita demo racuna:

```text
organizator@kajdogaja.si / organizator123
uporabnik@kajdogaja.si / uporabnik123
```

Organizator se uporablja za ustvarjanje, urejanje in brisanje dogodkov. Uporabnik se uporablja za prijavo na dogodek, pregled svojih prijav in delo z obvestili.

Privzeto deluje na:

```text
http://localhost:3000
```

Osnovni opis API-ja je dostopen na:

```text
http://localhost:3000/api
```

## Namestitev in zagon

Odvisnosti namestite z:

```powershell
npm install
```

Streznik zazenete z:

```powershell
npm start
```

Node.js testnega odjemalca zazenete v drugem terminalu:

```powershell
npm run client
```

Sintakso streznika in odjemalca preverite z:

```powershell
npm run check
```

## PWA nadgradnja

Dodana je bila progresivna spletna aplikacija (PWA), napisana samo z HTML, CSS in vanilla JavaScript. Aplikacija je dostopna na:

```text
http://localhost:3000/pwa
```

PWA uporablja isti REST API kot Node.js odjemalec. Ob zagonu se prijavi kot demo organizator, pridobi OAuth access token in nato s tem tokenom kliče zaščitene endpoint-e za dodajanje, urejanje in brisanje dogodkov.

PWA vsebuje:

- prikaz seznama dogodkov iz REST API-ja,
- iskanje dogodkov prek query parametrov REST API-ja,
- dodajanje novega dogodka,
- urejanje obstoječega dogodka,
- brisanje dogodka,
- sistemska obvestila ob uspešnem shranjevanju, napakah in novih podatkih,
- bližnjice s tipkovnico `Ctrl+K`, `Alt+N` in `Ctrl+S`,
- `manifest.webmanifest` z imenom aplikacije, barvami, ikonami in bližnjicami,
- `serviceWorker` za predpomnjenje statičnih datotek aplikacije,
- lokalno shrambo v `localStorage`,
- shranjevanje čakajočih sprememb ob izgubi povezave,
- sinhronizacijo čakajočih sprememb ob ponovni vzpostavitvi povezave,
- leno nalaganje QR slik z `IntersectionObserver`,
- CORS podporo na strežniku,
- endpoint-e za push obvestila.

PWA datoteke:

```text
public/index.html
public/styles.css
public/app.js
public/sw.js
public/manifest.webmanifest
public/icons/icon-192.svg
public/icons/icon-512.svg
```

Push endpointi:

```text
POST /api/push/subscribe
POST /api/push/send
GET  /api/push/messages
```

Service worker vsebuje tudi `push` event listener. Ker projekt ne uporablja zunanjega Web Push ponudnika, aplikacija push sporočila pripravi prek REST endpointov, jih prevzame ob sinhronizaciji in jih preko service workerja prikaže kot sistemska obvestila.

### Rocno testiranje PWA tokov

Za PWA je pripravljen rocni testni dokument:

```text
texts/testni-scenarij-clan4.txt
```

Dokument pokriva:

- PWA installability in registracijo service workerja,
- offline reload aplikacijske lupine,
- localStorage queue in sinhronizacijo po reconnectu,
- organizatorski create/edit/delete tok,
- pregled prijav, statistiko, QR in CSV izvoz,
- push subscribe/send/messages tok,
- responsive in accessibility smoke test,
- preverjanje glasovnih ukazov po integraciji,
- preverjanje, da uporabniski tok ostane delujoc.

## Upravljanje z mikrofonom

Za to nalogo ni bila dodana zunanja npm knjiznica, ampak so bili uporabljeni vgrajeni brskalniški API-ji:

- `Web Speech API` za prepoznavo govora (`SpeechRecognition` oziroma `webkitSpeechRecognition`),
- `speechSynthesis` za glasovni odgovor aplikacije,

Glavna implementacija glasovnega dela je v datoteki:

```text
public/app.js
```

Uporabniski vmesnik za mikrofon in panel glasovnih ukazov je v:

```text
public/index.html
public/styles.css
```

### Glasovni ukazi

Uporabnik klikne ikono mikrofona v desnem zgornjem kotu, izgovori ukaz, aplikacija ukaz obdela in nato vrne tudi govorni odgovor.

Trenutno implementirani ukazi so:

- `isci [beseda]`
- `pocisti iskanje`
- `pocisti kategorije`
- `nov dogodek`
- `pocisti obrazec`
- `nastavi naziv [besedilo]`
- `shrani dogodek`
- `filtriraj kategorijo [ime kategorije]`
- `filtriraj mesto [ime mesta]`
- `preberi prvi dogodek`
- `preberi dogodek [naziv dogodka]`
- `preberi dogodke danes`
- `preberi dogodke jutri`
- `sinhroniziraj`

Primeri uporabe:

```text
isci koncert
pocisti iskanje
pocisti kategorije
nov dogodek
nastavi naziv Poletni koncert v parku
filtriraj mesto Maribor
filtriraj kategorijo glasba
preberi prvi dogodek
preberi dogodek Vecerni koncert v parku
sinhroniziraj
```

### Kako deluje v kodi

V `public/app.js` so bile dodane naslednje glavne funkcije:

- `setupVoiceRecognition()` inicializira `SpeechRecognition`, nastavi jezik `sl-SI` in registrira event listenerje,
- `toggleVoiceRecognition()` ob kliku na mikrofon zazene ali ustavi poslusanje,
- `runVoiceCommand(transcript)` razbere prepoznano besedilo in ga preslika v ustrezno funkcionalnost aplikacije,
- `speak(message)` uporabi `speechSynthesis`, da aplikacija uporabniku odgovori z glasom,
- `setVoiceStatus(...)` in `setVoiceTranscript(...)` posodabljata stanje vmesnika,
- `describeEvent(event)` pripravi glasovni opis dogodka,
- `formatDisplayDate(dateValue)` pretvori ISO datum v slovenski prikaz oblike `15. 5. 2026`.

Ukazi niso vezani na locen backend, ampak neposredno uporabljajo obstojece funkcije PWA:

- iskanje sprozi `loadEvents()`,
- filtriranje spremeni `categoryFilter` ali `cityFilter`,
- `shrani dogodek` odda obrazec `eventForm`,
- `nastavi naziv` izpolni polje `eventName`,
- `preberi dogodek` poisce dogodek v trenutno nalozenem seznamu in ga prebere z glasom,
- `sinhroniziraj` sprozi obstoječo offline sinhronizacijo.

### Glasovni odgovor aplikacije

- vizualno potrditev v panelu `Glasovni ukazi`,
- govorni odgovor prek `speechSynthesis`.

Primeri odgovorov:

- `Iscem koncert.`
- `Filter kategorije je pociscen.`
- `Naziv je nastavljen na Poletni koncert v parku.`
- `Berem dogodek: Vecerni koncert v parku.`

### Opomba glede podpore brskalnika

Glasovno upravljanje temelji na `Web Speech API`, zato najbolje deluje v Chromium brskalnikih, kot je Google Chrome. Ce brskalnik ne podpira `SpeechRecognition` ali `speechSynthesis`, se mikrofon vmesnik onemogoci in aplikacija uporabniku to prikaze v statusu.
