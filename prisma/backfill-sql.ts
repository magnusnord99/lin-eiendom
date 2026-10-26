// prisma/backfill-sql.ts
export const BOLIG_STATUS_BACKFILL_SQL = `
UPDATE "Bolig" SET status = CASE
  WHEN aktiv = 1 AND type = 'leie' THEN 'klar_for_utleie'
  WHEN aktiv = 1 THEN 'til_salgs'
  WHEN type = 'leie' THEN 'utleid'
  ELSE 'solgt'
END;
`.trim();
