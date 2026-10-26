import type { PrismaClient, Delprosjekt } from "@/app/generated/prisma/client";

export async function opprettDelprosjekt(
  prisma: PrismaClient,
  input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }
): Promise<Delprosjekt> {
  return prisma.delprosjekt.create({
    data: {
      eiendomId: input.eiendomId,
      navn: input.navn,
      beskrivelse: input.beskrivelse,
      budsjett: input.budsjett,
    },
  });
}

export async function harDelprosjekter(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.delprosjekt.count({ where: { eiendomId } })) > 0;
}
