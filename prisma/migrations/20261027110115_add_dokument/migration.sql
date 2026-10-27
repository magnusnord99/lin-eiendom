-- CreateTable
CREATE TABLE "Dokument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "delprosjektId" INTEGER,
    "kategori" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storrelse" INTEGER NOT NULL,
    "opplastetAvBrukerId" INTEGER NOT NULL,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dokument_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dokument_delprosjektId_fkey" FOREIGN KEY ("delprosjektId") REFERENCES "Delprosjekt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dokument_opplastetAvBrukerId_fkey" FOREIGN KEY ("opplastetAvBrukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
