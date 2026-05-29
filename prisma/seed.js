require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding baze...');

    // OAuth klient
    await prisma.oauthClient.upsert({
        where: { id: 'kajdogaja-test-client' },
        create: {
            id: 'kajdogaja-test-client',
            secret: 'kajdogaja-test-secret',
            name: 'KajDogaja testni Node.js odjemalec',
            redirect_uris: ['http://localhost/callback'],
            scopes: ['read', 'write', 'events', 'registrations', 'notifications']
        },
        update: {}
    });

    // Demo uporabniki
    const organizator = await prisma.user.upsert({
        where: { email: 'organizator@kajdogaja.si' },
        create: {
            uporabnisko_ime: 'Demo Organizator',
            email: 'organizator@kajdogaja.si',
            geslo_hash: await bcrypt.hash('organizator123', 10),
            vloga: 'organizator'
        },
        update: {}
    });

    const uporabnik = await prisma.user.upsert({
        where: { email: 'uporabnik@kajdogaja.si' },
        create: {
            uporabnisko_ime: 'Demo Uporabnik',
            email: 'uporabnik@kajdogaja.si',
            geslo_hash: await bcrypt.hash('uporabnik123', 10),
            vloga: 'uporabnik'
        },
        update: {}
    });

    // Kategorije
    const katGlasba = await prisma.category.upsert({ where: { naziv: 'glasba' }, create: { naziv: 'glasba' }, update: {} });
    const katSport = await prisma.category.upsert({ where: { naziv: 'sport' }, create: { naziv: 'sport' }, update: {} });
    await prisma.category.upsert({ where: { naziv: 'kultura' }, create: { naziv: 'kultura' }, update: {} });
    await prisma.category.upsert({ where: { naziv: 'festival' }, create: { naziv: 'festival' }, update: {} });

    // Mesta
    const maribor = await prisma.city.upsert({
        where: { naziv: 'maribor' },
        create: { naziv: 'maribor', koordinate_lat: 46.5547, koordinate_lng: 15.6459 },
        update: {}
    });
    const ljubljana = await prisma.city.upsert({
        where: { naziv: 'ljubljana' },
        create: { naziv: 'ljubljana', koordinate_lat: 46.0569, koordinate_lng: 14.5058 },
        update: {}
    });
    await prisma.city.upsert({
        where: { naziv: 'celje' },
        create: { naziv: 'celje', koordinate_lat: 46.2397, koordinate_lng: 15.2677 },
        update: {}
    });

    // Demo dogodki
    const QRCode = require('qrcode');
    const PORT = process.env.PORT || 3000;

    const evt1 = await prisma.event.upsert({
        where: { id: 'evt_koncert_maribor' },
        create: {
            id: 'evt_koncert_maribor',
            naziv: 'Vecerni koncert v parku',
            opis: 'Odprt glasbeni dogodek z lokalnimi izvajalci.',
            datum: '2026-05-15',
            datum_do: '2026-05-15',
            ura: '20:00',
            lokacija: 'Mestni park Maribor',
            koordinate_lat: 46.5622,
            koordinate_lng: 15.6431,
            kapaciteta: 120,
            qr_koda_url: await QRCode.toDataURL(`http://localhost:${PORT}/api/events/evt_koncert_maribor`),
            kategorija_id: katGlasba.id,
            mesto_id: maribor.id,
            organizator_id: organizator.id
        },
        update: {}
    });

    await prisma.event.upsert({
        where: { id: 'evt_tek_ljubljana' },
        create: {
            id: 'evt_tek_ljubljana',
            naziv: 'Dobrodelni tek',
            opis: 'Sportni dogodek za vse generacije.',
            datum: '2026-05-22',
            datum_do: '2026-05-22',
            ura: '10:00',
            lokacija: 'Tivoli Ljubljana',
            koordinate_lat: 46.0593,
            koordinate_lng: 14.4976,
            kapaciteta: 300,
            qr_koda_url: await QRCode.toDataURL(`http://localhost:${PORT}/api/events/evt_tek_ljubljana`),
            kategorija_id: katSport.id,
            mesto_id: ljubljana.id,
            organizator_id: organizator.id
        },
        update: {}
    });

    // Demo prijava
    const existingReg = await prisma.registration.findFirst({
        where: { uporabnik_id: uporabnik.id, dogodek_id: evt1.id }
    });
    if (!existingReg) {
        await prisma.registration.create({
            data: { uporabnik_id: uporabnik.id, dogodek_id: evt1.id, status: 'potrjena' }
        });
    }

    // Demo obvestilo
    const existingNotif = await prisma.notification.findFirst({
        where: { uporabnik_id: uporabnik.id, dogodek_id: evt1.id }
    });
    if (!existingNotif) {
        await prisma.notification.create({
            data: {
                uporabnik_id: uporabnik.id,
                dogodek_id: evt1.id,
                tip: 'opomnik',
                vsebina: 'Ne pozabite na koncert v parku.'
            }
        });
    }

    console.log('Seed uspesen!');
    console.log('  organizator@kajdogaja.si / organizator123');
    console.log('  uporabnik@kajdogaja.si   / uporabnik123');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
