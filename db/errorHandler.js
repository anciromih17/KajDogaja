const { Prisma } = require('@prisma/client');

function sendError(res, status, message) {
    return res.status(status).json({ napaka: message, koda: status });
}

// Pretvori Prisma napake v ustrezne HTTP odgovore
function handlePrismaError(err, res) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': {
                const field = err.meta?.target?.[0] || 'polje';
                return sendError(res, 409, `Vrednost za ${field} že obstaja.`);
            }
            case 'P2025':
                return sendError(res, 404, 'Zapis ne obstaja.');
            case 'P2003':
                return sendError(res, 400, 'Napaka tuje ključne omejitve.');
            case 'P2014':
                return sendError(res, 400, 'Napaka relacijske omejitve.');
            default:
                console.error(`Prisma P${err.code}:`, err.message);
                return sendError(res, 500, 'Napaka podatkovne baze.');
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        return sendError(res, 400, 'Neveljavni podatki za podatkovno bazo.');
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
        console.error('Prisma inicializacijska napaka:', err.message);
        return sendError(res, 503, 'Podatkovna baza ni dosegljiva.');
    }

    return null;
}

// Express async wrapper — ujame Prisma napake avtomatsko
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            const handled = handlePrismaError(err, res);
            if (!handled) next(err);
        });
    };
}

module.exports = { handlePrismaError, asyncHandler, sendError };
