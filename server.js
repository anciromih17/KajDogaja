const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kajdogaja-development-secret';
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(204).send();
    }
    return next();
});

function now() {
    return new Date().toISOString();
}

function id(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedDb() {
    const organizerPassword = bcrypt.hashSync('organizator123', 10);
    const userPassword = bcrypt.hashSync('uporabnik123', 10);
    const created = now();

    return {
        users: [
            {
                id: 'usr_organizator',
                uporabnisko_ime: 'Demo Organizator',
                email: 'organizator@kajdogaja.si',
                geslo_hash: organizerPassword,
                vloga: 'organizator',
                ustvarjen: created
            },
            {
                id: 'usr_uporabnik',
                uporabnisko_ime: 'Demo Uporabnik',
                email: 'uporabnik@kajdogaja.si',
                geslo_hash: userPassword,
                vloga: 'uporabnik',
                ustvarjen: created
            }
        ],
        categories: [
            { id: 'cat_sport', naziv: 'sport' },
            { id: 'cat_kultura', naziv: 'kultura' },
            { id: 'cat_glasba', naziv: 'glasba' },
            { id: 'cat_festival', naziv: 'festival' }
        ],
        cities: [
            { id: 'city_ljubljana', naziv: 'Ljubljana', koordinate_lat: 46.0569, koordinate_lng: 14.5058 },
            { id: 'city_maribor', naziv: 'Maribor', koordinate_lat: 46.5547, koordinate_lng: 15.6459 },
            { id: 'city_celje', naziv: 'Celje', koordinate_lat: 46.2397, koordinate_lng: 15.2677 }
        ],
        events: [
            {
                id: 'evt_koncert_maribor',
                naziv: 'Vecerni koncert v parku',
                opis: 'Odprt glasbeni dogodek z lokalnimi izvajalci.',
                datum: '2026-05-15',
                ura: '20:00',
                lokacija: 'Mestni park Maribor',
                koordinate_lat: 46.5622,
                koordinate_lng: 15.6431,
                kapaciteta: 120,
                qr_koda_url: '',
                kategorija_id: 'cat_glasba',
                mesto_id: 'city_maribor',
                organizator_id: 'usr_organizator',
                ustvarjen: created,
                posodobljen: created
            },
            {
                id: 'evt_tek_ljubljana',
                naziv: 'Dobrodelni tek',
                opis: 'Sportni dogodek za vse generacije.',
                datum: '2026-05-22',
                ura: '10:00',
                lokacija: 'Tivoli Ljubljana',
                koordinate_lat: 46.0593,
                koordinate_lng: 14.4976,
                kapaciteta: 300,
                qr_koda_url: '',
                kategorija_id: 'cat_sport',
                mesto_id: 'city_ljubljana',
                organizator_id: 'usr_organizator',
                ustvarjen: created,
                posodobljen: created
            }
        ],
        registrations: [
            {
                id: 'reg_demo',
                uporabnik_id: 'usr_uporabnik',
                dogodek_id: 'evt_koncert_maribor',
                status: 'potrjena',
                ustvarjena: created
            }
        ],
        notifications: [
            {
                id: 'not_demo',
                uporabnik_id: 'usr_uporabnik',
                dogodek_id: 'evt_koncert_maribor',
                tip: 'opomnik',
                vsebina: 'Ne pozabite na koncert v parku.',
                prebrano: false,
                ustvarjeno: created
            }
        ],
        oauthClients: [
            {
                id: 'kajdogaja-test-client',
                secret: 'kajdogaja-test-secret',
                name: 'KajDogaja testni Node.js odjemalec',
                redirect_uris: ['http://localhost/callback'],
                scopes: ['read', 'write', 'events', 'registrations', 'notifications']
            }
        ],
        oauthRefreshTokens: [],
        pushSubscriptions: [],
        pushMessages: [],
        revokedTokens: []
    };
}

function loadDb() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
    }

    if (!fs.existsSync(DB_PATH)) {
        const initial = seedDb();
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }

    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let db = loadDb();
normalizeDb();

