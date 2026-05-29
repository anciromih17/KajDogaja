const categoryService = require('../services/categoryService');
const cityService = require('../services/cityService');

const REQUIRED_FIELDS = ['naziv', 'opis', 'datum', 'ura', 'lokacija', 'kategorija_id', 'mesto_id'];

function isValidDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function isValidTime(v) { return /^\d{2}:\d{2}$/.test(v || ''); }

async function validate(payload, partial = false) {
    if (!partial) {
        for (const field of REQUIRED_FIELDS) {
            if (!payload[field]) return `Manjka polje ${field}.`;
        }
    }

    if (payload.datum !== undefined && !isValidDate(payload.datum))
        return 'Datum mora biti v obliki YYYY-MM-DD.';

    if (payload.datum_do !== undefined && payload.datum_do !== '' && !isValidDate(payload.datum_do))
        return 'Datum do mora biti v obliki YYYY-MM-DD.';

    if (payload.datum && payload.datum_do && payload.datum_do < payload.datum)
        return 'Datum do ne sme biti pred datumom zacetka.';

    if (payload.ura !== undefined && !isValidTime(payload.ura))
        return 'Ura mora biti v obliki HH:MM.';

    if (payload.kapaciteta !== undefined && payload.kapaciteta !== null && Number(payload.kapaciteta) < 1)
        return 'Kapaciteta mora biti pozitivno stevilo ali null.';

    if (payload.kategorija_id && !(await categoryService.exists(payload.kategorija_id)))
        return 'Kategorija ne obstaja.';

    if (payload.mesto_id && !(await cityService.exists(payload.mesto_id)))
        return 'Mesto ne obstaja.';

    return null;
}

function buildCreateData(body, organizatorId) {
    return {
        naziv: body.naziv,
        opis: body.opis,
        datum: body.datum,
        datum_do: body.datum_do || body.datum,
        ura: body.ura,
        lokacija: body.lokacija,
        koordinate_lat: body.koordinate_lat ? Number(body.koordinate_lat) : null,
        koordinate_lng: body.koordinate_lng ? Number(body.koordinate_lng) : null,
        kapaciteta: body.kapaciteta === null ? null : (body.kapaciteta ? Number(body.kapaciteta) : null),
        kategorija_id: body.kategorija_id,
        mesto_id: body.mesto_id,
        organizator_id: organizatorId
    };
}

const EDITABLE_FIELDS = ['naziv', 'opis', 'datum', 'datum_do', 'ura', 'lokacija',
    'koordinate_lat', 'koordinate_lng', 'kapaciteta', 'kategorija_id', 'mesto_id'];

function buildUpdateData(body) {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
            updates[field] = ['koordinate_lat', 'koordinate_lng', 'kapaciteta'].includes(field) && body[field] !== null
                ? Number(body[field])
                : body[field];
        }
    }
    return updates;
}

module.exports = { validate, buildCreateData, buildUpdateData };
