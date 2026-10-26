// prisma/backfill-sql.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb } from "../tests/helpers/testDb";
import { BOLIG_STATUS_BACKFILL_SQL } from "./backfill-sql";
import { utledStatusFraAktiv } from "../lib/eiendom-status";

describe("BOLIG_STATUS_BACKFILL_SQL", () => {
  it("er limt inn ordrett i migreringsfilen (ingen drift mellom SQL og TS)", () => {
    const migrasjonsmappe = readdirSync(join(__dirname, "migrations")).find((navn) =>
      navn.endsWith("_bolig_eiendom_status")
    );
    expect(migrasjonsmappe).toBeDefined();
    const sql = readFileSync(join(__dirname, "migrations", migrasjonsmappe!, "migration.sql"), "utf-8");
    expect(sql).toContain(BOLIG_STATUS_BACKFILL_SQL);
  });

  it("gir samme resultat som utledStatusFraAktiv for alle aktiv/type-kombinasjoner", async () => {
    const prisma = await createTestDb();
    const rader = await Promise.all([
      prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", aktiv: true } }),
      prisma.bolig.create({ data: { tittel: "B", adresse: "B", by: "Ålesund", type: "leie", beskrivelse: "", aktiv: true } }),
      prisma.bolig.create({ data: { tittel: "C", adresse: "C", by: "Ålesund", type: "salg", beskrivelse: "", aktiv: false } }),
      prisma.bolig.create({ data: { tittel: "D", adresse: "D", by: "Ålesund", type: "leie", beskrivelse: "", aktiv: false } }),
    ]);

    await prisma.$executeRawUnsafe(BOLIG_STATUS_BACKFILL_SQL);

    for (const rad of rader) {
      const oppdatert = await prisma.bolig.findUniqueOrThrow({ where: { id: rad.id } });
      expect(oppdatert.status).toBe(utledStatusFraAktiv(rad.aktiv, rad.type));
    }
  });
});