function normalizeDb() {
    let changed = false;

    if (!Array.isArray(db.oauthClients)) {
        db.oauthClients = [
            {
                id: 'kajdogaja-test-client',
                secret: 'kajdogaja-test-secret',
                name: 'KajDogaja testni Node.js odjemalec',
                redirect_uris: ['http://localhost/callback'],
                scopes: ['read', 'write', 'events', 'registrations', 'notifications']
            }
        ];
        changed = true;
    }

    if (!Array.isArray(db.oauthRefreshTokens)) {
        db.oauthRefreshTokens = [];
        changed = true;
    }

    if (!Array.isArray(db.revokedTokens)) {
        db.revokedTokens = [];
        changed = true;
    }

    if (!Array.isArray(db.pushSubscriptions)) {
        db.pushSubscriptions = [];
        changed = true;
    }

    if (!Array.isArray(db.pushMessages)) {
        db.pushMessages = [];
        changed = true;
    }

    if (changed) {
        saveDb();
    }
}

async function ensureQrCodes() {
    let changed = false;
    for (const event of db.events) {
        if (!event.qr_koda_url) {
            event.qr_koda_url = await QRCode.toDataURL(`http://localhost:${PORT}/api/events/${event.id}`);
            changed = true;
        }
    }
    if (changed) {
        saveDb();
    }
}

function saveDb() {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendError(res, status, message) {
    return res.status(status).json({ napaka: message, koda: status });
}

function publicUser(user) {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        uporabnisko_ime: user.uporabnisko_ime,
        email: user.email,
        vloga: user.vloga,
        ustvarjen: user.ustvarjen
    };
}

function findEvent(eventId) {
    return db.events.find((event) => event.id === eventId);
}

function eventRegistrations(eventId) {
    return db.registrations.filter((registration) => {
        return registration.dogodek_id === eventId && registration.status === 'potrjena';
    });
}

function enrichEvent(event) {
    if (!event) {
        return null;
    }

    return {
        ...event,
        kategorija: db.categories.find((category) => category.id === event.kategorija_id) || null,
        mesto: db.cities.find((city) => city.id === event.mesto_id) || null,
        organizator: publicUser(db.users.find((user) => user.id === event.organizator_id)),
        st_prijav: eventRegistrations(event.id).length
    };
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function findOAuthClient(clientId, clientSecret) {
    return db.oauthClients.find((client) => {
        return client.id === clientId && client.secret === clientSecret;
    });
}

function normalizeScope(scope, client) {
    const requested = String(scope || client.scopes.join(' '))
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const allowed = requested.filter((item) => client.scopes.includes(item));
    return allowed.length ? allowed.join(' ') : client.scopes.join(' ');
}

function scopesForUser(user) {
    if (user.vloga === 'organizator') {
        return ['read', 'write', 'events', 'registrations', 'notifications'];
    }

    return ['read', 'registrations', 'notifications'];
}

function normalizeUserScope(scope, client, user) {
    const clientScope = normalizeScope(scope, client).split(/\s+/);
    const userScopes = scopesForUser(user);
    const allowed = clientScope.filter((item) => userScopes.includes(item));
    return allowed.length ? allowed.join(' ') : userScopes.join(' ');
}

function createAccessToken(user, client, scope) {
    return jwt.sign(
        {
            token_use: 'access_token',
            sub: user.id,
            id: user.id,
            vloga: user.vloga,
            uporabnisko_ime: user.uporabnisko_ime,
            client_id: client.id,
            scope
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
}

function createRefreshToken(user, client, scope) {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000).toISOString();

    db.oauthRefreshTokens.push({
        id: id('rt'),
        token_hash: tokenHash(refreshToken),
        user_id: user.id,
        client_id: client.id,
        scope,
        expires_at: expiresAt,
        revoked: false,
        ustvarjen: now()
    });

    return refreshToken;
}

function issueOAuthTokens(user, client, scope) {
    const accessToken = createAccessToken(user, client, scope);
    const refreshToken = createRefreshToken(user, client, scope);
    saveDb();

    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_IN,
        refresh_token: refreshToken,
        scope
    };
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return sendError(res, 401, 'Manjka OAuth Bearer access_token.');
    }

    if (db.revokedTokens.includes(token)) {
        return sendError(res, 401, 'Access token ni vec veljaven.');
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.token_use !== 'access_token') {
            return sendError(res, 401, 'Zeton ni OAuth access_token.');
        }

        const user = db.users.find((candidate) => candidate.id === payload.id);
        if (!user) {
            return sendError(res, 401, 'Uporabnik ne obstaja.');
        }

        req.user = user;
        req.token = token;
        req.oauth = {
            client_id: payload.client_id,
            scope: payload.scope
        };
        return next();
    } catch (error) {
        return sendError(res, 401, 'Neveljaven OAuth access_token.');
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.vloga !== role) {
            return sendError(res, 403, `Dostop dovoljen samo za vlogo ${role}.`);
        }
        return next();
    };
}

