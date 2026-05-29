const ALLOWED_ROLES = ['uporabnik', 'organizator'];

function validateRegister({ uporabnisko_ime, email, geslo, vloga }) {
    if (!uporabnisko_ime || !email || !geslo) return 'Manjkajo obvezna polja (uporabnisko_ime, email, geslo).';
    if (typeof email !== 'string' || !email.includes('@')) return 'Email ni veljaven.';
    if (geslo.length < 6) return 'Geslo mora imeti vsaj 6 znakov.';
    if (vloga && !ALLOWED_ROLES.includes(vloga)) return 'Vloga mora biti uporabnik ali organizator.';
    return null;
}

function validateProfileUpdate({ uporabnisko_ime, email, geslo_novo, geslo_trenutno }) {
    if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) return 'Email ni veljaven.';
    if (geslo_novo !== undefined && geslo_novo.length < 6) return 'Novo geslo mora imeti vsaj 6 znakov.';
    if (geslo_novo && !geslo_trenutno) return 'Za spremembo gesla je potrebno trenutno geslo.';
    return null;
}

module.exports = { validateRegister, validateProfileUpdate, ALLOWED_ROLES };
