const API_URL = '/api';
const CLIENT = {
    client_id: 'kajdogaja-test-client',
    client_secret: 'kajdogaja-test-secret'
};
const STORE_KEYS = {
    token: 'kajdogaja_pwa_token',
    events: 'kajdogaja_pwa_events',
    categories: 'kajdogaja_pwa_categories',
    cities: 'kajdogaja_pwa_cities',
    queue: 'kajdogaja_pwa_queue'
};

const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    syncButton: document.getElementById('syncButton'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    categoryFilter: document.getElementById('categoryFilter'),
    cityFilter: document.getElementById('cityFilter'),
    eventsList: document.getElementById('eventsList'),
    eventCount: document.getElementById('eventCount'),
    form: document.getElementById('eventForm'),
    formTitle: document.getElementById('formTitle'),
    resetFormButton: document.getElementById('resetFormButton'),
    eventId: document.getElementById('eventId'),
    eventName: document.getElementById('eventName'),
    eventDescription: document.getElementById('eventDescription'),
    eventDate: document.getElementById('eventDate'),
    eventDateTo: document.getElementById('eventDateTo'),
    eventTime: document.getElementById('eventTime'),
    eventLocation: document.getElementById('eventLocation'),
    eventCategory: document.getElementById('eventCategory'),
    eventCity: document.getElementById('eventCity'),
    eventLat: document.getElementById('eventLat'),
    eventLng: document.getElementById('eventLng'),
    eventCapacity: document.getElementById('eventCapacity'),
    addCategoryButton: document.getElementById('addCategoryButton'),
    addCityButton: document.getElementById('addCityButton'),
    totalEventsStat: document.getElementById('totalEventsStat'),
    categoryStat: document.getElementById('categoryStat'),
    queueStat: document.getElementById('queueStat'),
    profileButton: document.getElementById('profileButton'),
    profileDropdown: document.getElementById('profileDropdown'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileRole: document.getElementById('profileRole'),
    toastHost: document.getElementById('toastHost')
};

let state = {
    events: [],
    categories: [],
    cities: [],
    lazyObserver: null
};

function readStore(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
}

function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function updateStats() {
    elements.totalEventsStat.textContent = String(state.events.length);
    elements.categoryStat.textContent = String(state.categories.length);
    elements.queueStat.textContent = String(readStore(STORE_KEYS.queue, []).length);
}

function toast(message, type = 'ok') {
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.textContent = message;
    elements.toastHost.append(node);
    setTimeout(() => node.remove(), 3800);
}

async function notify(title, body) {
    toast(body, title === 'Napaka' ? 'error' : 'ok');

    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
            registration.showNotification(title, {
                body,
                icon: '/icons/icon-192.svg',
                badge: '/icons/icon-192.svg'
            });
        } else {
            new Notification(title, { body });
        }
    }
}

function updateConnectionStatus() {
    elements.connectionStatus.textContent = navigator.onLine ? 'Online' : 'Offline';
    elements.connectionStatus.classList.toggle('offline', !navigator.onLine);
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    await navigator.serviceWorker.register('/sw.js');
}