function requireScope(...requiredScopes) {
    return (req, res, next) => {
        const tokenScopes = String(req.oauth?.scope || '').split(/\s+/).filter(Boolean);
        const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));

        if (!hasAllScopes) {
            return sendError(res, 403, `Manjka OAuth scope: ${requiredScopes.join(' ')}.`);
        }

        return next();
    };
}

function requireEventOwner(req, res, next) {
    const event = findEvent(req.params.id);
    if (!event) {
        return sendError(res, 404, 'Dogodek ne obstaja.');
    }
    if (event.organizator_id !== req.user.id) {
        return sendError(res, 403, 'Dogodek lahko ureja samo njegov organizator.');
    }
    req.event = event;
    return next();
}

function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function isValidTime(value) {
    return /^\d{2}:\d{2}$/.test(value || '');
}

function validateEventPayload(payload, partial = false) {
    const required = ['naziv', 'opis', 'datum', 'ura', 'lokacija', 'kategorija_id', 'mesto_id'];
    if (!partial) {
        for (const field of required) {
            if (!payload[field]) {
                return `Manjka polje ${field}.`;
            }
        }
    }

    if (payload.datum !== undefined && !isValidDate(payload.datum)) {
        return 'Datum mora biti v obliki YYYY-MM-DD.';
    }

    if (payload.datum_do !== undefined && payload.datum_do !== '' && !isValidDate(payload.datum_do)) {
        return 'Datum do mora biti v obliki YYYY-MM-DD.';
    }

    if (payload.datum && payload.datum_do && payload.datum_do < payload.datum) {
        return 'Datum do ne sme biti pred datumom zacetka.';
    }

    if (payload.ura !== undefined && !isValidTime(payload.ura)) {
        return 'Ura mora biti v obliki HH:MM.';
    }

    if (payload.kapaciteta !== undefined && payload.kapaciteta !== null && Number(payload.kapaciteta) < 1) {
        return 'Kapaciteta mora biti pozitivno stevilo ali null.';
    }

    if (payload.kategorija_id && !db.categories.some((category) => category.id === payload.kategorija_id)) {
        return 'Kategorija ne obstaja.';
    }

    if (payload.mesto_id && !db.cities.some((city) => city.id === payload.mesto_id)) {
        return 'Mesto ne obstaja.';
    }

    return null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
    const radius = 6371;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function registrationsByDay(eventId) {
    const result = new Map();
    for (const registration of eventRegistrations(eventId)) {
        const day = registration.ustvarjena.slice(0, 10);
        result.set(day, (result.get(day) || 0) + 1);
    }
    return Array.from(result.entries()).map(([datum, stevilo]) => ({ datum, stevilo }));
}

function createNotification(userId, eventId, tip, vsebina) {
    db.notifications.push({
        id: id('not'),
        uporabnik_id: userId,
        dogodek_id: eventId,
        tip,
        vsebina,
        prebrano: false,
        ustvarjeno: now()
    });
}

function queuePushMessage(title, body, data = {}) {
    const message = {
        id: id('push'),
        title,
        body,
        data,
        ustvarjeno: now(),
        delivered: false
    };
    db.pushMessages.push(message);
    return message;
}

app.get('/', (req, res) => {
    res.type('html').send(`
<!DOCTYPE html>
<html lang="sl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KajDogaja - REST API</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fbff; color: #1f2937; }
        main { max-width: 980px; margin: 0 auto; padding: 40px 20px; }
        h1 { color: #1f3c88; margin-bottom: 8px; }
        p { color: #4b5563; line-height: 1.6; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 24px; }
        a { display: block; padding: 16px; border: 1px solid #dbe5ff; border-radius: 8px; background: #fff; color: #1f3c88; text-decoration: none; font-weight: 650; }
        code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
    </style>
</head>
<body>
    <main>
        <h1>KajDogaja</h1>
        <div class="grid">
            <a href="/pwa">KajDogaja PWA</a>
            <a href="/api">/api</a>
            <a href="/funkcionalnosti-odjemalca/">Funkcionalnosti odjemalca</a>
            <a href="/funkcionalnosti-streznika/">Funkcionalnosti streznika</a>
            <a href="/podatkovni-model/">Podatkovni model</a>
            <a href="/posebnosti/">Posebnosti</a>
            <a href="/tehnicne-zahteve-streznika/">Tehnicne zahteve streznika</a>
            <a href="/REST/">REST zasnova</a>
        </div>
    </main>
</body>
</html>`);
});

app.use('/pwa', express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons')));

app.get('/pwa/?', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/manifest.webmanifest', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest'));
});

