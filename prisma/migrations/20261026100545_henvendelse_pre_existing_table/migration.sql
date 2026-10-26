-- CreateTable
CREATE TABLE "Henvendelse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "navn" TEXT NOT NULL,
    "epost" TEXT NOT NULL,
    "telefon" TEXT,
    "adresse" TEXT,
    "tilstand" TEXT,
    "melding" TEXT NOT NULL,
    "lest" BOOLEAN NOT NULL DEFAULT false,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
