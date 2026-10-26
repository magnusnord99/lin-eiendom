"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opprettDelprosjekt } from "@/lib/delprosjekt";

export async function opprettDelprosjektAction(input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");
  if (!input.navn.trim()) throw new Error("Navn er påkrevd.");
  if (input.budsjett !== undefined && input.budsjett < 0) throw new Error("Budsjett kan ikke være negativt.");
  return opprettDelprosjekt(prisma, input);
}
