-- CreateTable
CREATE TABLE "Timeregistrering" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "delprosjektId" INTEGER NOT NULL,
    "brukerId" INTEGER NOT NULL,
    "dato" DATETIME NOT NULL,
    "antallTimer" REAL NOT NULL,
    "beskrivelse" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oppdatert" DATETIME NOT NULL,
    CONSTRAINT "Timeregistrering_delprosjektId_fkey" FOREIGN KEY ("delprosjektId") REFERENCES "Delprosjekt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Timeregistrering_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