app.get('/funkcionalnosti-odjemalca/?', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'funkcionalnosti-odjemalca.html'));
});

app.get('/funkcionalnosti-streznika/?', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'funkcionalnosti-streznika.html'));
});

app.get('/podatkovni-model/?', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'podatkovni-model.html'));
});

app.get('/posebnosti/?', (req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'posebnosti.txt'));
});

app.get('/tehnicne-zahteve-streznika/?', (req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'tehnicne-zahteve-streznika.txt'));
});

app.get('/REST/?', (req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'rest.txt'));
});

app.use('/img', express.static(path.join(__dirname, 'img')));

app.get('/api', (req, res) => {
    res.json({
        ime: 'KajDogaja REST API',
        verzija: '1.0.0',
        endpointi: [
            'POST /api/oauth/token',
            'POST /api/oauth/revoke',
            'POST /api/oauth/introspect',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'GET /api/events',
            'GET /api/events/:id',
            'POST /api/events',
            'PUT /api/events/:id',
            'DELETE /api/events/:id',
            'GET /api/events/:id/qr',
            'GET /api/events/:id/registrations',
            'POST /api/events/:id/registrations',
            'DELETE /api/events/:id/registrations',
            'GET /api/me',
            'GET /api/me/registrations',
            'GET /api/notifications',
            'PUT /api/notifications/:id/read',
            'DELETE /api/notifications/:id',
            'POST /api/push/subscribe',
            'POST /api/push/send',
            'GET /api/push/messages',
            'GET /api/events/:id/stats',
            'GET /api/categories',
            'POST /api/categories',
            'GET /api/cities',
            'POST /api/cities'
        ]
    });
});

app.post('/api/auth/register', async (req, res) => {
    const { uporabnisko_ime, email, geslo, vloga = 'uporabnik' } = req.body;
    if (!uporabnisko_ime || !email || !geslo) {
        return sendError(res, 400, 'Manjkajo obvezna polja.');
    }

    if (!['uporabnik', 'organizator'].includes(vloga)) {
        return sendError(res, 400, 'Vloga mora biti uporabnik ali organizator.');
    }

    if (db.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
        return sendError(res, 409, 'Email ze obstaja.');
    }

    const user = {
        id: id('usr'),
        uporabnisko_ime,
        email,
        geslo_hash: await bcrypt.hash(geslo, 10),
        vloga,
        ustvarjen: now()
    };
    db.users.push(user);
    saveDb();
    return res.status(201).json(publicUser(user));
});

app.post('/api/auth/login', async (req, res) => {
    const { email, geslo } = req.body;
    const user = db.users.find((candidate) => candidate.email.toLowerCase() === String(email || '').toLowerCase());
    if (!user || !(await bcrypt.compare(String(geslo || ''), user.geslo_hash))) {
        return sendError(res, 401, 'Napacni prijavni podatki.');
    }

    const client = db.oauthClients[0];
    const scope = client.scopes.join(' ');
    const token = createAccessToken(user, client, scope);

    return res.json({
        token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_IN,
        uporabnik: {
            id: user.id,
            vloga: user.vloga,
            uporabnisko_ime: user.uporabnisko_ime
        }
    });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
    db.revokedTokens.push(req.token);
    saveDb();
    return res.json({ sporocilo: 'Odjava uspesna.' });
});

app.get('/api/categories', (req, res) => {
    res.json(db.categories);
});

