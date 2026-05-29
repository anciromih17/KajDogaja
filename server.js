require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const userService = require('./services/userService');
const categoryService = require('./services/categoryService');
const cityService = require('./services/cityService');
const eventService = require('./services/eventService');
const registrationService = require('./services/registrationService');
const notificationService = require('./services/notificationService');
const oauthService = require('./services/oauthService');
const pushService = require('./services/pushService');
const { asyncHandler, handlePrismaError } = require('./db/errorHandler');
const userModel = require('./models/userModel');
const eventModel = require('./models/eventModel');
const categoryModel = require('./models/categoryModel');
const cityModel = require('./models/cityModel');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kajdogaja-development-secret';
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send();
    return next();
});

function sendError(res, status, message) {
    return res.status(status).json({ napaka: message, koda: status });
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

async function issueOAuthTokens(user, client, scope) {
    const accessToken = createAccessToken(user, client, scope);
    const refreshToken = await oauthService.createRefreshToken(user.id, client.id, scope, REFRESH_TOKEN_EXPIRES_IN);
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_IN,
        refresh_token: refreshToken,
        scope
    };
}

async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return sendError(res, 401, 'Manjka OAuth Bearer access_token.');

    if (await oauthService.isAccessTokenRevoked(token)) {
        return sendError(res, 401, 'Access token ni vec veljaven.');
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.token_use !== 'access_token') {
            return sendError(res, 401, 'Zeton ni OAuth access_token.');
        }

        const user = await userService.findById(payload.id);
        if (!user) return sendError(res, 401, 'Uporabnik ne obstaja.');

        req.user = user;
        req.token = token;
        req.oauth = { client_id: payload.client_id, scope: payload.scope };
        return next();
    } catch {
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

function requireScope(...required) {
    return (req, res, next) => {
        const has = String(req.oauth?.scope || '').split(/\s+/).filter(Boolean);
        if (!required.every((s) => has.includes(s))) {
            return sendError(res, 403, `Manjka OAuth scope: ${required.join(' ')}.`);
        }
        return next();
    };
}

async function requireEventOwner(req, res, next) {
    const event = await eventService.findRaw(req.params.id);
    if (!event) return sendError(res, 404, 'Dogodek ne obstaja.');
    if (event.organizator_id !== req.user.id) {
        return sendError(res, 403, 'Dogodek lahko ureja samo njegov organizator.');
    }
    req.rawEvent = event;
    return next();
}


// ── Static / pages ──────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
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
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 24px; }
        a { display: block; padding: 16px; border: 1px solid #dbe5ff; border-radius: 8px; background: #fff; color: #1f3c88; text-decoration: none; font-weight: 650; }
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
app.get('/pwa/?', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sw.js')));
app.get('/manifest.webmanifest', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest')));
app.get('/funkcionalnosti-odjemalca/?', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'funkcionalnosti-odjemalca.html')));
app.get('/funkcionalnosti-streznika/?', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'funkcionalnosti-streznika.html')));
app.get('/podatkovni-model/?', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'podatkovni-model.html')));
app.get('/posebnosti/?', (req, res) => res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'posebnosti.txt')));
app.get('/tehnicne-zahteve-streznika/?', (req, res) => res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'tehnicne-zahteve-streznika.txt')));
app.get('/REST/?', (req, res) => res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, 'texts', 'rest.txt')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// ── API info ─────────────────────────────────────────────────────────────────

app.get('/api', (req, res) => {
    res.json({
        ime: 'KajDogaja REST API',
        verzija: '2.0.0',
        baza: 'PostgreSQL + Prisma',
        endpointi: [
            'POST /api/oauth/token', 'POST /api/oauth/revoke', 'POST /api/oauth/introspect',
            'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout',
            'GET /api/events', 'GET /api/events/:id', 'POST /api/events', 'PUT /api/events/:id', 'DELETE /api/events/:id',
            'GET /api/events/:id/qr', 'GET /api/events/:id/registrations',
            'POST /api/events/:id/registrations', 'DELETE /api/events/:id/registrations',
            'GET /api/me', 'PUT /api/me', 'GET /api/me/registrations',
            'GET /api/notifications', 'PUT /api/notifications/:id/read', 'DELETE /api/notifications/:id',
            'POST /api/push/subscribe', 'POST /api/push/send', 'GET /api/push/messages',
            'GET /api/events/:id/stats', 'GET /api/categories', 'POST /api/categories',
            'GET /api/cities', 'POST /api/cities'
        ]
    });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { uporabnisko_ime, email, geslo, vloga = 'uporabnik' } = req.body;
    const validErr = userModel.validateRegister({ uporabnisko_ime, email, geslo, vloga });
    if (validErr) return sendError(res, 400, validErr);
    if (await userService.findByEmail(email)) return sendError(res, 409, 'Email ze obstaja.');

    const user = await userService.create({
        uporabnisko_ime,
        email,
        geslo_hash: await bcrypt.hash(geslo, 10),
        vloga
    });
    return res.status(201).json(userService.publicUser(user));
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, geslo } = req.body;
    const user = await userService.findByEmail(String(email || ''));
    if (!user || !(await bcrypt.compare(String(geslo || ''), user.geslo_hash))) {
        return sendError(res, 401, 'Napacni prijavni podatki.');
    }
    const client = await oauthService.findClient('kajdogaja-test-client', 'kajdogaja-test-secret');
    const scope = client.scopes.join(' ');
    const token = createAccessToken(user, client, scope);
    return res.json({
        token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_IN,
        uporabnik: { id: user.id, vloga: user.vloga, uporabnisko_ime: user.uporabnisko_ime }
    });
}));

