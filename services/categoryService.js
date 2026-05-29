const prisma = require('../db/prisma');

async function findAll() {
    return prisma.category.findMany({ orderBy: { naziv: 'asc' } });
}

async function findById(id) {
    return prisma.category.findUnique({ where: { id } });
}

async function exists(id) {
    return !!(await findById(id));
}

async function existsByNaziv(naziv) {
    return !!(await prisma.category.findUnique({ where: { naziv: naziv.toLowerCase() } }));
}

async function create(naziv) {
    return prisma.category.create({ data: { naziv: naziv.toLowerCase() } });
}

module.exports = { findAll, findById, exists, existsByNaziv, create };
