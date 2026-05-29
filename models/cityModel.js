function validate({ naziv, koordinate_lat, koordinate_lng }) {
    const name = String(naziv || '').trim();
    if (!name) return 'Naziv mesta je obvezen.';
    if (name.length > 100) return 'Naziv mesta je predolg (max 100 znakov).';

    const lat = Number(koordinate_lat);
    const lng = Number(koordinate_lng);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return 'Koordinata lat mora biti med -90 in 90.';
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return 'Koordinata lng mora biti med -180 in 180.';

    return null;
}

module.exports = { validate };
