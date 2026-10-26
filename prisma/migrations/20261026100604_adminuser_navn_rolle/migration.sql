/*
  Warnings:

  - Added the required column `navn` to the `AdminUser` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brukernavn" TEXT NOT NULL,
    "passord" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'eier',
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AdminUser" ("brukernavn", "id", "opprettet", "passord") SELECT "brukernavn", "id", "opprettet", "passord" FROM "AdminUser";
DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_brukernavn_key" ON "AdminUser"("brukernavn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
