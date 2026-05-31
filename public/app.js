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
    queue: 'kajdogaja_pwa_queue',
    platform: 'kajdogaja_pwa_platform'
};

const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    syncButton: document.getElementById('syncButton'),
    micButton: document.getElementById('micButton'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    categoryFilter: document.getElementById('categoryFilter'),
    cityFilter: document.getElementById('cityFilter'),
    voicePanelToggle: document.getElementById('voicePanelToggle'),
    voicePanelBody: document.getElementById('voicePanelBody'),
    voiceStatus: document.getElementById('voiceStatus'),
    voiceTranscript: document.getElementById('voiceTranscript'),
    eventsList: document.getElementById('eventsList'),
    eventCount: document.getElementById('eventCount'),
    openEventFormButton: document.getElementById('openEventFormButton'),
    eventFormOverlay: document.getElementById('eventFormOverlay'),
    closeEventFormButton: document.getElementById('closeEventFormButton'),
    cancelEventFormButton: document.getElementById('cancelEventFormButton'),
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
    platformStat: document.getElementById('platformStat'),
    organizerSearch: document.getElementById('organizerSearch'),
    organizerCapacityFilter: document.getElementById('organizerCapacityFilter'),
    pushButton: document.getElementById('pushButton'),
    pushStatus: document.getElementById('pushStatus'),
    platformSyncStatus: document.getElementById('platformSyncStatus'),
    organizerDetailOverlay: document.getElementById('organizerDetailOverlay'),
    organizerDetailTitle: document.getElementById('organizerDetailTitle'),
    organizerDetailBody: document.getElementById('organizerDetailBody'),
    profileButton: document.getElementById('profileButton'),
    profileDropdown: document.getElementById('profileDropdown'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileRole: document.getElementById('profileRole'),
    profileSince: document.getElementById('profileSince'),
    editProfileButton: document.getElementById('editProfileButton'),
    profileEditOverlay: document.getElementById('profileEditOverlay'),
    profileEditForm: document.getElementById('profileEditForm'),
    editName: document.getElementById('editName'),
    editEmail: document.getElementById('editEmail'),
    editPasswordNew: document.getElementById('editPasswordNew'),
    editPasswordCurrent: document.getElementById('editPasswordCurrent'),
    profileEditError: document.getElementById('profileEditError'),
    myRegistrationsList: document.getElementById('myRegistrationsList'),
    myRegistrationsCount: document.getElementById('myRegistrationsCount'),
    toastHost: document.getElementById('toastHost'),
    dateFromInput: document.getElementById('dateFromInput'),
    dateToInput: document.getElementById('dateToInput'),
    nearbyButton: document.getElementById('nearbyButton'),
    clearGeoButton: document.getElementById('clearGeoButton'),
    geoRadiusSelect: document.getElementById('geoRadiusSelect'),
    listViewBtn: document.getElementById('listViewBtn'),
    mapViewBtn: document.getElementById('mapViewBtn'),
    eventsMap: document.getElementById('eventsMap'),
    qrScanButton: document.getElementById('qrScanButton'),
    qrScannerOverlay: document.getElementById('qrScannerOverlay'),
    eventDetailOverlay: document.getElementById('eventDetailOverlay'),
    eventDetailTitle: document.getElementById('eventDetailTitle'),
    eventDetailBody: document.getElementById('eventDetailBody')
};

let state = {
    events: [],
    categories: [],
    cities: [],
    lazyObserver: null,
    isConnected: navigator.onLine,
    recognition: null,
    isListening: false,
    voiceSupported: false,
    pendingRegister: null,
    registeredEventIds: new Set(),
    currentUserId: null,
    currentUserRole: null,
    organizerDetailEventId: null,
    geoActive: false,
    geoLat: null,
    geoLng: null,
    geoRadius: 10,
    mapView: false,
    leafletMap: null,
    mapMarkers: [],
    qrScanner: null
};

function readStore(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
}

function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function updateStats() {
    const visibleEvents = state.currentUserRole === 'organizator' && state.currentUserId
        ? getOrganizerEvents()
        : state.events;
    elements.totalEventsStat.textContent = String(visibleEvents.length);
    elements.categoryStat.textContent = String(state.categories.length);
    elements.queueStat.textContent = String(readStore(STORE_KEYS.queue, []).length);
    updatePlatformStatus();
}

function formatDisplayDate(dateValue) {
    if (!dateValue) {
        return '';
    }

    const [year, month, day] = dateValue.split('-').map(Number);
    if (!year || !month || !day) {
        return dateValue;
    }

    return new Intl.DateTimeFormat('sl-SI', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    }).format(new Date(year, month - 1, day));
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

function setConnectionStatus(isConnected) {
    state.isConnected = isConnected;
    elements.connectionStatus.textContent = isConnected ? 'Online' : 'Offline';
    elements.connectionStatus.classList.toggle('offline', !isConnected);
    updatePlatformStatus();
}

function updateConnectionStatus() {
    setConnectionStatus(navigator.onLine);
}

function updatePlatformStatus(message) {
    const queueSize = readStore(STORE_KEYS.queue, []).length;
    const platform = readStore(STORE_KEYS.platform, {});
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    if (elements.platformStat) {
        elements.platformStat.textContent = state.isConnected ? 'Aktivna' : 'Offline';
    }
    if (elements.pushStatus) {
        elements.pushStatus.textContent = permission === 'granted'
            ? 'Sistemska obvestila so omogočena.'
            : permission === 'denied'
                ? 'Obvestila so v brskalniku zavrnjena.'
                : 'Obvestila čakajo na dovoljenje.';
    }
    if (elements.platformSyncStatus) {
        const synced = platform.last_sync ? `Zadnja sinhronizacija: ${new Date(platform.last_sync).toLocaleString('sl-SI')}` : 'Sinhronizacija še ni bila izvedena.';
        elements.platformSyncStatus.textContent = message || `${state.isConnected ? 'Online' : 'Offline'} · ${queueSize} v čakalni vrsti · ${synced}`;
    }
}

function getOrganizerEvents() {
    let events = state.events;
    if (state.currentUserRole === 'organizator' && state.currentUserId) {
        events = events.filter((event) => event.organizator_id === state.currentUserId);
    }
    const query = elements.organizerSearch?.value.trim().toLowerCase();
    if (query) {
        events = events.filter((event) =>
            [event.naziv, event.opis, event.lokacija, event.mesto?.naziv, event.kategorija?.naziv]
                .some((value) => String(value || '').toLowerCase().includes(query))
        );
    }
    if (elements.organizerCapacityFilter?.value === 'near-full') {
        events = events.filter((event) => event.kapaciteta && ((event.st_prijav || 0) / event.kapaciteta) >= 0.75);
    }
    if (elements.organizerCapacityFilter?.value === 'open') {
        events = events.filter((event) => !event.kapaciteta || (event.st_prijav || 0) < event.kapaciteta);
    }
    return events;
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    await navigator.serviceWorker.register('/sw.js');
}

async function getToken() {
    return Auth.getToken();
}

async function apiRequest(path, options = {}, retried = false) {
    const token = options.auth === false ? null : await getToken();
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method: options.method || 'GET',
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        setConnectionStatus(true);
    } catch (error) {
        setConnectionStatus(false);
        throw error;
    }

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
    const dateFrom = elements.dateFromInput?.value;
    const dateTo = elements.dateToInput?.value;
    if (dateFrom || dateTo) {
        params.set('date', `${dateFrom || dateTo},${dateTo || dateFrom}`);
    }
    if (state.geoActive && state.geoLat != null && state.geoLng != null) {
        params.set('lat', state.geoLat);
        params.set('lng', state.geoLng);
        params.set('radius', state.geoRadius);
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
        renderMap(events);
        updateStats();
        await deliverPushMessages();
    } catch (error) {
        const cached = readStore(STORE_KEYS.events, []);
        state.events = cached;
        renderEvents(cached);
        renderMap(cached);
        updateStats();
        notify('Napaka', 'Povezava ni na voljo. Prikazani so lokalno shranjeni dogodki.');
    }
}

