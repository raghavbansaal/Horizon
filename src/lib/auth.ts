import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const authUserCache = new Map<string, { id: string; email: string }>();

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const email = user.email;
  if (!email) throw new Error("Authenticated user email is missing");

  const cached = authUserCache.get(user.id);
  if (cached && cached.email === email) return cached;

  let dbUser: { id: string; email: string };
  try {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true },
    });

    if (existing) {
      if (existing.email !== email) {
        dbUser = await prisma.user.update({
          where: { id: user.id },
          data: { email },
          select: { id: true, email: true },
        });
      } else {
        dbUser = existing;
      }
    } else {
      dbUser = await prisma.user.create({
        data: { id: user.id, email },
        select: { id: true, email: true },
      });
    }
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // If email already exists on a legacy row with another id, reuse that row.
      const fallback = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });
      if (!fallback) throw error;
      dbUser = fallback;
    } else {
      throw error;
    }
  }

  authUserCache.set(user.id, dbUser);
  return dbUser;
}