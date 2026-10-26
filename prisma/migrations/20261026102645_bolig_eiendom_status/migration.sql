-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bolig" (
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
    "oppdatert" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'til_salgs',
    "kjopesum" INTEGER,
    "kjopsdato" DATETIME,
    "finansiering" TEXT,
    "estimertVerdiNa" INTEGER,
    "estimertVerdiEtterOppussing" INTEGER
);
INSERT INTO "new_Bolig" ("adresse", "aktiv", "bad", "beskrivelse", "bilder", "by", "id", "lat", "lng", "oppdatert", "opprettet", "pris", "rom", "storrelse", "tittel", "type") SELECT "adresse", "aktiv", "bad", "beskrivelse", "bilder", "by", "id", "lat", "lng", "oppdatert", "opprettet", "pris", "rom", "storrelse", "tittel", "type" FROM "Bolig";
DROP TABLE "Bolig";
ALTER TABLE "new_Bolig" RENAME TO "Bolig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill status from legacy aktiv/type (mirrors lib/eiendom-status.ts#utledStatusFraAktiv)
UPDATE "Bolig" SET status = CASE
  WHEN aktiv = 1 AND type = 'leie' THEN 'klar_for_utleie'
  WHEN aktiv = 1 THEN 'til_salgs'
  WHEN type = 'leie' THEN 'utleid'
  ELSE 'solgt'
END;