function renderEvents(events) {
    events = state.currentUserRole === 'organizator' ? getOrganizerEvents() : events;

    elements.eventCount.textContent = `${events.length} zadetkov`;
    elements.eventsList.innerHTML = '';

    if (!events.length) {
        elements.eventsList.innerHTML = '<p class="muted">Ni najdenih dogodkov.</p>';
        return;
    }

    for (const event of events) {
        const dateLabel = getEventDateLabel(event);
        const registrations = event.st_prijav || 0;
        const capacity = event.kapaciteta || 0;
        const occupancy = capacity ? Math.min(Math.round((registrations / capacity) * 100), 100) : 0;
        const qrSrc = event.qr_koda_url || '';
        const isRegistered = state.registeredEventIds.has(event.id);
        const card = document.createElement('article');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-card-head">
                <h3>${escapeHtml(event.naziv)}</h3>
                <span class="occupancy-pill">${registrations}/${capacity || '-'}</span>
            </div>
            <p>${escapeHtml(event.opis)}</p>
            <div class="event-meta">
                <span class="chip">${escapeHtml(dateLabel)} ob ${escapeHtml(event.ura)}</span>
                <span class="chip">${escapeHtml(event.mesto?.naziv || event.mesto_id)}</span>
                <span class="chip">${escapeHtml(event.kategorija?.naziv || event.kategorija_id)}</span>
                <span class="chip">${escapeHtml(event.lokacija)}</span>
            </div>
            <div class="occupancy-meter" aria-label="Zasedenost dogodka">
                <span style="width:${occupancy}%"></span>
            </div>
            <div class="event-footer">
                <button type="button" class="qr-button" data-action="qr" data-id="${event.id}" title="Prikaži QR kodo">
                    <img class="qr-preview lazy-img" alt="QR koda dogodka" data-src="${qrSrc}">
                </button>
                <div class="event-actions">
                    <button type="button" class="ghost icon-button" data-action="registrations" data-id="${event.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Prijave
                    </button>
                    <button type="button" class="ghost icon-button" data-action="stats" data-id="${event.id}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M7 15v3M12 9v9M17 5v13"/></svg>
                        Statistika
                    </button>
                    <button type="button" data-action="edit" data-id="${event.id}">Uredi</button>
                    <button type="button" class="danger" data-action="delete" data-id="${event.id}">Izbriši</button>
                </div>
                <div class="event-register">
                    <button type="button" class="register-btn${isRegistered ? ' registered' : ''}" data-action="register" data-id="${event.id}" ${isRegistered ? 'disabled aria-disabled="true" title="Na ta dogodek si že prijavljen."' : ''}>
                        ${isRegistered ? 'Prijavljen' : 'Prijavi se'}
                    </button>
                </div>
            </div>
            <div class="event-bottom">
                <button type="button" class="ghost compact-button" data-action="detail" data-id="${event.id}">Podrobnosti</button>
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

    images.forEach((image) => {
        if (image.dataset.src) {
            state.lazyObserver.observe(image);
        }
    });
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

function openEventForm() {
    elements.eventFormOverlay.hidden = false;
    requestAnimationFrame(() => elements.eventName.focus());
}

function closeEventForm() {
    elements.eventFormOverlay.hidden = true;
}

function openNewEventForm() {
    resetForm();
    openEventForm();
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
    openEventForm();
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

function applyProfile(profile) {
    const name = profile.uporabnisko_ime || profile.email || 'Prijavljen uporabnik';
    elements.profileAvatar.textContent = name.charAt(0).toUpperCase();
    elements.profileName.textContent = name;
    elements.profileEmail.textContent = profile.email || '-';
    elements.profileRole.textContent = profile.vloga === 'organizator' ? 'Organizator' : 'Uporabnik';
    elements.profileRole.className = 'role-pill' + (profile.vloga === 'organizator' ? ' organizator' : '');
    if (profile.ustvarjen) {
        const d = new Date(profile.ustvarjen);
        elements.profileSince.textContent = 'Član od ' + d.toLocaleDateString('sl-SI', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    document.body.dataset.role = profile.vloga || 'uporabnik';
    state.currentUserId = profile.id;
    state.currentUserRole = profile.vloga || 'uporabnik';
    const isOrg = state.currentUserRole === 'organizator';
    const tabLabel = document.getElementById('prijaveTabLabel');
    if (tabLabel) tabLabel.textContent = isOrg ? 'Statistike prijav' : 'Moje prijave';
    const panelTitle = document.getElementById('prijaveTabTitle');
    if (panelTitle) panelTitle.textContent = isOrg ? 'Statistike prijav' : 'Moje prijave';
}

async function loadProfile() {
    const cached = Auth.getStoredUser();
    if (cached) applyProfile(cached);

    try {
        const profile = await apiRequest('/me');
        applyProfile(profile);
    } catch (error) {
        if (!cached) {
            elements.profileName.textContent = 'Profil ni na voljo';
            elements.profileEmail.textContent = '-';
            elements.profileRole.textContent = 'offline';
        }
    }
}

function openProfileEdit() {
    const user = Auth.getStoredUser() || {};
    elements.editName.value = user.uporabnisko_ime || '';
    elements.editEmail.value = user.email || '';
    elements.editPasswordNew.value = '';
    elements.editPasswordCurrent.value = '';
    elements.profileEditError.textContent = '';
    elements.profileDropdown.hidden = true;
    elements.profileButton.setAttribute('aria-expanded', 'false');
    elements.profileEditOverlay.hidden = false;
}

function closeProfileEdit() {
    elements.profileEditOverlay.hidden = true;
}

async function loadOrganizerStats() {
    elements.myRegistrationsList.innerHTML = '<p class="muted">Nalagam statistike ...</p>';

    const myEvents = getOrganizerEvents();

    if (!myEvents.length) {
        elements.myRegistrationsList.innerHTML = '<p class="muted">Nimate še nobenih dogodkov.</p>';
        elements.myRegistrationsCount.hidden = true;
        return;
    }

    const statsResults = await Promise.allSettled(
        myEvents.map(e => apiRequest(`/events/${e.id}/stats`))
    );

    const totalPrijav = statsResults.reduce((sum, r) => sum + (r.status === 'fulfilled' ? (r.value?.skupaj_prijav ?? 0) : 0), 0);
    elements.myRegistrationsCount.textContent = totalPrijav;
    elements.myRegistrationsCount.hidden = totalPrijav === 0;

    elements.myRegistrationsList.innerHTML = myEvents.map((event, i) => {
        const stats = statsResults[i].status === 'fulfilled' ? statsResults[i].value : null;
        const prijav = stats?.skupaj_prijav ?? event.st_prijav ?? 0;
        const kapaciteta = stats?.kapaciteta ?? event.kapaciteta;
        const pct = stats?.zasedenost_odstotek ?? (kapaciteta ? Math.round((prijav / kapaciteta) * 100) : null);
        const prosta = stats?.prostih_mest ?? (kapaciteta ? Math.max(kapaciteta - prijav, 0) : null);
        const barColor = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--gold)' : 'var(--accent)';
        const dateLabel = getEventDateLabel(event);

        return `<div class="stat-event-card">
            <div class="stat-event-info">
                <strong>${escapeHtml(event.naziv)}</strong>
                <span>${escapeHtml(dateLabel)} ob ${escapeHtml(event.ura)} · ${escapeHtml(event.lokacija)}</span>
            </div>
            <div class="stat-event-numbers">
                <div class="stat-event-bar-wrap">
                    <div class="stat-event-bar" style="width:${pct ?? 0}%;background:${barColor}"></div>
                </div>
                <div class="stat-event-row">
                    <span><strong>${prijav}</strong> / ${kapaciteta ?? '∞'} prijav</span>
                    ${pct !== null ? `<span class="stat-event-pct">${pct}%</span>` : ''}
                </div>
                ${prosta !== null ? `<span class="stat-muted">${prosta} prostih mest</span>` : ''}
            </div>
            <button class="ghost compact-button" data-action="registrations" data-id="${event.id}">Seznam</button>
        </div>`;
    }).join('');
}

function closeOrganizerDetail() {
    state.organizerDetailEventId = null;
    elements.organizerDetailOverlay.hidden = true;
    elements.organizerDetailBody.innerHTML = '';
}

async function getEventQr(event) {
    if (event.qr_koda_url) {
        return event.qr_koda_url;
    }
    const qr = await apiRequest(`/events/${event.id}/qr`, { auth: false });
    return qr.qr_koda_url || '';
}

async function openOrganizerQr(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    state.organizerDetailEventId = eventId;
    elements.organizerDetailTitle.textContent = `QR: ${event.naziv}`;
    elements.organizerDetailBody.innerHTML = '<p class="muted">Nalagam QR kodo ...</p>';
    elements.organizerDetailOverlay.hidden = false;

    try {
        const qrUrl = await getEventQr(event);
        elements.organizerDetailBody.innerHTML = `
            <div class="qr-detail">
                ${qrUrl ? `<img src="${qrUrl}" alt="QR koda za dogodek ${escapeHtml(event.naziv)}">` : '<p class="muted">QR koda za ta dogodek še ni ustvarjena.</p>'}
                <div>
                    <strong>${escapeHtml(event.naziv)}</strong>
                    <span>${escapeHtml(getEventDateLabel(event))} ob ${escapeHtml(event.ura)}</span>
                    <span>${escapeHtml(event.lokacija)}</span>
                </div>
            </div>`;
    } catch (error) {
        elements.organizerDetailBody.innerHTML = '<p class="muted">QR kode trenutno ni mogoče naložiti.</p>';
    }
}

async function loadEventRegistrations(eventId) {
    const registrations = await apiRequest(`/events/${eventId}/registrations`);
    registrations.sort((a, b) => new Date(a.ustvarjena) - new Date(b.ustvarjena));
    return registrations;
}

function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildRegistrationsCsv(event, registrations) {
    const rows = [
        ['dogodek', 'uporabnik', 'email', 'status', 'ustvarjena'],
        ...registrations.map((registration) => [
            event.naziv,
            registration.uporabnik?.uporabnisko_ime || '',
            registration.uporabnik?.email || '',
            registration.status || '',
            registration.ustvarjena ? new Date(registration.ustvarjena).toLocaleString('sl-SI') : ''
        ])
    ];
    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

async function exportRegistrations(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    try {
        const registrations = await loadEventRegistrations(eventId);
        const safeName = simplifyText(event.naziv).replace(/\s+/g, '-').slice(0, 48) || 'dogodek';
        downloadText(`prijave-${safeName}.csv`, buildRegistrationsCsv(event, registrations));
        toast('CSV izvoz je pripravljen.');
    } catch (error) {
        notify('Napaka', error.message);
    }
}

async function openEventRegistrations(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    state.organizerDetailEventId = eventId;
    elements.organizerDetailTitle.textContent = `Prijave: ${event.naziv}`;
    elements.organizerDetailBody.innerHTML = '<p class="muted">Nalagam prijavljene uporabnike ...</p>';
    elements.organizerDetailOverlay.hidden = false;

    try {
        const registrations = await loadEventRegistrations(eventId);
        elements.organizerDetailBody.innerHTML = `
            <div class="modal-toolbar">
                <span class="muted">${registrations.length} prijav</span>
                <button type="button" class="ghost icon-button" data-export-registrations="${eventId}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
                    CSV izvoz
                </button>
            </div>
            <div class="attendees-list">
                ${registrations.length ? registrations.map((registration) => `
                    <div class="attendee-row">
                        <div class="attendee-avatar">${escapeHtml((registration.uporabnik?.uporabnisko_ime || '?').charAt(0).toUpperCase())}</div>
                        <div>
                            <strong>${escapeHtml(registration.uporabnik?.uporabnisko_ime || 'Uporabnik')}</strong>
                            <span>${escapeHtml(registration.uporabnik?.email || '-')}</span>
                        </div>
                        <span class="chip">${escapeHtml(registration.status || 'potrjena')}</span>
                    </div>
                `).join('') : '<p class="muted">Na dogodek še ni prijav.</p>'}
            </div>`;
    } catch (error) {
        elements.organizerDetailBody.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    }
}

async function openEventStats(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    state.organizerDetailEventId = eventId;
    elements.organizerDetailTitle.textContent = `Statistika: ${event.naziv}`;
    elements.organizerDetailBody.innerHTML = '<p class="muted">Nalagam statistiko ...</p>';
    elements.organizerDetailOverlay.hidden = false;

    try {
        const stats = await apiRequest(`/events/${eventId}/stats`);
        const pct = stats.zasedenost_odstotek ?? 0;
        elements.organizerDetailBody.innerHTML = `
            <div class="stats-detail-grid">
                <div><span>Prijave</span><strong>${stats.skupaj_prijav}</strong></div>
                <div><span>Kapaciteta</span><strong>${stats.kapaciteta ?? '∞'}</strong></div>
                <div><span>Prosto</span><strong>${stats.prostih_mest ?? '∞'}</strong></div>
                <div><span>Zasedenost</span><strong>${pct}%</strong></div>
            </div>
            <div class="stat-event-bar-wrap large"><div class="stat-event-bar" style="width:${pct}%;"></div></div>
            <div class="daily-bars">
                ${(stats.prijave_po_dnevih || []).length ? stats.prijave_po_dnevih.map((item) => `
                    <div class="daily-row">
                        <span>${escapeHtml(formatDisplayDate(item.datum))}</span>
                        <strong>${item.stevilo}</strong>
                    </div>
                `).join('') : '<p class="muted">Za ta dogodek še ni dnevne statistike prijav.</p>'}
            </div>`;
    } catch (error) {
        elements.organizerDetailBody.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    }
}

async function loadMyRegistrations() {
    if (state.currentUserRole === 'organizator') {
        return loadOrganizerStats();
    }

    try {
        const registrations = await apiRequest('/me/registrations');
        state.registeredEventIds = new Set(registrations.map((reg) => reg.dogodek?.id).filter(Boolean));
        elements.myRegistrationsCount.textContent = registrations.length;
        elements.myRegistrationsCount.hidden = registrations.length === 0;
        renderEvents(state.events);

        if (registrations.length === 0) {
            elements.myRegistrationsList.innerHTML = '<p class="muted">Nisi prijavljen na noben dogodek.</p>';
            return;
        }

        elements.myRegistrationsList.innerHTML = registrations.map(reg => {
            const e = reg.dogodek;
            const date = getEventDateLabel(e);
            return `<div class="registration-card">
                <div class="registration-info">
                    <strong>${escapeHtml(e.naziv)}</strong>
                    <span>${escapeHtml(date)} · ${escapeHtml(e.mesto?.naziv || '-')} · ${escapeHtml(e.kategorija?.naziv || '-')}</span>
                </div>
                <button class="ghost icon-button" data-unregister="${e.id}" title="Odjavi se">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    Odjavi se
                </button>
            </div>`;
        }).join('');
    } catch {
        elements.myRegistrationsList.innerHTML = '<p class="muted">Napaka pri nalaganju prijav.</p>';
    }
}

async function loadNotifications() {
    const list = document.getElementById('notificationsList');
    const countEl = document.getElementById('notificationsCount');
    try {
        const notifications = await apiRequest('/notifications');
        const unread = notifications.filter(n => !n.prebrano).length;
        countEl.textContent = unread;
        countEl.hidden = unread === 0;

        if (notifications.length === 0) {
            list.innerHTML = '<p class="muted">Nimaš obvestil.</p>';
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="notification-card${n.prebrano ? '' : ' unread'}" data-id="${n.id}">
                <div class="notification-info">
                    <strong>${escapeHtml(n.naslov || n.tip || 'Obvestilo')}</strong>
                    <span>${escapeHtml(n.sporocilo || n.vsebina || '')}</span>
                    <span class="notification-time">${new Date(n.ustvarjeno).toLocaleString('sl-SI')}</span>
                </div>
                <div class="notification-actions">
                    ${!n.prebrano ? `<button class="ghost compact-button" data-read="${n.id}" title="Označi kot prebrano">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><path d="M20 6 9 17l-5-5"/></svg>
                    </button>` : ''}
                    <button class="ghost compact-button" data-delete-notif="${n.id}" title="Izbriši" style="color:var(--danger)">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>`).join('');
    } catch {
        list.innerHTML = '<p class="muted">Napaka pri nalaganju obvestil.</p>';
    }
}

function showRegisterConfirm(eventId, btn) {
    if (state.registeredEventIds.has(eventId)) {
        toast('Na ta dogodek si že prijavljen.');
        return;
    }

    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    const dateLabel = getEventDateLabel(event);
    document.getElementById('registerConfirmDetails').innerHTML = `
        <strong>${event.naziv}</strong>
        <span>${dateLabel} ob ${event.ura}</span>
        <span>${event.lokacija} · ${event.mesto?.naziv || ''} · ${event.kategorija?.naziv || ''}</span>
    `;
    state.pendingRegister = { eventId, btn };
    document.getElementById('registerConfirmOverlay').hidden = false;
}

async function registerForEvent(eventId, btn) {
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        await apiRequest(`/events/${eventId}/registrations`, { method: 'POST' });
        notify('Prijava uspešna', 'Uspešno si se prijavil na dogodek.');
        state.registeredEventIds.add(eventId);
        btn.textContent = 'Prijavljen ✓';
        btn.classList.add('registered');
        btn.disabled = true;
        await loadMyRegistrations();
        await loadEvents();
    } catch (err) {
        notify('Napaka', err.message, 'error');
        btn.disabled = false;
        btn.textContent = prev;
    }
}

async function unregisterFromEvent(eventId) {
    try {
        await apiRequest(`/events/${eventId}/registrations`, { method: 'DELETE' });
        notify('Odjava uspešna', 'Uspešno si se odjavil od dogodka.');
        state.registeredEventIds.delete(eventId);
        await loadMyRegistrations();
        await loadEvents();
    } catch (error) {
        notify('Napaka', error.message, 'error');
    }
}

function setVoiceStatus(message, isListening = false) {
    elements.voiceStatus.textContent = message;
    elements.micButton.classList.toggle('listening', isListening);
    elements.micButton.setAttribute('aria-pressed', String(isListening));
}

function setVoiceTranscript(message) {
    elements.voiceTranscript.textContent = message || '-';
}

function simplifyText(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function speak(message) {
    if (!('speechSynthesis' in window) || !message) {
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'sl-SI';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
}

function getEventDateLabel(event) {
    return event.datum_do && event.datum_do !== event.datum
        ? `${formatDisplayDate(event.datum)} do ${formatDisplayDate(event.datum_do)}`
        : formatDisplayDate(event.datum);
}

function describeEvent(event) {
    return `${event.naziv}. ${event.opis}. Datum ${getEventDateLabel(event)} ob ${event.ura}. Lokacija ${event.lokacija}, ${event.mesto?.naziv || ''}.`;
}

function findByNormalizedName(items, phrase) {
    const normalizedPhrase = simplifyText(phrase);
    return items.find((item) => {
        const normalizedName = simplifyText(item.naziv);
        return normalizedName.includes(normalizedPhrase) || normalizedPhrase.includes(normalizedName);
    });
}

function getRelativeDate(offsetDays) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

async function applySearch(query) {
    elements.searchInput.value = query;
    await loadEvents();
}

async function applyCategoryFilter(name) {
    const category = findByNormalizedName(state.categories, name);
    if (!category) {
        throw new Error(`Kategorije ${name} nisem našel.`);
    }
    elements.categoryFilter.value = category.id;
    await loadEvents();
    return category;
}

async function applyCityFilter(name) {
    const city = findByNormalizedName(state.cities, name);
    if (!city) {
        throw new Error(`Mesta ${name} nisem našel.`);
    }
    elements.cityFilter.value = city.id;
    await loadEvents();
    return city;
}

function findEventByPhrase(phrase) {
    const normalizedPhrase = simplifyText(phrase);
    return state.events.find((event) => {
        const normalizedName = simplifyText(event.naziv);
        return normalizedName.includes(normalizedPhrase) || normalizedPhrase.includes(normalizedName);
    });
}

function findEventsByDate(dateValue) {
    return state.events.filter((event) => {
        const eventStart = event.datum;
        const eventEnd = event.datum_do || event.datum;
        return dateValue >= eventStart && dateValue <= eventEnd;
    });
}

async function runVoiceCommand(transcript) {
    const normalized = simplifyText(transcript);
    setVoiceTranscript(transcript);

    if (!normalized) {
        speak('Ukaza nisem slišal dovolj jasno.');
        setVoiceStatus('Ukaza nisem prepoznal.');
        return;
    }

    try {
        if (normalized.startsWith('isci ')) {
            const query = transcript.slice(transcript.toLowerCase().indexOf(' ') + 1).trim();
            await applySearch(query);
            speak(`Iščem ${query}.`);
            setVoiceStatus(`Izveden ukaz: išči ${query}.`);
            return;
        }

        if (normalized === 'pocisti iskanje') {
            elements.searchInput.value = '';
            await loadEvents();
            speak('Iskanje je počiščeno.');
            setVoiceStatus('Iskanje je počiščeno.');
            return;
        }

        if (normalized === 'pocisti kategorije') {
            elements.categoryFilter.value = '';
            await loadEvents();
            speak('Filter kategorije je počiščen.');
            setVoiceStatus('Filter kategorije je počiščen.');
            return;
        }

        if (normalized.startsWith('nastavi naziv ')) {
            const value = transcript.slice(transcript.toLowerCase().indexOf('naziv') + 'naziv'.length).trim();
            if (!value) {
                throw new Error('Naziv ni bil podan.');
            }
            if (elements.eventFormOverlay.hidden) {
                openNewEventForm();
            }
            elements.eventName.value = value;
            elements.eventName.focus();
            speak(`Naziv je nastavljen na ${value}.`);
            setVoiceStatus(`Naziv obrazca: ${value}.`);
            return;
        }

        if (normalized === 'nov dogodek') {
            openNewEventForm();
            speak('Obrazec za nov dogodek je pripravljen.');
            setVoiceStatus('Obrazec je pripravljen za nov dogodek.');
            return;
        }

        if (normalized === 'pocisti obrazec') {
            resetForm();
            speak('Obrazec je počiščen.');
            setVoiceStatus('Obrazec je počiščen.');
            return;
        }

        if (normalized === 'shrani dogodek') {
            elements.form.requestSubmit();
            speak('Shranjujem dogodek.');
            setVoiceStatus('Pošiljam obrazec za shranjevanje.');
            return;
        }

        if (normalized.startsWith('filtriraj kategorijo ')) {
            const name = transcript.slice(transcript.toLowerCase().indexOf('kategorijo') + 'kategorijo'.length).trim();
            const category = await applyCategoryFilter(name);
            speak(`Filter kategorije je nastavljen na ${category.naziv}.`);
            setVoiceStatus(`Aktivna kategorija: ${category.naziv}.`);
            return;
        }

        if (normalized.startsWith('filtriraj mesto ')) {
            const name = transcript.slice(transcript.toLowerCase().indexOf('mesto') + 'mesto'.length).trim();
            const city = await applyCityFilter(name);
            speak(`Filter mesta je nastavljen na ${city.naziv}.`);
            setVoiceStatus(`Aktivno mesto: ${city.naziv}.`);
            return;
        }

        if (normalized === 'preberi prvi dogodek') {
            if (!state.events.length) {
                throw new Error('Trenutno ni dogodkov za branje.');
            }
            const firstEvent = state.events[0];
            speak(describeEvent(firstEvent));
            setVoiceStatus(`Berem dogodek: ${firstEvent.naziv}.`);
            return;
        }

        if (normalized === 'preberi dogodke danes' || normalized === 'preberi dogodek danes') {
            const todayEvents = findEventsByDate(getRelativeDate(0));
            if (!todayEvents.length) {
                throw new Error('Danes ni dogodkov v trenutnem seznamu.');
            }
            const event = todayEvents[0];
            speak(`Danes je na voljo ${todayEvents.length} dogodkov. ${describeEvent(event)}`);
            setVoiceStatus(`Prebran današnji dogodek: ${event.naziv}.`);
            return;
        }

        if (normalized === 'preberi dogodke jutri' || normalized === 'preberi dogodek jutri') {
            const tomorrowEvents = findEventsByDate(getRelativeDate(1));
            if (!tomorrowEvents.length) {
                throw new Error('Jutri ni dogodkov v trenutnem seznamu.');
            }
            const event = tomorrowEvents[0];
            speak(`Jutri je na voljo ${tomorrowEvents.length} dogodkov. ${describeEvent(event)}`);
            setVoiceStatus(`Prebran jutrišnji dogodek: ${event.naziv}.`);
            return;
        }

        if (normalized.startsWith('preberi dogodek ')) {
            const phrase = transcript.slice(transcript.toLowerCase().indexOf('dogodek') + 'dogodek'.length).trim();
            const event = findEventByPhrase(phrase);
            if (!event) {
                throw new Error(`Dogodka ${phrase} nisem našel.`);
            }
            speak(describeEvent(event));
            setVoiceStatus(`Berem dogodek: ${event.naziv}.`);
            return;
        }

        if (normalized === 'sinhroniziraj') {
            await syncQueue();
            speak('Sinhronizacija je zagnana.');
            setVoiceStatus('Sinhronizacija je zagnana.');
            return;
        }

        speak('Ukaz ni podprt.');
        setVoiceStatus('Ukaz ni podprt.');
    } catch (error) {
        speak(error.message);
        setVoiceStatus(error.message);
    }
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supportsSpeechOutput = 'speechSynthesis' in window;
    if (!SpeechRecognition || !supportsSpeechOutput) {
        elements.micButton.disabled = true;
        state.voiceSupported = false;
        setVoiceStatus('Brskalnik ne podpira glasovnih ukazov.');
        setVoiceTranscript('Uporabi Chromium brskalnik za test mikrofona.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sl-SI';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener('start', () => {
        state.isListening = true;
        setVoiceStatus('Poslušam ...', true);
    });

    recognition.addEventListener('result', (event) => {
        const transcript = event.results[0][0].transcript.trim();
        runVoiceCommand(transcript);
    });

    recognition.addEventListener('error', (event) => {
        state.isListening = false;
        setVoiceStatus(`Napaka mikrofona: ${event.error}.`);
        if (event.error !== 'no-speech') {
            speak('Pri uporabi mikrofona je prišlo do napake.');
        }
    });

    recognition.addEventListener('end', () => {
        state.isListening = false;
        if (!elements.voiceStatus.textContent.includes('Berem') && !elements.voiceStatus.textContent.includes('Izveden') && !elements.voiceStatus.textContent.includes('Aktivn')) {
            setVoiceStatus('Mikrofon je pripravljen.');
        } else {
            elements.micButton.classList.remove('listening');
            elements.micButton.setAttribute('aria-pressed', 'false');
        }
    });

    state.recognition = recognition;
    state.voiceSupported = true;
    setVoiceStatus('Mikrofon je pripravljen.');
}

function toggleVoiceRecognition() {
    if (!state.voiceSupported || !state.recognition) {
        setVoiceStatus('Glasovni ukazi niso na voljo.');
        return;
    }

    if (state.isListening) {
        state.recognition.stop();
        setVoiceStatus('Poslušanje je ustavljeno.');
        return;
    }

    setVoiceTranscript('Čakam na glasovni ukaz ...');
    state.recognition.start();
}

function toggleVoicePanel() {
    const shouldOpen = elements.voicePanelBody.classList.contains('collapsed');
    elements.voicePanelToggle.setAttribute('aria-expanded', String(shouldOpen));
    elements.voicePanelBody.setAttribute('aria-hidden', String(!shouldOpen));

    if (shouldOpen) {
        elements.voicePanelBody.classList.remove('collapsed');
        elements.voicePanelBody.style.maxHeight = `${elements.voicePanelBody.scrollHeight}px`;
        return;
    }

    elements.voicePanelBody.style.maxHeight = `${elements.voicePanelBody.scrollHeight}px`;
    requestAnimationFrame(() => {
        elements.voicePanelBody.classList.add('collapsed');
        elements.voicePanelBody.style.maxHeight = '0px';
    });
}

function syncVoicePanelHeight() {
    if (!elements.voicePanelBody.classList.contains('collapsed')) {
        elements.voicePanelBody.style.maxHeight = `${elements.voicePanelBody.scrollHeight}px`;
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
        closeEventForm();
        await loadEvents();
    } catch (error) {
        enqueueOperation(operation);
        closeEventForm();
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
        updatePlatformStatus();
        return;
    }

    updatePlatformStatus(`Sinhroniziram ${queue.length} sprememb ...`);
    const remaining = [];
    for (const operation of queue) {
        try {
            await apiRequest(operation.path, { method: operation.method, body: operation.body });
        } catch (error) {
            remaining.push(operation);
        }
    }

    writeStore(STORE_KEYS.queue, remaining);
    writeStore(STORE_KEYS.platform, { ...readStore(STORE_KEYS.platform, {}), last_sync: new Date().toISOString() });
    updateStats();
    if (remaining.length) {
        await notify('Napaka', 'Nekaterih sprememb ni bilo mogoče sinhronizirati.');
    } else {
        await notify('Sinhronizirano', 'Vse lokalne spremembe so poslane na strežnik.');
        await loadEvents();
    }
}

async function subscribePush() {
    if (!('Notification' in window)) {
        updatePlatformStatus('Brskalnik ne podpira sistemskih obvestil.');
        return;
    }

    try {
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        if (Notification.permission !== 'granted') {
            updatePlatformStatus();
            return;
        }
        const registration = await navigator.serviceWorker?.ready;
        const platform = readStore(STORE_KEYS.platform, {});
        const endpoint = platform.push_endpoint || (registration ? `local-sw-${crypto.randomUUID?.() || Date.now()}` : `local-page-${Date.now()}`);
        await apiRequest('/push/subscribe', {
            method: 'POST',
            body: { endpoint, keys: { mode: 'local-demo' } }
        });
        writeStore(STORE_KEYS.platform, { ...platform, push_endpoint: endpoint, push_subscribed_at: new Date().toISOString() });
        updatePlatformStatus('Push naročnina je aktivna.');
    } catch (error) {
        toast('Naročanje na push obvestila ni uspelo.', 'error');
        updatePlatformStatus();
    }
}

async function sendPushDemo() {
    try {
        await subscribePush();
        await apiRequest('/push/send', {
            method: 'POST',
            body: { title: 'KajDogaja', body: 'Testno obvestilo za organizatorsko predstavitev.', url: '/pwa' }
        });
        await deliverPushMessages();
    } catch (error) {
        notify('Napaka', error.message);
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
        updatePlatformStatus(`${messages.length} push sporočil je prevzetih.`);
    } catch (error) {
    }
}

// ── Clan 3: geolokacija ───────────────────────────────────────────────────

async function activateGeolocation() {
    if (!('geolocation' in navigator)) {
        toast('Brskalnik ne podpira geolokacije.', 'error');
        return;
    }
    const label = document.getElementById('nearbyLabel');
    elements.nearbyButton.disabled = true;
    if (label) label.textContent = 'Pridobivam lokacijo ...';

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            state.geoActive = true;
            state.geoLat = pos.coords.latitude;
            state.geoLng = pos.coords.longitude;
            state.geoRadius = Number(elements.geoRadiusSelect?.value || 10);
            elements.nearbyButton.disabled = false;
            elements.nearbyButton.classList.add('geo-active');
            if (label) label.textContent = 'V bližini aktiven';
            if (elements.clearGeoButton) elements.clearGeoButton.hidden = false;
            await loadEvents();
        },
        (err) => {
            elements.nearbyButton.disabled = false;
            if (label) label.textContent = 'Dogodki v bližini';
            const msg = err.code === 1
                ? 'Dostop do lokacije je bil zavrnjen.'
                : 'Geolokacija ni uspela.';
            toast(msg, 'error');
        },
        { timeout: 10000, enableHighAccuracy: false }
    );
}

function deactivateGeolocation() {
    state.geoActive = false;
    state.geoLat = null;
    state.geoLng = null;
    elements.nearbyButton.classList.remove('geo-active');
    if (elements.clearGeoButton) elements.clearGeoButton.hidden = true;
    const label = document.getElementById('nearbyLabel');
    if (label) label.textContent = 'Dogodki v bližini';
    loadEvents();
}

// ── Clan 3: podrobnosti dogodka ───────────────────────────────────────────

async function openEventDetail(eventId) {
    let ev = state.events.find((e) => e.id === eventId);
    if (!ev) {
        try {
            ev = await apiRequest(`/events/${eventId}`, { auth: false });
        } catch {
            toast('Dogodek ni najden.', 'error');
            return;
        }
    }
    renderEventDetail(ev);
}

function renderEventDetail(ev) {
    const dateLabel = getEventDateLabel(ev);
    const registrations = ev.st_prijav || 0;
    const capacity = ev.kapaciteta || 0;
    const occupancy = capacity ? Math.min(Math.round((registrations / capacity) * 100), 100) : 0;

    elements.eventDetailTitle.textContent = ev.naziv;
    elements.eventDetailBody.innerHTML = `
        <p class="event-detail-desc">${escapeHtml(ev.opis)}</p>
        <div class="event-detail-chips">
            <span class="chip">${escapeHtml(dateLabel)} ob ${escapeHtml(ev.ura)}</span>
            <span class="chip">${escapeHtml(ev.lokacija)}</span>
            <span class="chip">${escapeHtml(ev.mesto?.naziv || '')}</span>
            <span class="chip">${escapeHtml(ev.kategorija?.naziv || '')}</span>
            ${capacity ? `<span class="chip">${registrations}/${capacity} prijav</span>` : ''}
        </div>
        ${capacity ? `<div class="occupancy-meter" style="margin-bottom:12px;"><span style="width:${occupancy}%"></span></div>` : ''}
        ${ev.organizator ? `<p class="muted" style="font-size:0.85rem;margin-bottom:8px;">Organizator: <strong style="color:var(--text)">${escapeHtml(ev.organizator.uporabnisko_ime || ev.organizator.email || '-')}</strong></p>` : ''}
        <div class="event-detail-actions"></div>
    `;

    const actionsEl = elements.eventDetailBody.querySelector('.event-detail-actions');

    if (state.currentUserRole !== 'organizator') {
        const btn = document.createElement('button');
        btn.className = 'icon-button';
        btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Prijavi se`;
        btn.addEventListener('click', () => {
            const dummyBtn = document.createElement('button');
            dummyBtn.textContent = 'Prijavi se';
            closeEventDetail();
            showRegisterConfirm(ev.id, dummyBtn);
        });
        actionsEl.append(btn);
    }

    if (state.currentUserRole === 'organizator' && ev.organizator_id === state.currentUserId) {
        [
            ['QR koda', () => { closeEventDetail(); openOrganizerQr(ev.id); }],
            ['Prijave', () => { closeEventDetail(); openEventRegistrations(ev.id); }],
            ['Statistika', () => { closeEventDetail(); openEventStats(ev.id); }],
        ].forEach(([label, fn]) => {
            const btn = document.createElement('button');
            btn.className = 'ghost icon-button';
            btn.textContent = label;
            btn.addEventListener('click', fn);
            actionsEl.append(btn);
        });
    }

    elements.eventDetailOverlay.hidden = false;
}

function closeEventDetail() {
    elements.eventDetailOverlay.hidden = true;
    elements.eventDetailBody.innerHTML = '';
}

// ── Clan 3: Leaflet mapa ──────────────────────────────────────────────────

function initLeafletMap() {
    if (state.leafletMap || typeof L === 'undefined') return;
    state.leafletMap = L.map('eventsMap').setView([46.1, 14.8], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(state.leafletMap);
}

function renderMap(events) {
    if (!state.mapView || typeof L === 'undefined') return;
    initLeafletMap();
    if (!state.leafletMap) return;

    state.mapMarkers.forEach((m) => m.remove());
    state.mapMarkers = [];

    const valid = events.filter((e) => e.koordinate_lat != null && e.koordinate_lng != null);
    if (!valid.length) return;

    const bounds = [];
    for (const ev of valid) {
        const marker = L.marker([ev.koordinate_lat, ev.koordinate_lng])
            .addTo(state.leafletMap)
            .bindPopup(`<strong>${escapeHtml(ev.naziv)}</strong><br>${escapeHtml(getEventDateLabel(ev))} ob ${escapeHtml(ev.ura)}<br>${escapeHtml(ev.lokacija)}`);
        marker.on('click', () => openEventDetail(ev.id));
        state.mapMarkers.push(marker);
        bounds.push([ev.koordinate_lat, ev.koordinate_lng]);
    }

    if (state.geoActive && state.geoLat != null) {
        state.leafletMap.setView([state.geoLat, state.geoLng], 12);
    } else if (bounds.length) {
        state.leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
}

function switchToMapView() {
    state.mapView = true;
    elements.eventsMap.hidden = false;
    elements.eventsList.style.display = 'none';
    elements.listViewBtn.classList.remove('active');
    elements.mapViewBtn.classList.add('active');
    requestAnimationFrame(() => {
        initLeafletMap();
        if (state.leafletMap) state.leafletMap.invalidateSize();
        renderMap(state.events);
    });
}

function switchToListView() {
    state.mapView = false;
    elements.eventsMap.hidden = true;
    elements.eventsList.style.display = '';
    elements.listViewBtn.classList.add('active');
    elements.mapViewBtn.classList.remove('active');
}

// ── Clan 3: QR skeniranje ─────────────────────────────────────────────────

async function openQrScanner() {
    if (typeof Html5Qrcode === 'undefined') {
        toast('QR skeniranje ni na voljo.', 'error');
        return;
    }
    elements.qrScannerOverlay.hidden = false;
    document.getElementById('qrScannerContainer').innerHTML = '';
    state.qrScanner = new Html5Qrcode('qrScannerContainer');
    try {
        await state.qrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decoded) => handleQrScan(decoded),
            () => {}
        );
    } catch {
        toast('Kamera ni dostopna. Preverite dovoljenja brskalnika.', 'error');
        await closeQrScanner();
    }
}

async function closeQrScanner() {
    if (state.qrScanner) {
        await state.qrScanner.stop().catch(() => {});
        state.qrScanner = null;
    }
    if (elements.qrScannerOverlay) elements.qrScannerOverlay.hidden = true;
}

async function handleQrScan(decoded) {
    await closeQrScanner();
    const match = decoded.match(/\/events\/([^/?&#\s]+)/);
    if (!match) {
        toast('QR koda ne vsebuje podatkov o dogodku.', 'error');
        return;
    }
    await openEventDetail(match[1]);
}

function bindEvents() {
    elements.searchButton.addEventListener('click', loadEvents);
    elements.micButton.addEventListener('click', toggleVoiceRecognition);
    elements.voicePanelToggle.addEventListener('click', toggleVoicePanel);
    elements.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadEvents();
        }
    });
    elements.categoryFilter.addEventListener('change', loadEvents);
    elements.cityFilter.addEventListener('change', loadEvents);
    elements.resetFormButton.addEventListener('click', resetForm);
    elements.openEventFormButton?.addEventListener('click', openNewEventForm);
    elements.closeEventFormButton?.addEventListener('click', closeEventForm);
    elements.cancelEventFormButton?.addEventListener('click', closeEventForm);
    elements.eventFormOverlay?.addEventListener('click', (event) => {
        if (event.target === elements.eventFormOverlay) closeEventForm();
    });
    elements.syncButton.addEventListener('click', syncQueue);
    elements.organizerSearch?.addEventListener('input', () => {
        renderEvents(state.events);
        if (state.currentUserRole === 'organizator') loadMyRegistrations();
    });
    elements.organizerCapacityFilter?.addEventListener('change', () => {
        renderEvents(state.events);
        if (state.currentUserRole === 'organizator') loadMyRegistrations();
    });

    // Clan 3: datum filter
    elements.dateFromInput?.addEventListener('change', loadEvents);
    elements.dateToInput?.addEventListener('change', loadEvents);

    // Clan 3: geolokacija
    elements.nearbyButton?.addEventListener('click', activateGeolocation);
    elements.clearGeoButton?.addEventListener('click', deactivateGeolocation);
    elements.geoRadiusSelect?.addEventListener('change', () => {
        if (state.geoActive) {
            state.geoRadius = Number(elements.geoRadiusSelect.value);
            loadEvents();
        }
    });

    // Clan 3: seznam / mapa
    elements.listViewBtn?.addEventListener('click', switchToListView);
    elements.mapViewBtn?.addEventListener('click', switchToMapView);

    // Clan 3: QR skener
    elements.qrScanButton?.addEventListener('click', openQrScanner);
    document.getElementById('closeQrScanner')?.addEventListener('click', closeQrScanner);
    elements.qrScannerOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.qrScannerOverlay) closeQrScanner();
    });

    // Clan 3: detail modal
    document.getElementById('closeEventDetail')?.addEventListener('click', closeEventDetail);
    elements.eventDetailOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.eventDetailOverlay) closeEventDetail();
    });

    elements.pushButton?.addEventListener('click', sendPushDemo);
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

    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => { c.hidden = true; });
            const id = 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
            document.getElementById(id).hidden = false;
            if (tab === 'prijave') loadMyRegistrations();
            if (tab === 'obvestila') loadNotifications();
        });
    });

    elements.editProfileButton.addEventListener('click', openProfileEdit);
    document.getElementById('closeProfileEdit').addEventListener('click', closeProfileEdit);
    document.getElementById('cancelProfileEdit').addEventListener('click', closeProfileEdit);

    elements.profileEditOverlay.addEventListener('click', (e) => {
        if (e.target === elements.profileEditOverlay) closeProfileEdit();
    });

    elements.profileEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {};
        const newName = elements.editName.value.trim();
        const newEmail = elements.editEmail.value.trim();
        const newPass = elements.editPasswordNew.value;
        const curPass = elements.editPasswordCurrent.value;

        if (newName) body.uporabnisko_ime = newName;
        if (newEmail) body.email = newEmail;
        if (newPass) { body.geslo_novo = newPass; body.geslo_trenutno = curPass; }

        if (!Object.keys(body).length) { closeProfileEdit(); return; }

        const btn = document.getElementById('saveProfileEdit');
        elements.profileEditError.textContent = '';
        btn.disabled = true;

        try {
            const updated = await apiRequest('/me', { method: 'PUT', body });
            localStorage.setItem('kajdogaja_auth_user', JSON.stringify(updated));
            applyProfile(updated);
            closeProfileEdit();
            notify('Profil posodobljen', 'Podatki so bili uspešno shranjeni.');
        } catch (err) {
            elements.profileEditError.textContent = err.message;
        } finally {
            btn.disabled = false;
        }
    });

    elements.myRegistrationsList.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-unregister]');
        if (btn) await unregisterFromEvent(btn.dataset.unregister);
        const actionBtn = e.target.closest('button[data-action]');
        if (!actionBtn) return;
        if (actionBtn.dataset.action === 'registrations') await openEventRegistrations(actionBtn.dataset.id);
    });

    document.getElementById('closeOrganizerDetail')?.addEventListener('click', closeOrganizerDetail);
    elements.organizerDetailOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.organizerDetailOverlay) closeOrganizerDetail();
    });
    elements.organizerDetailBody?.addEventListener('click', async (e) => {
        const exportBtn = e.target.closest('[data-export-registrations]');
        if (exportBtn) await exportRegistrations(exportBtn.dataset.exportRegistrations);
    });

    document.getElementById('notificationsList').addEventListener('click', async (e) => {
        const readBtn = e.target.closest('[data-read]');
        if (readBtn) {
            await apiRequest(`/notifications/${readBtn.dataset.read}/read`, { method: 'PUT' }).catch(() => { });
            await loadNotifications();
            return;
        }
        const delBtn = e.target.closest('[data-delete-notif]');
        if (delBtn) {
            await apiRequest(`/notifications/${delBtn.dataset.deleteNotif}`, { method: 'DELETE' }).catch(() => { });
            await loadNotifications();
        }
    });

    document.getElementById('markAllReadButton').addEventListener('click', async () => {
        const items = document.querySelectorAll('[data-read]');
        await Promise.all([...items].map(b => apiRequest(`/notifications/${b.dataset.read}/read`, { method: 'PUT' }).catch(() => { })));
        await loadNotifications();
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
        if (button.dataset.action === 'qr') {
            openOrganizerQr(button.dataset.id);
        }
        if (button.dataset.action === 'registrations') {
            openEventRegistrations(button.dataset.id);
        }
        if (button.dataset.action === 'stats') {
            openEventStats(button.dataset.id);
        }
        if (button.dataset.action === 'register') {
            showRegisterConfirm(button.dataset.id, button);
        }
        if (button.dataset.action === 'detail') {
            openEventDetail(button.dataset.id);
        }
    });

    const closeRegisterConfirm = () => {
        document.getElementById('registerConfirmOverlay').hidden = true;
        state.pendingRegister = null;
    };

    document.getElementById('closeRegisterConfirm').addEventListener('click', closeRegisterConfirm);
    document.getElementById('cancelRegisterConfirm').addEventListener('click', closeRegisterConfirm);
    document.getElementById('registerConfirmOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('registerConfirmOverlay')) closeRegisterConfirm();
    });

    document.getElementById('confirmRegisterBtn').addEventListener('click', async () => {
        const pending = state.pendingRegister;
        closeRegisterConfirm();
        if (pending) await registerForEvent(pending.eventId, pending.btn);
    });

    window.addEventListener('online', () => {
        setConnectionStatus(true);
        syncQueue();
    });
    window.addEventListener('offline', () => setConnectionStatus(false));
    window.addEventListener('resize', syncVoicePanelHeight);

    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (event.ctrlKey && key === 'k') {
            event.preventDefault();
            elements.searchInput.focus();
        }
        if (event.altKey && key === 'n') {
            event.preventDefault();
            openNewEventForm();
        }
        if (event.ctrlKey && key === 's') {
            event.preventDefault();
            if (!elements.eventFormOverlay.hidden) {
                elements.form.requestSubmit();
            }
        }
        if (key === 'escape') {
            closeEventForm();
            closeOrganizerDetail();
            closeEventDetail();
            closeQrScanner();
        }
    });
}

async function initApp() {
    updateConnectionStatus();
    setupVoiceRecognition();
    bindEvents();
    await registerServiceWorker();
    await loadProfile();
    await loadReferenceData();
    resetForm();
    await loadEvents();
    await loadMyRegistrations();
    await loadNotifications();
    updatePlatformStatus();
    syncVoicePanelHeight();
}

async function init() {
    Auth.bindAuthEvents();
    await Auth.checkAuth(initApp);
}

init().catch((error) => {
    notify('Napaka', error.message);
});
