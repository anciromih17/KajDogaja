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