app.post('/api/auth/logout', authenticate, async (req, res) => {
    await oauthService.revokeAccessToken(req.token);
    return res.json({ sporocilo: 'Odjava uspesna.' });
});

// ── Categories ────────────────────────────────────────────────────────────────

app.get('/api/categories', async (req, res) => {
    return res.json(await categoryService.findAll());
});

app.post('/api/categories', authenticate, requireScope('write'), requireRole('organizator'), asyncHandler(async (req, res) => {
    const validErr = categoryModel.validate(req.body);
    if (validErr) return sendError(res, 400, validErr);
    const naziv = String(req.body.naziv).trim();
    if (await categoryService.existsByNaziv(naziv)) return sendError(res, 409, 'Kategorija ze obstaja.');
    return res.status(201).json(await categoryService.create(naziv));
}));

// ── Cities ────────────────────────────────────────────────────────────────────

app.get('/api/cities', async (req, res) => {
    return res.json(await cityService.findAll());
});

app.post('/api/cities', authenticate, requireScope('write'), requireRole('organizator'), asyncHandler(async (req, res) => {
    const validErr = cityModel.validate(req.body);
    if (validErr) return sendError(res, 400, validErr);
    const naziv = String(req.body.naziv).trim();
    if (await cityService.existsByNaziv(naziv)) return sendError(res, 409, 'Mesto ze obstaja.');
    return res.status(201).json(await cityService.create(naziv, Number(req.body.koordinate_lat), Number(req.body.koordinate_lng)));
}));

// ── OAuth ─────────────────────────────────────────────────────────────────────

app.post('/api/oauth/token', async (req, res) => {
    const { grant_type, client_id, client_secret, username, email, password, geslo, refresh_token, scope } = req.body;
    const client = await oauthService.findClient(client_id, client_secret);
    if (!client) return sendError(res, 401, 'OAuth odjemalec ni veljaven.');

    if (grant_type === 'password') {
        const loginEmail = email || username;
        const loginPassword = geslo || password;
        const user = await userService.findByEmail(String(loginEmail || ''));
        if (!user || !(await bcrypt.compare(String(loginPassword || ''), user.geslo_hash))) {
            return sendError(res, 401, 'Napacni prijavni podatki.');
        }
        return res.json(await issueOAuthTokens(user, client, oauthService.normalizeUserScope(scope, client, user)));
    }

    if (grant_type === 'refresh_token') {
        const rt = await oauthService.findRefreshToken(String(refresh_token || ''), client.id);
        if (!rt || rt.revoked) return sendError(res, 401, 'Refresh token ni veljaven.');
        if (new Date(rt.expires_at).getTime() < Date.now()) {
            await oauthService.revokeRefreshToken(rt.id);
            return sendError(res, 401, 'Refresh token je potekel.');
        }
        const user = await userService.findById(rt.user_id);
        if (!user) return sendError(res, 401, 'Uporabnik ne obstaja.');
        await oauthService.revokeRefreshToken(rt.id);
        return res.json(await issueOAuthTokens(user, client, oauthService.normalizeUserScope(rt.scope, client, user)));
    }

    return sendError(res, 400, 'Nepodprt OAuth grant_type.');
});

app.post('/api/oauth/revoke', async (req, res) => {
    const { client_id, client_secret, token, token_type_hint } = req.body;
    const client = await oauthService.findClient(client_id, client_secret);
    if (!client) return sendError(res, 401, 'OAuth odjemalec ni veljaven.');

    if (token_type_hint === 'refresh_token') {
        await oauthService.revokeRefreshTokenByHash(String(token || ''), client.id);
    } else if (token) {
        await oauthService.revokeAccessToken(token);
    }
    return res.status(200).json({ sporocilo: 'Token je preklican.' });
});

