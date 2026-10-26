import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { hashPassword } from "@/lib/password";

export type SeedUser = { brukernavn: string; passord: string; navn: string };

export async function seedAdminUsers(prisma: PrismaClient, users: SeedUser[]): Promise<void> {
  for (const bruker of users) {
    const hash = await hashPassword(bruker.passord);
    await prisma.adminUser.upsert({
      where: { brukernavn: bruker.brukernavn },
      update: { passord: hash, navn: bruker.navn },
      create: { brukernavn: bruker.brukernavn, passord: hash, navn: bruker.navn },
    });
  }
}

const EIERE: Omit<SeedUser, "passord">[] = [
  { brukernavn: "magnus", navn: "Magnus" },
  { brukernavn: "oystein", navn: "Øystein" },
  { brukernavn: "oskar", navn: "Oskar" },
  { brukernavn: "simen", navn: "Simen" },
];

function krevPassord(miljoVariabel: string): string {
  const verdi = process.env[miljoVariabel];
  if (!verdi) {
    throw new Error(`Miljøvariabelen ${miljoVariabel} er ikke satt`);
  }
  return verdi;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  const users: SeedUser[] = EIERE.map((eier) => ({
    ...eier,
    passord: krevPassord(`SEED_PASSWORD_${eier.brukernavn.toUpperCase()}`),
  }));

  await seedAdminUsers(prisma, users);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
