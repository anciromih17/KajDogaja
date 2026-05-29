const prisma = require('../db/prisma');

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        uporabnisko_ime: user.uporabnisko_ime,
        email: user.email,
        vloga: user.vloga,
        ustvarjen: user.ustvarjen
    };
}

async function findByEmail(email) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

async function findById(id) {
    return prisma.user.findUnique({ where: { id } });
}

async function create({ uporabnisko_ime, email, geslo_hash, vloga = 'uporabnik' }) {
    return prisma.user.create({
        data: { uporabnisko_ime, email: email.toLowerCase(), geslo_hash, vloga }
    });
}

async function update(id, data) {
    return prisma.user.update({ where: { id }, data });
}

module.exports = { publicUser, findByEmail, findById, create, update };
