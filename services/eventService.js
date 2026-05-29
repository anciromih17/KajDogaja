const prisma = require('../db/prisma');
const { publicUser } = require('./userService');

const EVENT_INCLUDE = {
    kategorija: true,
    mesto: true,
    organizator: true,
    _count: { select: { registrations: { where: { status: 'potrjena' } } } }
};

function enrichEvent(event) {
    if (!event) return null;
    const { _count, organizator, ...rest } = event;
    return {
        ...rest,
        organizator: publicUser(organizator),
        st_prijav: _count?.registrations ?? 0
    };
}

function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findAll({ city, date, category, q, lat, lng, radius = 10, page = 1, limit = 50 } = {}) {
    const where = {};

    if (city) {
        where.OR = [
            { mesto_id: city },
            { mesto: { naziv: { equals: city, mode: 'insensitive' } } }
        ];
    }

    if (category) {
        where.kategorija_id = category;
    }

    if (q) {
        where.OR = [
            ...(where.OR || []),
            { naziv: { contains: q, mode: 'insensitive' } },
            { opis: { contains: q, mode: 'insensitive' } }
        ];
    }

    if (date) {
        const parts = String(date).split(',');
        if (parts.length === 2) {
            where.datum = { lte: parts[1] };
            where.OR = [
                { datum_do: null, datum: { gte: parts[0] } },
                { datum_do: { gte: parts[0] } }
            ];
        } else {
            where.datum = { lte: date };
            where.OR = [
                { datum_do: null, datum: { gte: date } },
                { datum_do: { gte: date } }
            ];
        }
    }

    const skip = (Number(page) - 1) * Number(limit);
    let events = await prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        skip,
        take: Number(limit),
        orderBy: { datum: 'asc' }
    });

    if (lat && lng) {
        const pLat = Number(lat);
        const pLng = Number(lng);
        const pRadius = Number(radius);
        events = events.filter((e) =>
            e.koordinate_lat != null && e.koordinate_lng != null &&
            distanceKm(pLat, pLng, e.koordinate_lat, e.koordinate_lng) <= pRadius
        );
    }

    return events.map(enrichEvent);
}

async function findById(id) {
    const event = await prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
    return enrichEvent(event);
}

async function findRaw(id) {
    return prisma.event.findUnique({ where: { id } });
}

async function create(data) {
    const event = await prisma.event.create({ data, include: EVENT_INCLUDE });
    return enrichEvent(event);
}

async function update(id, data) {
    const event = await prisma.event.update({ where: { id }, data, include: EVENT_INCLUDE });
    return enrichEvent(event);
}

async function remove(id) {
    return prisma.event.delete({ where: { id } });
}

async function countRegistrations(eventId) {
    return prisma.registration.count({
        where: { dogodek_id: eventId, status: 'potrjena' }
    });
}

async function registrationsByDay(eventId) {
    const regs = await prisma.registration.findMany({
        where: { dogodek_id: eventId, status: 'potrjena' },
        select: { ustvarjena: true }
    });
    const map = new Map();
    for (const r of regs) {
        const day = r.ustvarjena.toISOString().slice(0, 10);
        map.set(day, (map.get(day) || 0) + 1);
    }
    return Array.from(map.entries()).map(([datum, stevilo]) => ({ datum, stevilo }));
}

module.exports = { findAll, findById, findRaw, create, update, remove, countRegistrations, registrationsByDay, enrichEvent };