app.post('/api/categories', authenticate, requireScope('write'), requireRole('organizator'), (req, res) => {
    const naziv = String(req.body.naziv || '').trim();
    if (!naziv) {
        return sendError(res, 400, 'Naziv kategorije je obvezen.');
    }

    const exists = db.categories.some((category) => category.naziv.toLowerCase() === naziv.toLowerCase());
    if (exists) {
        return sendError(res, 409, 'Kategorija ze obstaja.');
    }

    const category = { id: id('cat'), naziv };
    db.categories.push(category);
    saveDb();
    return res.status(201).json(category);
});

app.get('/api/cities', (req, res) => {
    res.json(db.cities);
});

app.post('/api/cities', authenticate, requireScope('write'), requireRole('organizator'), (req, res) => {
    const naziv = String(req.body.naziv || '').trim();
    const koordinate_lat = Number(req.body.koordinate_lat);
    const koordinate_lng = Number(req.body.koordinate_lng);

    if (!naziv || Number.isNaN(koordinate_lat) || Number.isNaN(koordinate_lng)) {
        return sendError(res, 400, 'Naziv in koordinate mesta so obvezni.');
    }

    const exists = db.cities.some((city) => city.naziv.toLowerCase() === naziv.toLowerCase());
    if (exists) {
        return sendError(res, 409, 'Mesto ze obstaja.');
    }

    const city = { id: id('city'), naziv, koordinate_lat, koordinate_lng };
    db.cities.push(city);
    saveDb();
    return res.status(201).json(city);
});

app.post('/api/oauth/token', async (req, res) => {
    const {
        grant_type,
        client_id,
        client_secret,
        username,
        email,
        password,
        geslo,
        refresh_token,
        scope
    } = req.body;

    const client = findOAuthClient(client_id, client_secret);
    if (!client) {
        return sendError(res, 401, 'OAuth odjemalec ni veljaven.');
    }

    if (grant_type === 'password') {
        const loginEmail = email || username;
        const loginPassword = geslo || password;
        const user = db.users.find((candidate) => {
            return candidate.email.toLowerCase() === String(loginEmail || '').toLowerCase();
        });

        if (!user || !(await bcrypt.compare(String(loginPassword || ''), user.geslo_hash))) {
            return sendError(res, 401, 'Napacni prijavni podatki.');
        }

        return res.json(issueOAuthTokens(user, client, normalizeUserScope(scope, client, user)));
    }

    if (grant_type === 'refresh_token') {
        const storedRefreshToken = db.oauthRefreshTokens.find((candidate) => {
            return candidate.token_hash === tokenHash(String(refresh_token || ''))
                && candidate.client_id === client.id;
        });

        if (!storedRefreshToken || storedRefreshToken.revoked) {
            return sendError(res, 401, 'Refresh token ni veljaven.');
        }

        if (new Date(storedRefreshToken.expires_at).getTime() < Date.now()) {
            storedRefreshToken.revoked = true;
            saveDb();
            return sendError(res, 401, 'Refresh token je potekel.');
        }

        const user = db.users.find((candidate) => candidate.id === storedRefreshToken.user_id);
        if (!user) {
            return sendError(res, 401, 'Uporabnik ne obstaja.');
        }

        storedRefreshToken.revoked = true;
        return res.json(issueOAuthTokens(user, client, normalizeUserScope(storedRefreshToken.scope, client, user)));
    }

    return sendError(res, 400, 'Nepodprt OAuth grant_type.');
});

app.post('/api/oauth/revoke', (req, res) => {
    const { client_id, client_secret, token, token_type_hint } = req.body;
    const client = findOAuthClient(client_id, client_secret);
    if (!client) {
        return sendError(res, 401, 'OAuth odjemalec ni veljaven.');
    }

    if (token_type_hint === 'refresh_token') {
        const storedRefreshToken = db.oauthRefreshTokens.find((candidate) => {
            return candidate.token_hash === tokenHash(String(token || '')) && candidate.client_id === client.id;
        });
        if (storedRefreshToken) {
            storedRefreshToken.revoked = true;
        }
    } else if (token && !db.revokedTokens.includes(token)) {
        db.revokedTokens.push(token);
    }

    saveDb();
    return res.status(200).json({ sporocilo: 'Token je preklican.' });
});

