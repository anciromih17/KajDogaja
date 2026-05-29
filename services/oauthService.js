const crypto = require('crypto');
const prisma = require('../db/prisma');

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function findClient(client_id, client_secret) {
    return prisma.oauthClient.findFirst({ where: { id: client_id, secret: client_secret } });
}

function scopesForUser(user) {
    if (user.vloga === 'organizator') {
        return ['read', 'write', 'events', 'registrations', 'notifications'];
    }
    return ['read', 'registrations', 'notifications'];
}

function normalizeUserScope(scope, client, user) {
    const requested = String(scope || client.scopes.join(' ')).split(/\s+/).filter(Boolean);
    const userScopes = scopesForUser(user);
    const allowed = requested.filter((s) => client.scopes.includes(s) && userScopes.includes(s));
    return allowed.length ? allowed.join(' ') : userScopes.join(' ');
}

async function createRefreshToken(user_id, client_id, scope, expiresInSec) {
    const raw = crypto.randomBytes(48).toString('base64url');
    const expires_at = new Date(Date.now() + expiresInSec * 1000);
    await prisma.oauthRefreshToken.create({
        data: { token_hash: tokenHash(raw), user_id, client_id, scope, expires_at }
    });
    return raw;
}

async function findRefreshToken(raw, client_id) {
    return prisma.oauthRefreshToken.findFirst({
        where: { token_hash: tokenHash(raw), client_id }
    });
}

async function revokeRefreshToken(id) {
    return prisma.oauthRefreshToken.update({ where: { id }, data: { revoked: true } });
}

async function revokeAccessToken(token) {
    await prisma.revokedToken.upsert({
        where: { token },
        create: { token },
        update: {}
    });
}

async function revokeRefreshTokenByHash(raw, client_id) {
    const rt = await findRefreshToken(raw, client_id);
    if (rt) await revokeRefreshToken(rt.id);
}

async function isAccessTokenRevoked(token) {
    const found = await prisma.revokedToken.findUnique({ where: { token } });
    return !!found;
}

module.exports = {
    findClient,
    scopesForUser,
    normalizeUserScope,
    createRefreshToken,
    findRefreshToken,
    revokeRefreshToken,
    revokeAccessToken,
    revokeRefreshTokenByHash,
    isAccessTokenRevoked
};
