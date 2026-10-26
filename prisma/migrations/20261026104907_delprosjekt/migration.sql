-- CreateTable
CREATE TABLE "Delprosjekt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "navn" TEXT NOT NULL,
    "beskrivelse" TEXT,
    "budsjett" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'planlagt',
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oppdatert" DATETIME NOT NULL,
    CONSTRAINT "Delprosjekt_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
