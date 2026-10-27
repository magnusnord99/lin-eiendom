-- AlterTable
ALTER TABLE "Bolig" ADD COLUMN "salgssum" INTEGER;

-- CreateTable
CREATE TABLE "Innstilling" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "arbeidstimerAndelProsent" REAL NOT NULL DEFAULT 10,
    "kapitalAndelProsent" REAL NOT NULL DEFAULT 10
);
