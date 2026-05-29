function validate({ naziv }) {
    const name = String(naziv || '').trim();
    if (!name) return 'Naziv kategorije je obvezen.';
    if (name.length > 100) return 'Naziv kategorije je predolg (max 100 znakov).';
    return null;
}

module.exports = { validate };
