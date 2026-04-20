const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const client = axios.create({
    baseURL: API_URL,
    validateStatus: () => true
});

async function request(method, url, data, token) {
    const response = await client.request({
        method,
        url,
        data,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    const body = response.status === 204 ? '(brez vsebine)' : response.data;
    console.log(`${method.toUpperCase()} ${url} -> ${response.status}`);
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    console.log('');
    return response;
}

async function login(email, geslo) {
    const response = await request('post', '/auth/login', { email, geslo });
    if (response.status !== 200) {
        throw new Error(`Prijava ni uspela za ${email}.`);
    }
    return response.data.token;
}

async function runDemo() {
    console.log(`Povezujem se na ${API_URL}`);
    console.log('Demo racuni: organizator@kajdogaja.si / organizator123, uporabnik@kajdogaja.si / uporabnik123');
    console.log('');

    const organizerToken = await login('organizator@kajdogaja.si', 'organizator123');
    const userToken = await login('uporabnik@kajdogaja.si', 'uporabnik123');

    await request('get', '/categories');
    await request('get', '/cities');
    await request('get', '/events?city=Maribor&q=koncert');
    await request('get', '/me', null, userToken);

    const createEvent = await request('post', '/events', {
        naziv: `API demo dogodek ${Date.now()}`,
        opis: 'Dogodek ustvarjen iz Node.js odjemalca.',
        datum: '2026-06-01',
        ura: '18:30',
        lokacija: 'Glavni trg Maribor',
        koordinate_lat: 46.5574,
        koordinate_lng: 15.6459,
        kapaciteta: 2,
        kategorija_id: 'cat_kultura',
        mesto_id: 'city_maribor'
    }, organizerToken);

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
    await request('post', '/auth/logout', {}, organizerToken);
    await request('post', '/auth/logout', {}, userToken);
}

runDemo().catch((error) => {
    console.error('Odjemalec se je ustavil z napako:', error.message);
    process.exit(1);
});
