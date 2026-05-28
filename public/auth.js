(function () {
    'use strict';

    const API = '/api';
    const OAUTH_CLIENT = {
        client_id: 'kajdogaja-test-client',
        client_secret: 'kajdogaja-test-secret'
    };
    const TOKEN_KEY = 'kajdogaja_pwa_token';
    const USER_KEY = 'kajdogaja_auth_user';

    function readToken() {
        const raw = localStorage.getItem(TOKEN_KEY);
        return raw ? JSON.parse(raw) : null;
    }

    function writeToken(data) {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
    }

    function readUser() {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    }

    function writeUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearAuth() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function getValidAccessToken() {
        const token = readToken();
        if (!token) return null;
        if (new Date(token.expires_at).getTime() - Date.now() > 30000) {
            return token.access_token;
        }
        return null;
    }

    async function tryRefreshToken() {
        const token = readToken();
        if (!token || !token.refresh_token) return null;
        try {
            const res = await fetch(`${API}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    client_id: OAUTH_CLIENT.client_id,
                    client_secret: OAUTH_CLIENT.client_secret,
                    refresh_token: token.refresh_token
                })
            });
            if (!res.ok) return null;
            const fresh = await res.json();
            fresh.expires_at = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
            writeToken(fresh);
            return fresh.access_token;
        } catch {
            return null;
        }
    }

    async function getToken() {
        const valid = getValidAccessToken();
        if (valid) return valid;

        const refreshed = await tryRefreshToken();
        if (refreshed) return refreshed;

        clearAuth();
        showOverlay('login');
        return null;
    }

    async function loginUser(email, password) {
        const res = await fetch(`${API}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'password',
                client_id: OAUTH_CLIENT.client_id,
                client_secret: OAUTH_CLIENT.client_secret,
                username: email,
                password: password,
                scope: 'read write events registrations notifications'
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.napaka || err.error_description || 'Napačni podatki za prijavo.');
        }

        const token = await res.json();
        token.expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
        writeToken(token);

        const profileRes = await fetch(`${API}/me`, {
            headers: { Authorization: `Bearer ${token.access_token}` }
        });
        if (profileRes.ok) {
            writeUser(await profileRes.json());
        }
    }

    async function registerUser(uporabnisko_ime, email, geslo, vloga) {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uporabnisko_ime, email, geslo, vloga })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.napaka || err.error || 'Napaka pri registraciji.');
        }

        await loginUser(email, geslo);
    }

    async function logout() {
        const token = readToken();
        if (token && token.access_token) {
            await fetch(`${API}/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token.access_token}` }
            }).catch(() => {});
        }
        clearAuth();
        location.reload();
    }

    let _onSuccess = null;

    function showOverlay(tab) {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.hidden = false;
        switchTab(tab || 'login');
    }

    function hideOverlay() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.hidden = true;
    }

    function switchTab(tab) {
        const isLogin = tab === 'login';
        document.getElementById('authTabLogin').classList.toggle('active', isLogin);
        document.getElementById('authTabRegister').classList.toggle('active', !isLogin);
        document.getElementById('authLoginForm').hidden = !isLogin;
        document.getElementById('authRegisterPanel').hidden = isLogin;
        document.getElementById('authTitle').textContent = isLogin ? 'Dobrodošli nazaj' : 'Ustvari račun';
        document.getElementById('authSub').textContent = isLogin
            ? 'Prijavi se v svoj račun'
            : 'Pridruži se skupnosti KajDogaja';
    }

    function setLoginError(msg) {
        const el = document.getElementById('authLoginError');
        if (el) el.textContent = msg;
    }

    async function checkAuth(onSuccess) {
        _onSuccess = onSuccess;

        const valid = getValidAccessToken();
        if (valid) { onSuccess(); return; }

        const refreshed = await tryRefreshToken();
        if (refreshed) { onSuccess(); return; }

        clearAuth();
        showOverlay('login');
    }

    function bindAuthEvents() {
        document.getElementById('authTabLogin')
            .addEventListener('click', () => switchTab('login'));
        document.getElementById('authTabRegister')
            .addEventListener('click', () => switchTab('register'));

        const loginForm = document.getElementById('authLoginForm');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            const btn = loginForm.querySelector('.auth-submit');

            setLoginError('');
            btn.disabled = true;
            btn.textContent = 'Prijavljam ...';

            try {
                await loginUser(email, password);
                hideOverlay();
                if (_onSuccess) _onSuccess();
            } catch (err) {
                setLoginError(err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Prijava';
            }
        });

        const registerForm = document.getElementById('authRegisterForm');
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uporabnisko_ime = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const geslo = document.getElementById('regPassword').value;
            const vloga = document.querySelector('input[name="regRole"]:checked').value;
            const btn = registerForm.querySelector('.auth-submit');
            const errEl = document.getElementById('authRegisterError');

            errEl.textContent = '';
            btn.disabled = true;
            btn.textContent = 'Registriram ...';

            try {
                await registerUser(uporabnisko_ime, email, geslo, vloga);
                hideOverlay();
                if (_onSuccess) _onSuccess();
            } catch (err) {
                errEl.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Registracija';
            }
        });

        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }

    window.Auth = {
        checkAuth,
        getToken,
        getStoredUser: readUser,
        bindAuthEvents,
        logout
    };

}());