async function getToken() {
    const saved = readStore(STORE_KEYS.token, null);
    if (saved && new Date(saved.expires_at).getTime() - Date.now() > 30000) {
        return saved.access_token;
    }

    const response = await fetch(`${API_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'password',
            client_id: CLIENT.client_id,
            client_secret: CLIENT.client_secret,
            username: 'organizator@kajdogaja.si',
            password: 'organizator123',
            scope: 'read write events registrations notifications'
        })
    });

    if (!response.ok) {
        throw new Error('OAuth prijava ni uspela.');
    }

    const token = await response.json();
    token.expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
    writeStore(STORE_KEYS.token, token);
    return token.access_token;
}

async function apiRequest(path, options = {}, retried = false) {
    const token = options.auth === false ? null : await getToken();
    const response = await fetch(`${API_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        if (response.status === 401 && token && !retried) {
            localStorage.removeItem(STORE_KEYS.token);
            return apiRequest(path, options, true);
        }

        const error = await response.json().catch(() => ({ napaka: 'Neznana napaka.' }));
        throw new Error(error.napaka || 'Zahteva ni uspela.');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function cacheReferenceData() {
    writeStore(STORE_KEYS.categories, state.categories);
    writeStore(STORE_KEYS.cities, state.cities);
}

async function loadReferenceData() {
    try {
        const [categories, cities] = await Promise.all([
            apiRequest('/categories', { auth: false }),
            apiRequest('/cities', { auth: false })
        ]);
        state.categories = categories;
        state.cities = cities;
        cacheReferenceData();
    } catch (error) {
        state.categories = readStore(STORE_KEYS.categories, []);
        state.cities = readStore(STORE_KEYS.cities, []);
        notify('Napaka', 'Šifranti so naloženi iz lokalne shrambe.');
    }

    renderSelects();
    updateStats();
}

function renderSelects() {
    const categoryOptions = state.categories.map((item) => `<option value="${item.id}">${item.naziv}</option>`).join('');
    const cityOptions = state.cities.map((item) => `<option value="${item.id}">${item.naziv}</option>`).join('');

    elements.categoryFilter.innerHTML = '<option value="">Vse kategorije</option>' + categoryOptions;
    elements.cityFilter.innerHTML = '<option value="">Vsa mesta</option>' + cityOptions;
    elements.eventCategory.innerHTML = categoryOptions + '<option value="__new_category">+ Dodaj novo kategorijo</option>';
    elements.eventCity.innerHTML = cityOptions + '<option value="__new_city">+ Dodaj novo mesto</option>';
    updateStats();
}

function queryString() {
    const params = new URLSearchParams();
    if (elements.searchInput.value.trim()) {
        params.set('q', elements.searchInput.value.trim());
    }
    if (elements.categoryFilter.value) {
        params.set('category', elements.categoryFilter.value);
    }
    if (elements.cityFilter.value) {
        params.set('city', elements.cityFilter.value);
    }
    const value = params.toString();
    return value ? `?${value}` : '';
}

async function loadEvents() {
    try {
        const events = await apiRequest(`/events${queryString()}`, { auth: false });
        state.events = events;
        writeStore(STORE_KEYS.events, events);
        renderEvents(events);
        updateStats();
        await deliverPushMessages();
    } catch (error) {
        const cached = readStore(STORE_KEYS.events, []);
        state.events = cached;
        renderEvents(cached);
        updateStats();
        notify('Napaka', 'Povezava ni na voljo. Prikazani so lokalno shranjeni dogodki.');
    }
}

function renderEvents(events) {
    elements.eventCount.textContent = `${events.length} zadetkov`;
    elements.eventsList.innerHTML = '';

    if (!events.length) {
        elements.eventsList.innerHTML = '<p class="muted">Ni najdenih dogodkov.</p>';
        return;
    }

    for (const event of events) {
        const dateLabel = event.datum_do && event.datum_do !== event.datum
            ? `${event.datum} - ${event.datum_do}`
            : event.datum;
        const card = document.createElement('article');
        card.className = 'event-card';
        card.innerHTML = `
            <h3>${event.naziv}</h3>
            <p>${event.opis}</p>
            <div class="event-meta">
                <span class="chip">${dateLabel} ob ${event.ura}</span>
                <span class="chip">${event.mesto?.naziv || event.mesto_id}</span>
                <span class="chip">${event.kategorija?.naziv || event.kategorija_id}</span>
                <span class="chip">${event.st_prijav || 0}/${event.kapaciteta || '-'}</span>
            </div>
            <div class="event-footer">
                <img class="qr-preview lazy-img" alt="QR koda dogodka" data-src="${event.qr_koda_url || ''}">
                <div class="event-actions">
                    <button type="button" data-action="edit" data-id="${event.id}">Uredi</button>
                    <button type="button" class="danger" data-action="delete" data-id="${event.id}">Izbriši</button>
                </div>
            </div>
        `;
        elements.eventsList.append(card);
    }

    setupLazyImages();
}

function setupLazyImages() {
    const images = document.querySelectorAll('.lazy-img[data-src]');
    if (state.lazyObserver) {
        state.lazyObserver.disconnect();
    }

    state.lazyObserver = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) {
                continue;
            }
            const image = entry.target;
            image.src = image.dataset.src;
            image.removeAttribute('data-src');
            observer.unobserve(image);
        }
    }, { rootMargin: '80px' });

    images.forEach((image) => state.lazyObserver.observe(image));
}

function resetForm() {
    elements.form.reset();
    elements.eventId.value = '';
    elements.formTitle.textContent = 'Nov dogodek';
    const city = state.cities[0];
    if (city) {
        elements.eventCity.value = city.id;
        elements.eventLat.value = city.koordinate_lat;
        elements.eventLng.value = city.koordinate_lng;
    }
}

function fillForm(event) {
    elements.formTitle.textContent = 'Uredi dogodek';
    elements.eventId.value = event.id;
    elements.eventName.value = event.naziv;
    elements.eventDescription.value = event.opis;
    elements.eventDate.value = event.datum;
    elements.eventDateTo.value = event.datum_do || event.datum;
    elements.eventTime.value = event.ura;
    elements.eventLocation.value = event.lokacija;
    elements.eventCategory.value = event.kategorija_id;
    elements.eventCity.value = event.mesto_id;
    elements.eventLat.value = event.koordinate_lat;
    elements.eventLng.value = event.koordinate_lng;
    elements.eventCapacity.value = event.kapaciteta || 1;
}