app.post('/api/oauth/introspect', async (req, res) => {
    const { client_id, client_secret, token } = req.body;
    const client = await oauthService.findClient(client_id, client_secret);
    if (!client) return sendError(res, 401, 'OAuth odjemalec ni veljaven.');

    try {
        if (!token || (await oauthService.isAccessTokenRevoked(token))) return res.json({ active: false });
        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({ active: true, sub: payload.sub, client_id: payload.client_id, scope: payload.scope, token_type: 'Bearer', exp: payload.exp, iat: payload.iat });
    } catch {
        return res.json({ active: false });
    }
});

// ── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', async (req, res) => {
    return res.json(await eventService.findAll(req.query));
});

app.get('/api/events/:id/qr', async (req, res) => {
    const event = await eventService.findRaw(req.params.id);
    if (!event) return sendError(res, 404, 'Dogodek ne obstaja.');
    return res.json({ qr_koda_url: event.qr_koda_url });
});

app.get('/api/events/:id/registrations', authenticate, requireScope('read', 'registrations'), requireRole('organizator'), requireEventOwner, async (req, res) => {
    return res.json(await registrationService.findByEvent(req.rawEvent.id));
});

app.post('/api/events/:id/registrations', authenticate, requireScope('registrations'), requireRole('uporabnik'), async (req, res) => {
    const event = await eventService.findRaw(req.params.id);
    if (!event) return sendError(res, 404, 'Dogodek ne obstaja.');
    if (await registrationService.findActiveByUserAndEvent(req.user.id, event.id)) {
        return sendError(res, 409, 'Uporabnik je ze prijavljen na dogodek.');
    }
    if (event.kapaciteta !== null && (await eventService.countRegistrations(event.id)) >= event.kapaciteta) {
        return sendError(res, 410, 'Dogodek je poln.');
    }
    const reg = await registrationService.create(req.user.id, event.id);
    return res.status(201).json({ id: reg.id, status: reg.status, dogodek_id: reg.dogodek_id });
});

app.delete('/api/events/:id/registrations', authenticate, requireScope('registrations'), requireRole('uporabnik'), async (req, res) => {
    const removed = await registrationService.remove(req.user.id, req.params.id);
    if (!removed) return sendError(res, 404, 'Prijava ne obstaja.');
    return res.status(204).send();
});

app.get('/api/events/:id/stats', authenticate, requireScope('read', 'events'), requireRole('organizator'), requireEventOwner, async (req, res) => {
    const total = await eventService.countRegistrations(req.rawEvent.id);
    const capacity = req.rawEvent.kapaciteta;
    return res.json({
        skupaj_prijav: total,
        kapaciteta: capacity,
        zasedenost_odstotek: capacity ? Math.round((total / capacity) * 100) : null,
        prostih_mest: capacity ? Math.max(capacity - total, 0) : null,
        prijave_po_dnevih: await eventService.registrationsByDay(req.rawEvent.id)
    });
});

app.get('/api/events/:id', async (req, res) => {
    const event = await eventService.findById(req.params.id);
    if (!event) return sendError(res, 404, 'Dogodek ne obstaja.');
    return res.json(event);
});

app.post('/api/events', authenticate, requireScope('write', 'events'), requireRole('organizator'), asyncHandler(async (req, res) => {
    const validErr = await eventModel.validate(req.body);
    if (validErr) return sendError(res, 400, validErr);

    const prisma = require('./db/prisma');
    const created = await prisma.event.create({ data: eventModel.buildCreateData(req.body, req.user.id) });
    const qr = await QRCode.toDataURL(`http://localhost:${PORT}/api/events/${created.id}`);
    const event = await eventService.update(created.id, { qr_koda_url: qr });

    await pushService.queueMessage('Nov dogodek', `Dodana je prireditev "${event.naziv}".`, { eventId: event.id });
    return res.status(201).json(event);
}));

app.put('/api/events/:id', authenticate, requireScope('write', 'events'), requireRole('organizator'), requireEventOwner, asyncHandler(async (req, res) => {
    const validErr = await eventModel.validate(req.body, true);
    if (validErr) return sendError(res, 400, validErr);

    const event = await eventService.update(req.rawEvent.id, eventModel.buildUpdateData(req.body));

    const userIds = await registrationService.getUserIdsForEvent(req.rawEvent.id);
    for (const uid of userIds) {
        await notificationService.create(uid, req.rawEvent.id, 'sprememba', `Dogodek "${event.naziv}" je bil posodobljen.`);
    }
    await pushService.queueMessage('Dogodek posodobljen', `Dogodek "${event.naziv}" je bil posodobljen.`, { eventId: event.id });
    return res.json(event);
}));

