-- CreateTable
CREATE TABLE "Utgift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "delprosjektId" INTEGER,
    "dato" DATETIME NOT NULL,
    "kategori" TEXT NOT NULL,
    "beskrivelse" TEXT,
    "leverandor" TEXT,
    "belop" INTEGER NOT NULL,
    "betaltAvBrukerId" INTEGER,
    "kvitteringBilde" BLOB,
    "kvitteringMimeType" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Utgift_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Utgift_delprosjektId_fkey" FOREIGN KEY ("delprosjektId") REFERENCES "Delprosjekt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Utgift_betaltAvBrukerId_fkey" FOREIGN KEY ("betaltAvBrukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
