-- CreateTable
CREATE TABLE "Tilgjengelighet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brukerId" INTEGER NOT NULL,
    "dato" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "fraKl" TEXT,
    "tilKl" TEXT,
    "gjentakelseId" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tilgjengelighet_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Arbeidshendelse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "tittel" TEXT NOT NULL,
    "beskrivelse" TEXT,
    "dato" DATETIME NOT NULL,
    "fraKl" TEXT,
    "tilKl" TEXT,
    "opprettetAvBrukerId" INTEGER NOT NULL,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Arbeidshendelse_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Arbeidshendelse_opprettetAvBrukerId_fkey" FOREIGN KEY ("opprettetAvBrukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tilgjengelighet_brukerId_dato_key" ON "Tilgjengelighet"("brukerId", "dato");