app.delete('/api/events/:id', authenticate, requireScope('write', 'events'), requireRole('organizator'), requireEventOwner, async (req, res) => {
    const naziv = req.rawEvent.naziv;
    const userIds = await registrationService.getUserIdsForEvent(req.rawEvent.id);
    await require('./db/prisma').registration.deleteMany({ where: { dogodek_id: req.rawEvent.id } });
    await eventService.remove(req.rawEvent.id);
    for (const uid of userIds) {
        await notificationService.create(uid, null, 'odpoved', `Dogodek "${naziv}" je bil odpovedan.`);
    }
    await pushService.queueMessage('Dogodek izbrisan', `Dogodek "${naziv}" je bil izbrisan.`, { eventId: req.rawEvent.id });
    return res.status(204).send();
});

// ── Me ────────────────────────────────────────────────────────────────────────

app.get('/api/me', authenticate, requireScope('read'), (req, res) => {
    return res.json(userService.publicUser(req.user));
});

app.put('/api/me', authenticate, requireScope('read'), async (req, res) => {
    const { uporabnisko_ime, email, geslo_novo, geslo_trenutno } = req.body;

    if (email && email.toLowerCase() !== req.user.email.toLowerCase()) {
        const existing = await userService.findByEmail(email);
        if (existing && existing.id !== req.user.id) return sendError(res, 409, 'Email je ze zaseden.');
    }

    const updates = {};
    if (geslo_novo) {
        if (!geslo_trenutno) return sendError(res, 400, 'Za spremembo gesla je potrebno trenutno geslo.');
        if (!(await bcrypt.compare(String(geslo_trenutno), req.user.geslo_hash))) {
            return sendError(res, 401, 'Trenutno geslo ni pravilno.');
        }
        updates.geslo_hash = await bcrypt.hash(geslo_novo, 10);
    }
    if (uporabnisko_ime) updates.uporabnisko_ime = uporabnisko_ime;
    if (email) updates.email = email;

    const updated = await userService.update(req.user.id, updates);
    return res.json(userService.publicUser(updated));
});

app.get('/api/me/registrations', authenticate, requireScope('read', 'registrations'), async (req, res) => {
    return res.json(await registrationService.findByUser(req.user.id));
});

// ── Notifications ─────────────────────────────────────────────────────────────

app.get('/api/notifications', authenticate, requireScope('read', 'notifications'), async (req, res) => {
    return res.json(await notificationService.findByUser(req.user.id, req.query.prebrano));
});

app.put('/api/notifications/:id/read', authenticate, requireScope('notifications'), async (req, res) => {
    const n = await notificationService.findById(req.params.id);
    if (!n) return sendError(res, 404, 'Obvestilo ne obstaja.');
    if (n.uporabnik_id !== req.user.id) return sendError(res, 403, 'Obvestilo pripada drugemu uporabniku.');
    const updated = await notificationService.markRead(req.params.id);
    return res.json({ id: updated.id, prebrano: updated.prebrano });
});

app.delete('/api/notifications/:id', authenticate, requireScope('notifications'), async (req, res) => {
    const n = await notificationService.findById(req.params.id);
    if (!n) return sendError(res, 404, 'Obvestilo ne obstaja.');
    if (n.uporabnik_id !== req.user.id) return sendError(res, 403, 'Obvestilo pripada drugemu uporabniku.');
    await notificationService.remove(req.params.id);
    return res.status(204).send();
});

// ── Push ──────────────────────────────────────────────────────────────────────

app.post('/api/push/subscribe', authenticate, async (req, res) => {
    const sub = await pushService.subscribe(req.user.id, req.body.endpoint, req.body.keys);
    return res.status(201).json({ sporocilo: 'Naprava je narocena na potisna sporocila.', subscription: sub });
});

app.post('/api/push/send', authenticate, requireScope('notifications'), async (req, res) => {
    const title = req.body.title || 'KajDogaja';
    const body = req.body.body || 'Novo potisno sporocilo.';
    const message = await pushService.queueMessage(title, body, { sender_id: req.user.id, url: req.body.url || '/pwa' });
    return res.status(201).json({ sporocilo: 'Push sporocilo je pripravljeno.', message });
});

app.get('/api/push/messages', authenticate, requireScope('notifications'), async (req, res) => {
    return res.json(await pushService.getPendingMessages());
});

// ── Error handlers ────────────────────────────────────────────────────────────

app.use((req, res) => sendError(res, 404, 'Pot ne obstaja.'));

app.use((error, req, res, next) => {
    const handled = handlePrismaError(error, res);
    if (!handled) {
        console.error(error);
        sendError(res, 500, 'Prislo je do napake na strezniku.');
    }
});

app.listen(PORT, () => {
    console.log(`KajDogaja REST API deluje na http://localhost:${PORT}`);
    console.log('Baza: PostgreSQL + Prisma');
});
