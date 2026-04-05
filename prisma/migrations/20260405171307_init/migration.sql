-- CreateTable
CREATE TABLE "Bolig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tittel" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "pris" INTEGER,
    "type" TEXT NOT NULL,
    "storrelse" INTEGER,
    "rom" INTEGER,
    "bad" INTEGER,
    "beskrivelse" TEXT NOT NULL,
    "bilder" TEXT NOT NULL DEFAULT '[]',
    "lat" REAL,
    "lng" REAL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oppdatert" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brukernavn" TEXT NOT NULL,
    "passord" TEXT NOT NULL,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_brukernavn_key" ON "AdminUser"("brukernavn");