app.post('/api/oauth/introspect', (req, res) => {
    const { client_id, client_secret, token } = req.body;
    const client = findOAuthClient(client_id, client_secret);
    if (!client) {
        return sendError(res, 401, 'OAuth odjemalec ni veljaven.');
    }

    try {
        if (!token || db.revokedTokens.includes(token)) {
            return res.json({ active: false });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({
            active: true,
            sub: payload.sub,
            client_id: payload.client_id,
            scope: payload.scope,
            token_type: 'Bearer',
            exp: payload.exp,
            iat: payload.iat
        });
    } catch (error) {
        return res.json({ active: false });
    }
});

app.get('/api/events', (req, res) => {
    const { city, date, category, q, lat, lng, radius = 10, page = 1, limit = 50 } = req.query;
    let events = [...db.events];

    if (city) {
        const query = String(city).toLowerCase();
        events = events.filter((event) => {
            const cityRecord = db.cities.find((candidate) => candidate.id === event.mesto_id);
            return event.mesto_id === city || (cityRecord && cityRecord.naziv.toLowerCase() === query);
        });
    }

    if (date) {
        const parts = String(date).split(',');
        if (parts.length === 2) {
            events = events.filter((event) => {
                const start = event.datum;
                const end = event.datum_do || event.datum;
                return start <= parts[1] && end >= parts[0];
            });
        } else {
            events = events.filter((event) => {
                const start = event.datum;
                const end = event.datum_do || event.datum;
                return start <= date && end >= date;
            });
        }
    }

    if (category) {
        events = events.filter((event) => event.kategorija_id === category);
    }

    if (q) {
        const query = String(q).toLowerCase();
        events = events.filter((event) => {
            return event.naziv.toLowerCase().includes(query) || event.opis.toLowerCase().includes(query);
        });
    }

    if (lat && lng) {
        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        const parsedRadius = Number(radius);
        events = events.filter((event) => {
            return distanceKm(parsedLat, parsedLng, Number(event.koordinate_lat), Number(event.koordinate_lng)) <= parsedRadius;
        });
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const paged = events.slice(startIndex, startIndex + Number(limit));
    return res.json(paged.map(enrichEvent));
});

app.get('/api/events/:id/qr', (req, res) => {
    const event = findEvent(req.params.id);
    if (!event) {
        return sendError(res, 404, 'Dogodek ne obstaja.');
    }
    return res.json({ qr_koda_url: event.qr_koda_url });
});

app.get('/api/events/:id/registrations', authenticate, requireScope('read', 'registrations'), requireRole('organizator'), requireEventOwner, (req, res) => {
    const registrations = eventRegistrations(req.event.id).map((registration) => ({
        id: registration.id,
        uporabnik: publicUser(db.users.find((user) => user.id === registration.uporabnik_id)),
        status: registration.status,
        ustvarjena: registration.ustvarjena
    }));
    return res.json(registrations);
});

app.post('/api/events/:id/registrations', authenticate, requireScope('registrations'), requireRole('uporabnik'), (req, res) => {
    const event = findEvent(req.params.id);
    if (!event) {
        return sendError(res, 404, 'Dogodek ne obstaja.');
    }

    const existing = db.registrations.find((registration) => {
        return registration.dogodek_id === event.id
            && registration.uporabnik_id === req.user.id
            && registration.status === 'potrjena';
    });
    if (existing) {
        return sendError(res, 409, 'Uporabnik je ze prijavljen na dogodek.');
    }

    if (event.kapaciteta !== null && eventRegistrations(event.id).length >= Number(event.kapaciteta)) {
        return sendError(res, 410, 'Dogodek je poln.');
    }

    const registration = {
        id: id('reg'),
        uporabnik_id: req.user.id,
        dogodek_id: event.id,
        status: 'potrjena',
        ustvarjena: now()
    };
    db.registrations.push(registration);
    saveDb();

    return res.status(201).json({
        id: registration.id,
        status: registration.status,
        dogodek_id: registration.dogodek_id
    });
});

app.delete('/api/events/:id/registrations', authenticate, requireScope('registrations'), requireRole('uporabnik'), (req, res) => {
    const index = db.registrations.findIndex((registration) => {
        return registration.dogodek_id === req.params.id
            && registration.uporabnik_id === req.user.id
            && registration.status === 'potrjena';
    });

    if (index === -1) {
        return sendError(res, 404, 'Prijava ne obstaja.');
    }

    db.registrations.splice(index, 1);
    saveDb();
    return res.status(204).send();
});

app.get('/api/events/:id/stats', authenticate, requireScope('read', 'events'), requireRole('organizator'), requireEventOwner, (req, res) => {
    const total = eventRegistrations(req.event.id).length;
    const capacity = req.event.kapaciteta;
    return res.json({
        skupaj_prijav: total,
        kapaciteta: capacity,
        zasedenost_odstotek: capacity ? Math.round((total / capacity) * 100) : null,
        prostih_mest: capacity ? Math.max(Number(capacity) - total, 0) : null,
        prijave_po_dnevih: registrationsByDay(req.event.id)
    });
});

app.get('/api/events/:id', (req, res) => {
    const event = findEvent(req.params.id);
    if (!event) {
        return sendError(res, 404, 'Dogodek ne obstaja.');
    }
    return res.json(enrichEvent(event));
});

app.post('/api/events', authenticate, requireScope('write', 'events'), requireRole('organizator'), async (req, res) => {
    const validationError = validateEventPayload(req.body);
    if (validationError) {
        return sendError(res, 400, validationError);
    }

    const event = {
        id: id('evt'),
        naziv: req.body.naziv,
        opis: req.body.opis,
        datum: req.body.datum,
        datum_do: req.body.datum_do || req.body.datum,
        ura: req.body.ura,
        lokacija: req.body.lokacija,
        koordinate_lat: Number(req.body.koordinate_lat),
        koordinate_lng: Number(req.body.koordinate_lng),
        kapaciteta: req.body.kapaciteta === null ? null : Number(req.body.kapaciteta || 0),
        qr_koda_url: '',
        kategorija_id: req.body.kategorija_id,
        mesto_id: req.body.mesto_id,
        organizator_id: req.user.id,
        ustvarjen: now(),
        posodobljen: now()
    };

    event.qr_koda_url = await QRCode.toDataURL(`http://localhost:${PORT}/api/events/${event.id}`);
    db.events.push(event);
    queuePushMessage('Nov dogodek', `Dodana je prireditev "${event.naziv}".`, { eventId: event.id, url: `/api/events/${event.id}` });
    saveDb();
    return res.status(201).json(enrichEvent(event));
});

app.put('/api/events/:id', authenticate, requireScope('write', 'events'), requireRole('organizator'), requireEventOwner, async (req, res) => {
    const validationError = validateEventPayload(req.body, true);
    if (validationError) {
        return sendError(res, 400, validationError);
    }

    const editable = [
        'naziv',
        'opis',
        'datum',
        'datum_do',
        'ura',
        'lokacija',
        'koordinate_lat',
        'koordinate_lng',
        'kapaciteta',
        'kategorija_id',
        'mesto_id'
    ];

    for (const field of editable) {
        if (req.body[field] !== undefined) {
            req.event[field] = ['koordinate_lat', 'koordinate_lng', 'kapaciteta'].includes(field) && req.body[field] !== null
                ? Number(req.body[field])
                : req.body[field];
        }
    }

    req.event.posodobljen = now();
    const registrations = eventRegistrations(req.event.id);
    for (const registration of registrations) {
        createNotification(
            registration.uporabnik_id,
            req.event.id,
            'sprememba',
            `Dogodek "${req.event.naziv}" je bil posodobljen.`
        );
    }

    queuePushMessage('Dogodek posodobljen', `Dogodek "${req.event.naziv}" je bil posodobljen.`, { eventId: req.event.id, url: `/api/events/${req.event.id}` });
    saveDb();
    return res.json(enrichEvent(req.event));
});

app.delete('/api/events/:id', authenticate, requireScope('write', 'events'), requireRole('organizator'), requireEventOwner, (req, res) => {
    const registrationUserIds = eventRegistrations(req.event.id).map((registration) => registration.uporabnik_id);
    db.events = db.events.filter((event) => event.id !== req.event.id);
    db.registrations = db.registrations.filter((registration) => registration.dogodek_id !== req.event.id);

    for (const userId of registrationUserIds) {
        createNotification(userId, req.event.id, 'odpoved', `Dogodek "${req.event.naziv}" je bil odpovedan.`);
    }

    queuePushMessage('Dogodek izbrisan', `Dogodek "${req.event.naziv}" je bil izbrisan.`, { eventId: req.event.id });
    saveDb();
    return res.status(204).send();
});

app.get('/api/me', authenticate, requireScope('read'), (req, res) => {
    return res.json(publicUser(req.user));
});

app.get('/api/me/registrations', authenticate, requireScope('read', 'registrations'), (req, res) => {
    const registrations = db.registrations
        .filter((registration) => registration.uporabnik_id === req.user.id)
        .map((registration) => ({
            id: registration.id,
            status: registration.status,
            ustvarjena: registration.ustvarjena,
            dogodek: enrichEvent(findEvent(registration.dogodek_id))
        }));
    return res.json(registrations);
});

app.get('/api/notifications', authenticate, requireScope('read', 'notifications'), (req, res) => {
    let notifications = db.notifications.filter((notification) => notification.uporabnik_id === req.user.id);
    if (req.query.prebrano !== undefined) {
        notifications = notifications.filter((notification) => {
            return notification.prebrano === (String(req.query.prebrano) === 'true');
        });
    }

    return res.json(notifications.map((notification) => ({
        ...notification,
        dogodek: enrichEvent(findEvent(notification.dogodek_id))
    })));
});

app.put('/api/notifications/:id/read', authenticate, requireScope('notifications'), (req, res) => {
    const notification = db.notifications.find((candidate) => candidate.id === req.params.id);
    if (!notification) {
        return sendError(res, 404, 'Obvestilo ne obstaja.');
    }
    if (notification.uporabnik_id !== req.user.id) {
        return sendError(res, 403, 'Obvestilo pripada drugemu uporabniku.');
    }

    notification.prebrano = true;
    saveDb();
    return res.json({ id: notification.id, prebrano: notification.prebrano });
});

app.delete('/api/notifications/:id', authenticate, requireScope('notifications'), (req, res) => {
    const notification = db.notifications.find((candidate) => candidate.id === req.params.id);
    if (!notification) {
        return sendError(res, 404, 'Obvestilo ne obstaja.');
    }
    if (notification.uporabnik_id !== req.user.id) {
        return sendError(res, 403, 'Obvestilo pripada drugemu uporabniku.');
    }

    db.notifications = db.notifications.filter((candidate) => candidate.id !== notification.id);
    saveDb();
    return res.status(204).send();
});

app.post('/api/push/subscribe', authenticate, (req, res) => {
    const subscription = {
        id: id('sub'),
        user_id: req.user.id,
        endpoint: req.body.endpoint || `local-${req.user.id}`,
        keys: req.body.keys || {},
        ustvarjeno: now()
    };

    const existingIndex = db.pushSubscriptions.findIndex((item) => item.user_id === req.user.id && item.endpoint === subscription.endpoint);
    if (existingIndex >= 0) {
        db.pushSubscriptions[existingIndex] = subscription;
    } else {
        db.pushSubscriptions.push(subscription);
    }

    saveDb();
    return res.status(201).json({ sporocilo: 'Naprava je narocena na potisna sporocila.', subscription });
});

app.post('/api/push/send', authenticate, requireScope('notifications'), (req, res) => {
    const title = req.body.title || 'KajDogaja';
    const body = req.body.body || 'Novo potisno sporocilo.';
    const message = queuePushMessage(title, body, {
        sender_id: req.user.id,
        url: req.body.url || '/pwa'
    });

    saveDb();
    return res.status(201).json({ sporocilo: 'Push sporocilo je pripravljeno.', message });
});

app.get('/api/push/messages', authenticate, requireScope('notifications'), (req, res) => {
    const pending = db.pushMessages.filter((message) => !message.delivered);
    for (const message of pending) {
        message.delivered = true;
        message.delivered_at = now();
    }
    saveDb();
    return res.json(pending);
});

app.use((req, res) => {
    sendError(res, 404, 'Pot ne obstaja.');
});

app.use((error, req, res, next) => {
    console.error(error);
    sendError(res, 500, 'Prislo je do napake na strezniku.');
});

ensureQrCodes().then(() => {
    app.listen(PORT, () => {
        console.log(`KajDogaja REST API deluje na http://localhost:${PORT}`);
    });
});
