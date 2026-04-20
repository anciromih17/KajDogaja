const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const TOKEN_STORE_PATH = path.join(__dirname, '.oauth-tokens.json');
const OAUTH_CLIENT = {
    client_id: 'kajdogaja-test-client',
    client_secret: 'kajdogaja-test-secret'
};

const client = axios.create({
    baseURL: API_URL,
    validateStatus: () => true
});

function loadTokenStore() {
    if (!fs.existsSync(TOKEN_STORE_PATH)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf8'));
}

function saveTokenStore(store) {
    fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(store, null, 2));
}

function saveToken(label, tokenResponse) {
    const store = loadTokenStore();
    store[label] = {
        ...tokenResponse,
        saved_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
    };
    saveTokenStore(store);
    return store[label];
}

function isTokenUsable(tokenData) {
    if (!tokenData || !tokenData.access_token || !tokenData.expires_at) {
        return false;
    }

    return new Date(tokenData.expires_at).getTime() - Date.now() > 30_000;
}

function expectedScope(label) {
    return label === 'organizator'
        ? 'read write events registrations notifications'
        : 'read registrations notifications';
}

async function request(method, url, data, accessToken) {
    const response = await client.request({
        method,
        url,
        data,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    });

    const body = response.status === 204 ? '(brez vsebine)' : response.data;
    console.log(`${method.toUpperCase()} ${url} -> ${response.status}`);
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    console.log('');
    return response;
}

async function introspectToken(accessToken) {
    const response = await request('post', '/oauth/introspect', {
        client_id: OAUTH_CLIENT.client_id,
        client_secret: OAUTH_CLIENT.client_secret,
        token: accessToken
    });

    return response.status === 200 && response.data.active === true;
}

async function requestOAuthPasswordToken(label, email, password, scope) {
    const response = await request('post', '/oauth/token', {
        grant_type: 'password',
        client_id: OAUTH_CLIENT.client_id,
        client_secret: OAUTH_CLIENT.client_secret,
        username: email,
        password,
        scope
    });

    if (response.status !== 200) {
        throw new Error(`OAuth token ni bil izdan za ${email}.`);
    }

    console.log(`OAuth access_token in refresh_token sta shranjena za ${label}.`);
    console.log('');
    return saveToken(label, response.data);
}

async function refreshOAuthToken(label, tokenData) {
    const response = await request('post', '/oauth/token', {
        grant_type: 'refresh_token',
        client_id: OAUTH_CLIENT.client_id,
        client_secret: OAUTH_CLIENT.client_secret,
        refresh_token: tokenData.refresh_token
    });

    if (response.status !== 200) {
        return null;
    }

    console.log(`OAuth access_token je obnovljen z refresh_token za ${label}.`);
    console.log('');
    return saveToken(label, response.data);
}

async function getOAuthToken(label, email, password) {
    const store = loadTokenStore();
    const savedToken = store[label];
    const requestedScope = expectedScope(label);

    if (isTokenUsable(savedToken)) {
        const scopeMatches = savedToken.scope === requestedScope;
        const active = scopeMatches ? await introspectToken(savedToken.access_token) : false;
        if (active) {
            console.log(`Uporabljam shranjen OAuth access_token za ${label}.`);
            console.log('');
            return savedToken.access_token;
        }

        console.log(`Shranjeni OAuth access_token za ${label} ni vec primeren, zato ga obnavljam.`);
        console.log('');
    }

    if (savedToken && savedToken.refresh_token) {
        const refreshed = await refreshOAuthToken(label, savedToken);
        if (refreshed) {
            return refreshed.access_token;
        }
    }

    const issued = await requestOAuthPasswordToken(label, email, password, requestedScope);
    return issued.access_token;
}

async function revokeToken(accessToken) {
    await request('post', '/oauth/revoke', {
        client_id: OAUTH_CLIENT.client_id,
        client_secret: OAUTH_CLIENT.client_secret,
        token: accessToken,
        token_type_hint: 'access_token'
    });
}

async function runDemo() {
    console.log(`Povezujem se na ${API_URL}`);
    console.log('OAuth odjemalec: kajdogaja-test-client');
    console.log('Demo racuni: organizator@kajdogaja.si / organizator123, uporabnik@kajdogaja.si / uporabnik123');
    console.log('');

    const organizerToken = await getOAuthToken('organizator', 'organizator@kajdogaja.si', 'organizator123');
    const userToken = await getOAuthToken('uporabnik', 'uporabnik@kajdogaja.si', 'uporabnik123');

    await request('post', '/oauth/introspect', {
        client_id: OAUTH_CLIENT.client_id,
        client_secret: OAUTH_CLIENT.client_secret,
        token: userToken
    });

    await request('get', '/categories');
    await request('get', '/cities');
    await request('get', '/events?city=Maribor&q=koncert');
    await request('get', '/me', null, userToken);

    const createEvent = await request('post', '/events', {
        naziv: `OAuth demo dogodek ${Date.now()}`,
        opis: 'Dogodek ustvarjen iz Node.js OAuth odjemalca.',
        datum: '2026-06-01',
        datum_do: '2026-06-02',
        ura: '18:30',
        lokacija: 'Glavni trg Maribor',
        koordinate_lat: 46.5574,
        koordinate_lng: 15.6459,
        kapaciteta: 2,
        kategorija_id: 'cat_kultura',
        mesto_id: 'city_maribor'
    }, organizerToken);

    if (createEvent.status !== 201 || !createEvent.data.id) {
        throw new Error('Ustvarjanje dogodka ni uspelo, zato demo ne more nadaljevati.');
    }

    const eventId = createEvent.data.id;
    await request('get', `/events/${eventId}`);
    await request('get', `/events/${eventId}/qr`);
    await request('post', `/events/${eventId}/registrations`, {}, userToken);
    await request('get', '/me/registrations', null, userToken);
    await request('get', `/events/${eventId}/registrations`, null, organizerToken);
    await request('put', `/events/${eventId}`, { ura: '19:00', opis: 'Posodobljen opis dogodka.' }, organizerToken);
    await request('get', `/events/${eventId}/stats`, null, organizerToken);

    const notifications = await request('get', '/notifications?prebrano=false', null, userToken);
    if (Array.isArray(notifications.data) && notifications.data[0]) {
        await request('put', `/notifications/${notifications.data[0].id}/read`, {}, userToken);
        await request('delete', `/notifications/${notifications.data[0].id}`, null, userToken);
    }

    await request('delete', `/events/${eventId}/registrations`, null, userToken);
    await request('delete', `/events/${eventId}`, null, organizerToken);
    await revokeToken(organizerToken);
    await revokeToken(userToken);
}

runDemo().catch((error) => {
    console.error('Odjemalec se je ustavil z napako:', error.message);
    process.exit(1);
});
