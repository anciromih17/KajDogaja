const prisma = require('../db/prisma');

async function subscribe(user_id, endpoint, keys) {
    const ep = endpoint || `local-${user_id}`;
    const existing = await prisma.pushSubscription.findFirst({ where: { user_id, endpoint: ep } });
    if (existing) {
        return prisma.pushSubscription.update({ where: { id: existing.id }, data: { keys: keys || {} } });
    }
    return prisma.pushSubscription.create({ data: { user_id, endpoint: ep, keys: keys || {} } });
}

async function queueMessage(title, body, data = {}) {
    return prisma.pushMessage.create({ data: { title, body, data } });
}

async function getPendingMessages() {
    const messages = await prisma.pushMessage.findMany({ where: { delivered: false } });
    await prisma.pushMessage.updateMany({
        where: { id: { in: messages.map((m) => m.id) } },
        data: { delivered: true, delivered_at: new Date() }
    });
    return messages;
}

module.exports = { subscribe, queueMessage, getPendingMessages };
