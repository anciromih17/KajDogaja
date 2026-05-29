const prisma = require('../db/prisma');

async function findAll() {
    return prisma.city.findMany({ orderBy: { naziv: 'asc' } });
}

async function findById(id) {
    return prisma.city.findUnique({ where: { id } });
}

async function exists(id) {
    return !!(await findById(id));
}

async function existsByNaziv(naziv) {
    return !!(await prisma.city.findUnique({ where: { naziv: naziv.toLowerCase() } }));
}

async function create(naziv, koordinate_lat, koordinate_lng) {
    return prisma.city.create({
        data: { naziv: naziv.toLowerCase(), koordinate_lat, koordinate_lng }
    });
}

module.exports = { findAll, findById, exists, existsByNaziv, create };
