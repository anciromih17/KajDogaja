const prisma = require('../db/prisma');
const { enrichEvent } = require('./eventService');

const EVENT_INCLUDE = {
    kategorija: true,
    mesto: true,
    organizator: true,
    _count: { select: { registrations: { where: { status: 'potrjena' } } } }
};

async function create(uporabnik_id, dogodek_id, tip, vsebina) {
    return prisma.notification.create({
        data: { uporabnik_id, dogodek_id, tip, vsebina }
    });
}

async function findByUser(uporabnik_id, prebrano) {
    const where = { uporabnik_id };
    if (prebrano !== undefined) {
        where.prebrano = prebrano === 'true' || prebrano === true;
    }
    const notifications = await prisma.notification.findMany({
        where,
        include: { dogodek: { include: EVENT_INCLUDE } },
        orderBy: { ustvarjeno: 'desc' }
    });
    return notifications.map((n) => ({
        ...n,
        dogodek: n.dogodek ? enrichEvent(n.dogodek) : null
    }));
}

async function findById(id) {
    return prisma.notification.findUnique({ where: { id } });
}

async function markRead(id) {
    return prisma.notification.update({ where: { id }, data: { prebrano: true } });
}

async function remove(id) {
    return prisma.notification.delete({ where: { id } });
}

module.exports = { create, findByUser, findById, markRead, remove };
