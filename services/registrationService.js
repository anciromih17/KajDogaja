const prisma = require('../db/prisma');
const { publicUser } = require('./userService');
const { enrichEvent } = require('./eventService');

const EVENT_INCLUDE = {
    kategorija: true,
    mesto: true,
    organizator: true,
    _count: { select: { registrations: { where: { status: 'potrjena' } } } }
};

async function findActiveByUserAndEvent(uporabnik_id, dogodek_id) {
    return prisma.registration.findFirst({
        where: { uporabnik_id, dogodek_id, status: 'potrjena' }
    });
}

async function findByEvent(dogodek_id) {
    const regs = await prisma.registration.findMany({
        where: { dogodek_id, status: 'potrjena' },
        include: { uporabnik: true }
    });
    return regs.map((r) => ({
        id: r.id,
        uporabnik: publicUser(r.uporabnik),
        status: r.status,
        ustvarjena: r.ustvarjena
    }));
}

async function findByUser(uporabnik_id) {
    const regs = await prisma.registration.findMany({
        where: { uporabnik_id },
        include: { dogodek: { include: EVENT_INCLUDE } }
    });
    return regs.map((r) => ({
        id: r.id,
        status: r.status,
        ustvarjena: r.ustvarjena,
        dogodek: enrichEvent(r.dogodek)
    }));
}

async function create(uporabnik_id, dogodek_id) {
    return prisma.registration.create({
        data: { uporabnik_id, dogodek_id, status: 'potrjena' }
    });
}

async function remove(uporabnik_id, dogodek_id) {
    const reg = await findActiveByUserAndEvent(uporabnik_id, dogodek_id);
    if (!reg) return null;
    return prisma.registration.delete({ where: { id: reg.id } });
}

async function getUserIdsForEvent(dogodek_id) {
    const regs = await prisma.registration.findMany({
        where: { dogodek_id, status: 'potrjena' },
        select: { uporabnik_id: true }
    });
    return regs.map((r) => r.uporabnik_id);
}

module.exports = { findActiveByUserAndEvent, findByEvent, findByUser, create, remove, getUserIdsForEvent };
