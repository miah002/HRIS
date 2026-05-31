import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const LOCK_THRESHOLD  = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: String(creds.email) } });
        if (!user?.password) return null;

        // Block if account locked
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const ok = await bcrypt.compare(String(creds.password), user.password);
        if (!ok) {
          const attempts = (user.loginAttempts ?? 0) + 1;
          const update: { loginAttempts: number; lockedUntil?: Date } = { loginAttempts: attempts };
          if (attempts >= LOCK_THRESHOLD) {
            update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          }
          await prisma.user.update({ where: { id: user.id }, data: update });
          return null;
        }

        // Success — reset lockout counters
        await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });
        return { id: user.id, email: user.email, name: user.name ?? undefined, image: user.image ?? undefined };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { companyId: true },
        });
        logAudit({
          companyId: dbUser?.companyId,
          userId: user.id,
          action: "LOGIN",
          target: "User",
          targetId: user.id,
        }).catch(() => {});
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id?: string }).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
});