function formPayload() {
    if (elements.eventDateTo.value && elements.eventDateTo.value < elements.eventDate.value) {
        throw new Error('Datum do ne sme biti pred datumom od.');
    }

    return {
        naziv: elements.eventName.value.trim(),
        opis: elements.eventDescription.value.trim(),
        datum: elements.eventDate.value,
        datum_do: elements.eventDateTo.value || elements.eventDate.value,
        ura: elements.eventTime.value,
        lokacija: elements.eventLocation.value.trim(),
        kategorija_id: elements.eventCategory.value,
        mesto_id: elements.eventCity.value,
        koordinate_lat: Number(elements.eventLat.value),
        koordinate_lng: Number(elements.eventLng.value),
        kapaciteta: Number(elements.eventCapacity.value)
    };
}

function enqueueOperation(operation) {
    const queue = readStore(STORE_KEYS.queue, []);
    queue.push({ ...operation, queued_at: new Date().toISOString() });
    writeStore(STORE_KEYS.queue, queue);
    updateStats();
}

async function loadProfile() {
    try {
        const profile = await apiRequest('/me');
        const name = profile.ime || profile.email || 'Prijavljen uporabnik';
        elements.profileName.textContent = name;
        elements.profileEmail.textContent = profile.email || '-';
        elements.profileRole.textContent = profile.vloga || '-';
    } catch (error) {
        elements.profileName.textContent = 'Profil ni na voljo';
        elements.profileEmail.textContent = error.message;
        elements.profileRole.textContent = 'offline';
    }
}

async function addCategoryFromPrompt() {
    const naziv = prompt('Vnesi naziv nove kategorije:');
    if (!naziv || !naziv.trim()) {
        elements.eventCategory.value = state.categories[0]?.id || '';
        return;
    }

    try {
        const category = await apiRequest('/categories', {
            method: 'POST',
            body: { naziv: naziv.trim() }
        });
        state.categories.push(category);
        cacheReferenceData();
        renderSelects();
        elements.eventCategory.value = category.id;
        updateStats();
        await notify('Shranjeno', 'Nova kategorija je dodana.');
    } catch (error) {
        await notify('Napaka', error.message);
        elements.eventCategory.value = state.categories[0]?.id || '';
    }
}

async function addCityFromPrompt() {
    const naziv = prompt('Vnesi naziv novega mesta:');
    if (!naziv || !naziv.trim()) {
        elements.eventCity.value = state.cities[0]?.id || '';
        return;
    }

    const lat = Number(prompt('Vnesi geografsko širino mesta:', '46.5547'));
    const lng = Number(prompt('Vnesi geografsko dolžino mesta:', '15.6459'));
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        await notify('Napaka', 'Koordinate mesta niso veljavne.');
        elements.eventCity.value = state.cities[0]?.id || '';
        return;
    }

    try {
        const city = await apiRequest('/cities', {
            method: 'POST',
            body: { naziv: naziv.trim(), koordinate_lat: lat, koordinate_lng: lng }
        });
        state.cities.push(city);
        cacheReferenceData();
        renderSelects();
        elements.eventCity.value = city.id;
        elements.eventLat.value = city.koordinate_lat;
        elements.eventLng.value = city.koordinate_lng;
        updateStats();
        await notify('Shranjeno', 'Novo mesto je dodano.');
    } catch (error) {
        await notify('Napaka', error.message);
        elements.eventCity.value = state.cities[0]?.id || '';
    }
}

async function saveEvent(event) {
    event.preventDefault();
    const eventId = elements.eventId.value;
    let payload;
    try {
        payload = formPayload();
    } catch (error) {
        await notify('Napaka', error.message);
        return;
    }
    const operation = eventId
        ? { method: 'PUT', path: `/events/${eventId}`, body: payload }
        : { method: 'POST', path: '/events', body: payload };

    try {
        await apiRequest(operation.path, { method: operation.method, body: operation.body });
        await notify('Shranjeno', eventId ? 'Dogodek je posodobljen.' : 'Nov dogodek je dodan.');
        resetForm();
        await loadEvents();
    } catch (error) {
        enqueueOperation(operation);
        await notify('Napaka', 'Povezava ni na voljo. Sprememba je shranjena za poznejšo sinhronizacijo.');
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Ali želiš izbrisati dogodek?')) {
        return;
    }

    const operation = { method: 'DELETE', path: `/events/${eventId}` };
    try {
        await apiRequest(operation.path, { method: operation.method });
        await notify('Izbrisano', 'Dogodek je izbrisan.');
        await loadEvents();
    } catch (error) {
        enqueueOperation(operation);
        await notify('Napaka', 'Brisanje je shranjeno za poznejšo sinhronizacijo.');
    }
}

