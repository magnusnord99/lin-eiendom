import { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const AUTH_VERSION = 2;

export function buildAuthorize(prismaClient: PrismaClient) {
  return async function authorize(
    credentials: Record<"username" | "password", string> | undefined
  ): Promise<{ id: string; name: string; role: string } | null> {
    if (!credentials?.username || !credentials?.password) return null;

    const bruker = await prismaClient.adminUser.findUnique({
      where: { brukernavn: credentials.username },
    });
    if (!bruker) return null;

    const gyldig = await verifyPassword(credentials.password, bruker.passord);
    if (!gyldig) return null;

    return { id: String(bruker.id), name: bruker.navn, role: bruker.rolle };
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Brukernavn", type: "text" },
        password: { label: "Passord", type: "password" },
      },
      authorize: buildAuthorize(prisma),
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/innlogging",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.authVersion = AUTH_VERSION;
      } else if (token.authVersion !== AUTH_VERSION) {
        delete token.id;
        delete token.role;
        delete token.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      session.user =
        token.authVersion === AUTH_VERSION && token.id && token.role
          ? { ...session.user, id: token.id, role: token.role }
          : undefined;
      return session;
    },
  },
};

export function vurderSesjon(session: Session | null): { id: string; role: string } | null {
  return session?.user?.id && session?.user?.role
    ? { id: session.user.id, role: session.user.role }
    : null;
}

export async function krevInnloggetSesjon(): Promise<{ id: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  return vurderSesjon(session);
}
