import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export async function createTestDb(): Promise<PrismaClient> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "yappuccino-test-"));
  const dbUrl = `file:${path.join(dir, "test.db")}`;

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}
