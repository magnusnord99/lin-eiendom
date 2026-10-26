-- CreateTable
CREATE TABLE "Kapitalinnskudd" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "brukerId" INTEGER NOT NULL,
    "dato" DATETIME NOT NULL,
    "belop" INTEGER NOT NULL,
    "beskrivelse" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kapitalinnskudd_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Kapitalinnskudd_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