async function syncQueue() {
    const queue = readStore(STORE_KEYS.queue, []);
    if (!queue.length) {
        toast('Ni čakajočih sprememb.');
        return;
    }

    const remaining = [];
    for (const operation of queue) {
        try {
            await apiRequest(operation.path, { method: operation.method, body: operation.body });
        } catch (error) {
            remaining.push(operation);
        }
    }

    writeStore(STORE_KEYS.queue, remaining);
    updateStats();
    if (remaining.length) {
        await notify('Napaka', 'Nekaterih sprememb ni bilo mogoče sinhronizirati.');
    } else {
        await notify('Sinhronizirano', 'Vse lokalne spremembe so poslane na strežnik.');
        await loadEvents();
    }
}

async function subscribePush() {
    try {
        const registration = await navigator.serviceWorker?.ready;
        const endpoint = registration ? `local-sw-${Date.now()}` : `local-page-${Date.now()}`;
        await apiRequest('/push/subscribe', {
            method: 'POST',
            body: { endpoint, keys: { mode: 'local-demo' } }
        });
    } catch (error) {
        toast('Naročanje na push obvestila ni uspelo.', 'error');
    }
}

async function deliverPushMessages() {
    try {
        const messages = await apiRequest('/push/messages');
        if (!messages.length) {
            return;
        }
        const registration = await navigator.serviceWorker?.ready;
        for (const message of messages) {
            if (registration?.active) {
                registration.active.postMessage({ type: 'PUSH_NOTIFICATION', payload: message });
            } else {
                await notify(message.title, message.body);
            }
        }
    } catch (error) {
        // Push messages are optional for the main workflow.
    }
}

function bindEvents() {
    elements.searchButton.addEventListener('click', loadEvents);
    elements.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadEvents();
        }
    });
    elements.categoryFilter.addEventListener('change', loadEvents);
    elements.cityFilter.addEventListener('change', loadEvents);
    elements.resetFormButton.addEventListener('click', resetForm);
    elements.syncButton.addEventListener('click', syncQueue);
    elements.addCategoryButton.addEventListener('click', addCategoryFromPrompt);
    elements.addCityButton.addEventListener('click', addCityFromPrompt);
    elements.form.addEventListener('submit', saveEvent);

    elements.profileButton.addEventListener('click', () => {
        const shouldOpen = elements.profileDropdown.hidden;
        elements.profileDropdown.hidden = !shouldOpen;
        elements.profileButton.setAttribute('aria-expanded', String(shouldOpen));
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.profile-menu')) {
            elements.profileDropdown.hidden = true;
            elements.profileButton.setAttribute('aria-expanded', 'false');
        }
    });

    elements.eventCity.addEventListener('change', () => {
        if (elements.eventCity.value === '__new_city') {
            addCityFromPrompt();
            return;
        }
        const city = state.cities.find((item) => item.id === elements.eventCity.value);
        if (city) {
            elements.eventLat.value = city.koordinate_lat;
            elements.eventLng.value = city.koordinate_lng;
        }
    });

    elements.eventCategory.addEventListener('change', () => {
        if (elements.eventCategory.value === '__new_category') {
            addCategoryFromPrompt();
        }
    });

    elements.eventsList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }
        const selectedEvent = state.events.find((item) => item.id === button.dataset.id);
        if (button.dataset.action === 'edit' && selectedEvent) {
            fillForm(selectedEvent);
        }
        if (button.dataset.action === 'delete') {
            deleteEvent(button.dataset.id);
        }
    });

    window.addEventListener('online', () => {
        updateConnectionStatus();
        syncQueue();
    });
    window.addEventListener('offline', updateConnectionStatus);

    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (event.ctrlKey && key === 'k') {
            event.preventDefault();
            elements.searchInput.focus();
        }
        if (event.altKey && key === 'n') {
            event.preventDefault();
            resetForm();
            elements.eventName.focus();
        }
        if (event.ctrlKey && key === 's') {
            event.preventDefault();
            elements.form.requestSubmit();
        }
    });
}

async function init() {
    updateConnectionStatus();
    bindEvents();
    await registerServiceWorker();
    await loadProfile();
    await loadReferenceData();
    resetForm();
    await loadEvents();
    await subscribePush();
}

init().catch((error) => {
    notify('Napaka', error.message);
});
