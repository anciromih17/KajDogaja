-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "uporabnisko_ime" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "geslo_hash" TEXT NOT NULL,
    "vloga" TEXT NOT NULL DEFAULT 'uporabnik',
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "koordinate_lat" DOUBLE PRECISION NOT NULL,
    "koordinate_lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "opis" TEXT NOT NULL,
    "datum" TEXT NOT NULL,
    "datum_do" TEXT,
    "ura" TEXT NOT NULL,
    "lokacija" TEXT NOT NULL,
    "koordinate_lat" DOUBLE PRECISION,
    "koordinate_lng" DOUBLE PRECISION,
    "kapaciteta" INTEGER,
    "qr_koda_url" TEXT NOT NULL DEFAULT '',
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posodobljen" TIMESTAMP(3) NOT NULL,
    "kategorija_id" TEXT NOT NULL,
    "mesto_id" TEXT NOT NULL,
    "organizator_id" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'potrjena',
    "ustvarjena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uporabnik_id" TEXT NOT NULL,
    "dogodek_id" TEXT NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "vsebina" TEXT NOT NULL,
    "prebrano" BOOLEAN NOT NULL DEFAULT false,
    "ustvarjeno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uporabnik_id" TEXT NOT NULL,
    "dogodek_id" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OauthClient" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "scopes" TEXT[],

    CONSTRAINT "OauthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OauthRefreshToken" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "OauthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "token" TEXT NOT NULL,
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL DEFAULT '{}',
    "ustvarjeno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "delivered_at" TIMESTAMP(3),
    "ustvarjeno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_naziv_key" ON "Category"("naziv");

-- CreateIndex
CREATE UNIQUE INDEX "City_naziv_key" ON "City"("naziv");

-- CreateIndex
CREATE UNIQUE INDEX "OauthRefreshToken_token_hash_key" ON "OauthRefreshToken"("token_hash");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_kategorija_id_fkey" FOREIGN KEY ("kategorija_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_mesto_id_fkey" FOREIGN KEY ("mesto_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizator_id_fkey" FOREIGN KEY ("organizator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_uporabnik_id_fkey" FOREIGN KEY ("uporabnik_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_dogodek_id_fkey" FOREIGN KEY ("dogodek_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_uporabnik_id_fkey" FOREIGN KEY ("uporabnik_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dogodek_id_fkey" FOREIGN KEY ("dogodek_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OauthRefreshToken" ADD CONSTRAINT "OauthRefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OauthRefreshToken" ADD CONSTRAINT "OauthRefreshToken_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "OauthClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
